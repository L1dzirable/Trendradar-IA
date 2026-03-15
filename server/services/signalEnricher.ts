import { db } from "../db";
import { signals } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { scoreSignal, getQualityFactorsAsRecord } from "./signalQualityScorer";
import type { Signal } from "./signalQualityScorer";

export async function enrichPersistedSignals(): Promise<void> {
  try {
    const unscoredSignals = await db
      .select()
      .from(signals)
      .where(eq(signals.qualityScore, 5));

    if (unscoredSignals.length === 0) {
      console.log("[signalEnricher] No unscored signals found");
      return;
    }

    console.log(`[signalEnricher] Scoring ${unscoredSignals.length} signals`);

    let scored = 0;
    for (const signal of unscoredSignals) {
      const signalData: Signal = {
        id: signal.id,
        source: signal.source,
        externalId: signal.externalId,
        title: signal.title,
        body: signal.body,
        url: signal.url,
        score: signal.score || 0,
        commentCount: signal.commentCount || 0,
        keyword: signal.keyword,
        rawJson: signal.rawJson,
        collectedAt: signal.collectedAt,
      };

      const qualityScore = scoreSignal(signalData);
      const qualityFactors = getQualityFactorsAsRecord(signalData);

      await db
        .update(signals)
        .set({
          qualityScore,
          qualityFactors,
        })
        .where(eq(signals.id, signal.id));

      scored++;
    }

    console.log(`[signalEnricher] Successfully scored ${scored} signals`);
  } catch (error: any) {
    console.error("[signalEnricher] Error enriching signals:", error.message);
  }
}
