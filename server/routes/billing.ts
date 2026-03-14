import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { requireAuth } from "../middleware/requireAuth";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

router.post("/create-checkout", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL || "http://localhost:5000"}/dashboard?upgraded=true`,
      cancel_url: `${process.env.CLIENT_URL || "http://localhost:5000"}/pricing`,
      customer_email: req.user.email,
      metadata: {
        clerkUserId: req.user.clerkId,
      },
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkUserId = session.metadata?.clerkUserId;

        if (!clerkUserId) {
          console.error("No clerkUserId in session metadata");
          break;
        }

        await db
          .update(users)
          .set({
            plan: "pro",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            subscriptionStatus: "active",
          })
          .where(eq(users.clerkId, clerkUserId));

        console.log(`User ${clerkUserId} upgraded to Pro`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await db
          .update(users)
          .set({
            plan: "free",
            subscriptionStatus: "cancelled",
          })
          .where(eq(users.stripeSubscriptionId, subscription.id));

        console.log(`Subscription ${subscription.id} cancelled`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        await db
          .update(users)
          .set({
            subscriptionStatus: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          })
          .where(eq(users.stripeSubscriptionId, subscription.id));

        console.log(`Subscription ${subscription.id} updated`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/portal", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.user.stripeCustomerId) {
      return res.status(400).json({ error: "No Stripe customer found" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: req.user.stripeCustomerId,
      return_url: `${process.env.CLIENT_URL || "http://localhost:5000"}/dashboard`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("Error creating portal session:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
