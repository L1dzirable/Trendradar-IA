import { db } from "../db";
import { predictions, opportunities } from "../../shared/schema";
import { eq, and, lt, gte, isNull } from "drizzle-orm";

interface PromotionCriteria {
  evidenceWindowHours: number;
  minScoreThreshold: number;
}

const DEFAULT_CRITERIA: PromotionCriteria = {
  evidenceWindowHours: 72,
  minScoreThreshold: 60,
};

export async function autoPromotePredictions(
  criteria: PromotionCriteria = DEFAULT_CRITERIA
): Promise<number> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - criteria.evidenceWindowHours);

  const eligibleDrafts = await db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.status, "draft"),
        eq(predictions.isPublished, false),
        lt(predictions.draftedAt, cutoffTime)
      )
    );

  let promotedCount = 0;

  for (const draft of eligibleDrafts) {
    const opportunity = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.id, draft.opportunityId))
      .limit(1);

    if (opportunity.length === 0) {
      continue;
    }

    const currentOpp = opportunity[0];
    const currentScore = currentOpp.score || 0;
    const currentSignalCount = ((currentOpp.signalIds as string[]) || []).length;

    if (
      currentScore >= criteria.minScoreThreshold &&
      currentSignalCount >= draft.draftSignalCount
    ) {
      await db
        .update(predictions)
        .set({
          isPublished: true,
          publishedAt: new Date(),
          status: "pending",
        })
        .where(eq(predictions.id, draft.id));

      promotedCount++;
    }
  }

  return promotedCount;
}

export async function getPromotionEligibleDrafts(
  criteria: PromotionCriteria = DEFAULT_CRITERIA
): Promise<any[]> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - criteria.evidenceWindowHours);

  const drafts = await db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.status, "draft"),
        eq(predictions.isPublished, false),
        lt(predictions.draftedAt, cutoffTime)
      )
    );

  const result = [];

  for (const draft of drafts) {
    const opportunity = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.id, draft.opportunityId))
      .limit(1);

    if (opportunity.length > 0) {
      const currentOpp = opportunity[0];
      const currentScore = currentOpp.score || 0;
      const currentSignalCount = ((currentOpp.signalIds as string[]) || []).length;

      result.push({
        prediction: draft,
        opportunity: currentOpp,
        currentScore,
        currentSignalCount,
        eligible:
          currentScore >= criteria.minScoreThreshold &&
          currentSignalCount >= draft.draftSignalCount,
      });
    }
  }

  return result;
}

export async function getPredictionStats(): Promise<{
  total: number;
  drafts: number;
  pending: number;
  confirmed: number;
  failed: number;
}> {
  const allPredictions = await db.select().from(predictions);

  return {
    total: allPredictions.length,
    drafts: allPredictions.filter((p) => p.status === "draft").length,
    pending: allPredictions.filter((p) => p.status === "pending").length,
    confirmed: allPredictions.filter((p) => p.status === "confirmed").length,
    failed: allPredictions.filter((p) => p.status === "failed").length,
  };
}
