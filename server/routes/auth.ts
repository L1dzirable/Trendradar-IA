import { Router, Request, Response } from "express";
import { Webhook } from "svix";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/webhook", async (req: Request, res: Response): Promise<void> => {
  const secret = process.env.CLERK_WEBHOOK_SECRET;

  if (!secret) {
    res.status(500).json({ error: "CLERK_WEBHOOK_SECRET manquant" });
    return;
  }

  const wh = new Webhook(secret);
  let event: any;

  try {
    event = wh.verify(req.body as Buffer, req.headers as Record<string, string>);
  } catch {
    res.status(400).json({ error: "Signature webhook invalide" });
    return;
  }

  if (event.type === "user.created") {
    const { id, email_addresses, first_name, last_name } = event.data;

    await db
      .insert(users)
      .values({
        clerkId: id,
        email: email_addresses[0].email_address,
        fullName: `${first_name ?? ""} ${last_name ?? ""}`.trim(),
      })
      .onConflictDoNothing();
  }

  if (event.type === "user.updated") {
    const { id, email_addresses, first_name, last_name } = event.data;

    await db
      .update(users)
      .set({
        email: email_addresses[0].email_address,
        fullName: `${first_name ?? ""} ${last_name ?? ""}`.trim(),
        updatedAt: new Date(),
      })
      .where(eq(users.clerkId, id));
  }

  res.json({ received: true });
});

export default router;