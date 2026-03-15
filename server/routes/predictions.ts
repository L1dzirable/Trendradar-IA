import { Router } from "express";
import { db } from "../db";
import { predictions, opportunities } from "../../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAdminKey } from "../middleware/requireAdminKey";
import { adminEndpointLimiter, publicEndpointLimiter } from "../middleware/rateLimiter";
import { autoDraftPredictions, getDraftEligibleOpportunities } from "../services/predictionDraft";
import { autoPromotePredictions, getPromotionEligibleDrafts, getPredictionStats } from "../services/predictionPromotion";
import { predictionEngine } from "../services/predictions/predictionEngine";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { status, isPublished, includeDrafts } = req.query;
    const adminKey = req.headers['x-admin-key'] as string;

    let query = db.select().from(predictions);

    const conditions = [];

    if (includeDrafts === "true") {
      if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: "Admin key required for drafts" });
      }
    } else {
      conditions.push(eq(predictions.isPublished, true));
    }

    if (status) {
      conditions.push(eq(predictions.status, status as string));
    }

    if (isPublished === "true") {
      conditions.push(eq(predictions.isPublished, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(predictions.draftedAt));

    const enriched = await Promise.all(
      results.map(async (pred) => {
        const opp = await db
          .select()
          .from(opportunities)
          .where(eq(opportunities.id, pred.opportunityId))
          .limit(1);

        return {
          ...pred,
          opportunity: opp[0] || null,
        };
      })
    );

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const predictionId = parseInt(req.params.id);

    const result = await db
      .select()
      .from(predictions)
      .where(eq(predictions.id, predictionId))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ error: "Prediction not found" });
    }

    const pred = result[0];
    const opp = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.id, pred.opportunityId))
      .limit(1);

    res.json({
      ...pred,
      opportunity: opp[0] || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/draft", adminEndpointLimiter, requireAdminKey, async (req, res) => {
  try {
    const { minScore, minSignalCount } = req.body;

    const criteria = {
      minScore: minScore || 70,
      minSignalCount: minSignalCount || 5,
    };

    const draftedCount = await autoDraftPredictions(criteria);

    res.json({
      success: true,
      draftedCount,
      message: `${draftedCount} predictions auto-drafted`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/draft-eligible", adminEndpointLimiter, requireAdminKey, async (req, res) => {
  try {
    const eligible = await getDraftEligibleOpportunities();
    res.json(eligible);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/promote", adminEndpointLimiter, requireAdminKey, async (req, res) => {
  try {
    const { evidenceWindowHours, minScoreThreshold } = req.body;

    const criteria = {
      evidenceWindowHours: evidenceWindowHours || 72,
      minScoreThreshold: minScoreThreshold || 60,
    };

    const promotedCount = await autoPromotePredictions(criteria);

    res.json({
      success: true,
      promotedCount,
      message: `${promotedCount} predictions auto-promoted to published`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/promote-eligible", adminEndpointLimiter, requireAdminKey, async (req, res) => {
  try {
    const eligible = await getPromotionEligibleDrafts();
    res.json(eligible);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/verify", adminEndpointLimiter, requireAdminKey, async (req, res) => {
  try {
    const predictionId = parseInt(req.params.id);
    const { status, verificationEvidence, verificationUrl } = req.body;

    if (!["confirmed", "partially_confirmed", "failed"].includes(status)) {
      return res.status(400).json({
        error: "Status must be confirmed, partially_confirmed, or failed",
      });
    }

    const existing = await db
      .select()
      .from(predictions)
      .where(eq(predictions.id, predictionId))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: "Prediction not found" });
    }

    const pred = existing[0];
    const leadTimeDays = pred.publishedAt
      ? Math.floor((Date.now() - pred.publishedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    await db
      .update(predictions)
      .set({
        status,
        verifiedAt: new Date(),
        verificationEvidence: verificationEvidence || null,
        verificationUrl: verificationUrl || null,
        leadTimeDays,
      })
      .where(eq(predictions.id, predictionId));

    res.json({
      success: true,
      message: `Prediction ${status}`,
      leadTimeDays,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats", adminEndpointLimiter, requireAdminKey, async (req, res) => {
  try {
    const stats = await getPredictionStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", adminEndpointLimiter, requireAdminKey, async (req, res) => {
  try {
    const predictionId = parseInt(req.params.id);

    await db.delete(predictions).where(eq(predictions.id, predictionId));

    res.json({ success: true, message: "Prediction deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/publish", adminEndpointLimiter, requireAdminKey, async (req, res) => {
  try {
    const predictionId = parseInt(req.params.id);

    const [updated] = await db
      .update(predictions)
      .set({
        isPublished: true,
        status: 'pending',
      })
      .where(eq(predictions.id, predictionId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Prediction not found" });
    }

    res.json({ success: true, message: "Prediction published", prediction: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/discard", adminEndpointLimiter, requireAdminKey, async (req, res) => {
  try {
    const predictionId = parseInt(req.params.id);

    const [updated] = await db
      .update(predictions)
      .set({
        status: 'failed',
        isPublished: false,
      })
      .where(eq(predictions.id, predictionId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Prediction not found" });
    }

    res.json({ success: true, message: "Prediction discarded", prediction: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/top", publicEndpointLimiter, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const predictions = await predictionEngine.getTopPredictions(limit);

    return res.json({
      success: true,
      predictions,
      count: predictions.length,
    });
  } catch (err) {
    console.error("[Predictions] Failed to get top predictions:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve top predictions",
    });
  }
});

export default router;
