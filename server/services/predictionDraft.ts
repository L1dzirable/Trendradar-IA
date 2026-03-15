import { db } from "../db";
import { predictions, opportunities, signals } from "../../shared/schema";
import { eq, and, isNull, gte, inArray } from "drizzle-orm";

interface DraftCriteria {
  minScore: number;
  minSignalCount: number;
}

const DEFAULT_CRITERIA: DraftCriteria = {
  minScore: 70,
  minSignalCount: 5,
};

export async function autoDraftPredictions(
  criteria: DraftCriteria = DEFAULT_CRITERIA
): Promise<number> {
  const eligibleOpportunities = await db
    .select()
    .from(opportunities)
    .where(gte(opportunities.score, criteria.minScore));

  let draftedCount = 0;

  for (const opp of eligibleOpportunities) {
    const signalIds = (opp.signalIds as string[]) || [];

    if (signalIds.length < criteria.minSignalCount) {
      continue;
    }

    const existingDraft = await db
      .select()
      .from(predictions)
      .where(eq(predictions.opportunityId, opp.id))
      .limit(1);

    if (existingDraft.length > 0) {
      continue;
    }

    const oppSignals = await db
      .select()
      .from(signals)
      .where(
        eq(
          signals.id,
          parseInt(signalIds[0])
        )
      )
      .limit(signalIds.length);

    const signalSnapshot = oppSignals.map((s) => ({
      id: s.id,
      source: s.source,
      title: s.title,
      score: s.score,
      commentCount: s.commentCount,
      url: s.url,
      collectedAt: s.collectedAt,
    }));

    const predictionText = generatePredictionText(opp);
    const methodologyNotes = generateMethodologyNotes(opp, signalSnapshot);

    await db.insert(predictions).values({
      opportunityId: opp.id,
      predictionText,
      methodologyNotes,
      draftScore: opp.score || 0,
      draftSignalCount: signalIds.length,
      draftSignalSnapshot: signalSnapshot,
      status: "draft",
      isPublished: false,
    });

    draftedCount++;
  }

  return draftedCount;
}

function generatePredictionText(opp: any): string {
  return `Prediction: ${opp.title} will gain significant traction in the next 3-6 months based on emerging signals across ${((opp.sources as string[]) || []).join(", ")}.`;
}

function generateMethodologyNotes(opp: any, signalSnapshot: any[]): string {
  const sources = (opp.sources as string[]) || [];
  const notes = [
    `## Prediction Methodology`,
    ``,
    `**Opportunity Score:** ${opp.score}/100`,
    `**Signal Count:** ${signalSnapshot.length}`,
    `**Signal Sources:** ${sources.join(", ")}`,
    ``,
    `### Signal Breakdown`,
    ``,
    ...signalSnapshot.map((s, i) =>
      `${i + 1}. **${s.source.toUpperCase()}**: ${s.title} (score: ${s.score}, comments: ${s.commentCount})`
    ),
    ``,
    `### Key Indicators`,
    `- High engagement across multiple platforms`,
    `- Growing discussion volume`,
    `- Cross-platform signal convergence`,
    ``,
    `*Auto-generated at ${new Date().toISOString()}*`,
  ].join("\n");

  return notes;
}

export async function getDraftEligibleOpportunities(
  criteria: DraftCriteria = DEFAULT_CRITERIA
): Promise<any[]> {
  const eligible = await db
    .select()
    .from(opportunities)
    .where(gte(opportunities.score, criteria.minScore));

  const result = [];
  for (const opp of eligible) {
    const signalIds = (opp.signalIds as string[]) || [];
    if (signalIds.length >= criteria.minSignalCount) {
      const existing = await db
        .select()
        .from(predictions)
        .where(eq(predictions.opportunityId, opp.id))
        .limit(1);

      if (existing.length === 0) {
        result.push(opp);
      }
    }
  }

  return result;
}
