import { db } from "../db";
import { predictions, opportunities } from "../../shared/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import { getCachedOpportunities } from "./opportunityEngine";
import type { EnrichedOpportunity } from "../../shared/signals";

export async function runPredictionDrafter(): Promise<void> {
  try {
    const stats = {
      draftsCreated: 0,
      promotedToPending: 0,
      expired: 0,
    };

    const currentOpportunities = await getCachedOpportunities(undefined, false);

    const qualifyingOpportunities = currentOpportunities.filter(
      (opp) => opp.opportunityScore > 70 && opp.signalCount >= 5
    );

    for (const opp of qualifyingOpportunities) {
      await createDraftPrediction(opp, stats);
    }

    await promoteDraftsToPending(currentOpportunities, stats);

    console.log(
      `[predictionDrafter] ${stats.draftsCreated} drafts created, ${stats.promotedToPending} promoted to pending, ${stats.expired} expired`
    );
  } catch (error: any) {
    console.error('[predictionDrafter] error:', error.message);
    throw error;
  }
}

async function createDraftPrediction(
  opp: EnrichedOpportunity,
  stats: { draftsCreated: number }
): Promise<void> {
  const existingPredictions = await db
    .select()
    .from(predictions)
    .innerJoin(opportunities, eq(predictions.opportunityId, opportunities.id))
    .where(
      and(
        eq(opportunities.title, opp.trendName),
        sql`${predictions.status} != 'failed'`
      )
    )
    .limit(1);

  if (existingPredictions.length > 0) {
    return;
  }

  let opportunity = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.title, opp.trendName))
    .limit(1);

  let oppId: string;

  if (opportunity.length === 0) {
    const [newOpp] = await db
      .insert(opportunities)
      .values({
        title: opp.trendName,
        description: opp.explanation,
        category: opp.macroDriver || 'unknown',
        score: opp.opportunityScore,
        sources: opp.sources || [],
        signalIds: [],
      })
      .returning();
    oppId = newOpp.id;
  } else {
    oppId = opportunity[0].id;
  }

  const predictionText = generatePredictionText(opp);
  const methodologyNotes = JSON.stringify(opp, null, 2);

  await db.insert(predictions).values({
    opportunityId: oppId,
    predictionText,
    methodologyNotes,
    draftScore: opp.opportunityScore,
    draftSignalCount: opp.signalCount,
    draftSignalSnapshot: [],
    publishedAt: new Date(),
    status: 'draft',
    isPublished: false,
    autoCreated: true,
  });

  stats.draftsCreated++;
}

function generatePredictionText(opp: EnrichedOpportunity): string {
  return `TrendRadar detected ${opp.trendName} as a high-confidence emerging opportunity (score: ${opp.opportunityScore}/100). Signal evidence: ${opp.signalCount} signals across ${opp.macroDriver || 'unknown'} macro driver. Leading indicators: ${opp.painClass || 'unknown'} pain class, ${opp.lifecycle} lifecycle stage. Business hypothesis: ${opp.businessIdea}`;
}

async function promoteDraftsToPending(
  currentOpportunities: EnrichedOpportunity[],
  stats: { promotedToPending: number; expired: number }
): Promise<void> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - 72);

  const draftPredictions = await db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.status, 'draft'),
        eq(predictions.isPublished, false),
        eq(predictions.autoCreated, true),
        lt(predictions.publishedAt, cutoffTime)
      )
    );

  for (const draft of draftPredictions) {
    if (!draft.publishedAt) continue;

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

    if (currentScore >= 60 && currentSignalCount >= draft.draftSignalCount) {
      await db
        .update(predictions)
        .set({
          status: 'pending',
          isPublished: true,
        })
        .where(eq(predictions.id, draft.id));

      stats.promotedToPending++;
    } else if (currentScore < 60) {
      await db
        .update(predictions)
        .set({
          status: 'failed',
          isPublished: false,
        })
        .where(eq(predictions.id, draft.id));

      stats.expired++;
    }
  }
}
