import { Router } from "express";
import { db } from "../db";
import { alertSubscriptions, lifecycleChangeEvents, opportunities } from "../../shared/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { requireAdminKey } from "../middleware/requireAdminKey";
import { adminEndpointLimiter } from "../middleware/rateLimiter";
import { sendConfirmationEmail, sendWeeklyDigest } from "../services/emailService";

const router = Router();

router.post("/subscribe", async (req, res) => {
  try {
    const { email, trend_slug } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }

    const [subscription] = await db
      .insert(alertSubscriptions)
      .values({
        email,
        trendSlug: trend_slug || null,
        confirmed: true,
      })
      .onConflictDoNothing()
      .returning();

    const emailSent = await sendConfirmationEmail(email, trend_slug);

    if (!emailSent) {
      console.warn(`Subscription created but confirmation email failed for ${email}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error creating subscription:", error);
    res.status(500).json({ error: "Failed to create subscription" });
  }
});

router.post("/weekly-digest", adminEndpointLimiter, requireAdminKey, async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const topOpps = await db
      .select()
      .from(opportunities)
      .orderBy(desc(opportunities.score))
      .limit(5);

    const lifecycleChanges = await db
      .select()
      .from(lifecycleChangeEvents)
      .where(
        and(
          gte(lifecycleChangeEvents.detectedAt, sevenDaysAgo),
          eq(lifecycleChangeEvents.notified, false)
        )
      )
      .orderBy(desc(lifecycleChangeEvents.detectedAt));

    const confirmedSubscribers = await db
      .select()
      .from(alertSubscriptions)
      .where(
        and(
          eq(alertSubscriptions.confirmed, true),
          sql`${alertSubscriptions.trendSlug} IS NULL`
        )
      );

    let sentCount = 0;
    for (const subscriber of confirmedSubscribers) {
      const sent = await sendWeeklyDigest(
        subscriber.email,
        topOpps,
        lifecycleChanges
      );
      if (sent) {
        sentCount++;
      }
    }

    if (lifecycleChanges.length > 0) {
      const changeIds = lifecycleChanges.map(c => c.id);
      await db
        .update(lifecycleChangeEvents)
        .set({ notified: true })
        .where(sql`${lifecycleChangeEvents.id} IN (${sql.join(changeIds.map(id => sql`${id}`), sql`, `)})`);
    }

    res.json({ sent: sentCount, changes_notified: lifecycleChanges.length });
  } catch (error) {
    console.error("Error sending weekly digest:", error);
    res.status(500).json({ error: "Failed to send weekly digest" });
  }
});

export default router;
