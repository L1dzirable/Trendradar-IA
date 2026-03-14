export type LifecyclePhase = "emerging" | "rising" | "peaking" | "declining";

interface HistoryPoint {
  score: number;
  recordedAt: Date;
}

function dedupeByDay(history: HistoryPoint[]): HistoryPoint[] {
  const seen = new Map<string, HistoryPoint>();
  for (const point of history) {
    const day = point.recordedAt.toISOString().slice(0, 10);
    if (!seen.has(day)) seen.set(day, point);
  }
  return Array.from(seen.values()).sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
  );
}

export function classifyTrendLifecycle(
  history: HistoryPoint[]
): LifecyclePhase {
  const points = dedupeByDay(history);

  if (points.length < 3) return "emerging";

  const recent = points.slice(-3);
  const deltas = [
    recent[1].score - recent[0].score,
    recent[2].score - recent[1].score,
  ];

  const avgDelta = (deltas[0] + deltas[1]) / 2;
  const lastDelta = deltas[1];

  if (avgDelta > 3) return "rising";
  if (avgDelta < -3) return "declining";
  if (lastDelta >= -3 && lastDelta <= 3 && recent[2].score >= 50) return "peaking";

  return "emerging";
}

export function computeVelocityFromHistory(
  history: HistoryPoint[]
): number {
  const deduped = dedupeByDay(history);
  if (deduped.length < 2) return 0;

  const recent = deduped.slice(-5);
  const oldest = recent[0].score;
  const newest = recent[recent.length - 1].score;
  const days = Math.max(
    1,
    (recent[recent.length - 1].recordedAt.getTime() -
      recent[0].recordedAt.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return parseFloat(((newest - oldest) / days).toFixed(2));
}