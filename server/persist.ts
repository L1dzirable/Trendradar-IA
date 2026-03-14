import { db } from "./db";
import { signals, trendHistory, lifecycleChangeEvents } from "@shared/schema";
import { sql, eq, desc } from "drizzle-orm";

export type NewSignal = typeof signals.$inferInsert;

export type PersistedSignal = {
  id: number;
  externalId: string;
  source: string;
};

export async function persistSignals(
  data: any[]
): Promise<PersistedSignal[]> {
  try {
    if (!data || data.length === 0) return [];

    const rows: NewSignal[] = data.map((s) => ({
      source: s.source ?? "unknown",
      externalId: String(
  s.id ??
  s.external_id ??
  s.url ??
  `${s.source}:${s.title ?? "unknown"}`
),
      title: s.title ?? "",
body: s.body ?? "",
url: s.url ?? "",
score: s.score ?? 0,
commentCount: s.commentCount ?? s.comment_count ?? 0,
keyword: s.keyword ?? "",
      rawJson: s,
    }));

    const inserted = await db
      .insert(signals)
      .values(rows)
      .onConflictDoUpdate({
        target: [signals.source, signals.externalId],
        set: {
          collectedAt: sql`excluded.collected_at`,
        },
      })
      .returning({
        id: signals.id,
        externalId: signals.externalId,
        source: signals.source,
      });

    console.log(`[signals] saved ${inserted.length}`);

    return inserted;
  } catch (err) {
    console.error("[signals] persist error", err);
    return [];
  }
}

export async function recordTrendHistory(trends: any[]): Promise<void> {
  if (!trends.length) return;

  try {
    await db.insert(trendHistory).values(
      trends.map((t) => ({
        trendSlug: t.trendSlug,
        score: t.opportunityScore,
        signalCount: t.signalCount,
      }))
    );

    for (const trend of trends) {
      if (!trend.lifecycle) continue;

      const [latestEvent] = await db
        .select()
        .from(lifecycleChangeEvents)
        .where(eq(lifecycleChangeEvents.trendSlug, trend.trendSlug))
        .orderBy(desc(lifecycleChangeEvents.detectedAt))
        .limit(1);

      const previousLifecycle = latestEvent ? latestEvent.toLifecycle : null;

      if (previousLifecycle !== trend.lifecycle) {
        await db.insert(lifecycleChangeEvents).values({
          trendSlug: trend.trendSlug,
          fromLifecycle: previousLifecycle,
          toLifecycle: trend.lifecycle,
        });

        console.log(`[lifecycle] ${trend.trendSlug}: ${previousLifecycle || 'new'} → ${trend.lifecycle}`);
      }
    }
  } catch (err) {
    console.error("[trendHistory] failed to record:", err);
  }
}