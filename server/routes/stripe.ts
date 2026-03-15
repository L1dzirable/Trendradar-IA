import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { requireAuth } from "../middleware/requireAuth";
import { PLANS } from "../config/plans";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import type { PlanId } from "../config/plans";

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// CREATE CHECKOUT SESSION
router.post("/create-checkout", requireAuth, async (req: Request, res: Response) => {
  const { planId } = req.body;

  const plan = PLANS[planId as PlanId];

  if (!plan?.stripePriceId) {
    return res.status(400).json({ error: "Plan invalide" });
  }

  let customerId = req.user?.stripeCustomerId;

  if (!customerId) {
    const customerParams: Stripe.CustomerCreateParams = {
  metadata: {
    clerk_id: req.user?.clerkId ?? "",
  },
};

if (req.user?.email) {
  customerParams.email = req.user.email;
}

const customer = await stripe.customers.create(customerParams);

    customerId = customer.id;

    await db
  .update(users)
  .set({
    stripeCustomerId: customerId,
    updatedAt:        new Date(),
  })
  .where(eq(users.id, req.user!.id));
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.FRONTEND_URL}/pricing`,
  });

  res.json({
    checkout_url: session.url,
  });
    });

// BILLING PORTAL
router.post("/portal", requireAuth, async (req: Request, res: Response) => {
  if (!req.user?.stripeCustomerId) {
    return res.status(400).json({ error: "Aucun abonnement actif" });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: req.user.stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/dashboard`,
  });

  res.json({
    portal_url: session.url,
  });
});

// ── WEBHOOK STRIPE ────────────────────────────────────────────────
// Monté avec express.raw() dans index.ts — req.body est un Buffer ici

router.post("/webhook", async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers["stripe-signature"];

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(400).json({ error: "Configuration webhook manquante" });
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[Stripe Webhook] Signature invalide:", err);
    res.status(400).json({ error: "Signature invalide" });
    return;
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
        break;
    }
  } catch (err) {
    // On log mais on répond 200 pour éviter les retry Stripe
    console.error("[Stripe Webhook] Erreur handler:", err);
  }

  res.json({ received: true });
});

// ── HELPERS ───────────────────────────────────────────────────────

async function handleSubscriptionUpdate(sub: Stripe.Subscription): Promise<void> {
  const priceId = sub.items.data[0]?.price.id;
  if (!priceId) return;

  const { getPlanFromPriceId } = await import("../config/plans");
  const planId = getPlanFromPriceId(priceId);

  await db
    .update(users)
    .set({
      plan:                 planId,
      stripeSubscriptionId: sub.id,
      subscriptionStatus:   sub.status,
      currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
      updatedAt:            new Date(),
    })
    .where(eq(users.stripeCustomerId, sub.customer as string));

  console.log(`[Stripe] plan → ${planId} | status → ${sub.status}`);
}

async function handleSubscriptionCancelled(sub: Stripe.Subscription): Promise<void> {
  await db
    .update(users)
    .set({
      plan:               "free",
      subscriptionStatus: "inactive",
      updatedAt:          new Date(),
    })
    .where(eq(users.stripeCustomerId, sub.customer as string));

  console.log(`[Stripe] Abonnement annulé → retour free`);
}

export default router;