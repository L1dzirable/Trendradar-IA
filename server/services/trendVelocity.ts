import type { AggregatedSignal } from "./signalAggregator";

export type VelocityStatus =
  | "accelerating"
  | "peaking"
  | "fading";

function daysSince(date: Date) {
  const then = date.getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24);
}

export function computeTrendVelocity(
  keyword: string,
  signals: AggregatedSignal[],
): VelocityStatus {

  const related = signals.filter((s) =>
    (s.keywords || [])
      .map((k) => k.toLowerCase())
      .includes(keyword.toLowerCase()),
  );

  const count7d = related.filter((s) => daysSince(s.createdAt) <= 7).length;

  const count14d = related.filter((s) => daysSince(s.createdAt) <= 14).length;

  if (count7d > count14d / 2) return "accelerating";

  if (count7d === Math.round(count14d / 2)) return "peaking";

  return "fading";
}