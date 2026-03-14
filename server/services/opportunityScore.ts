import { AggregatedSignal, PainSignalClass } from "../../shared/signals";
import { classifyPainSignal } from "./painClassifier";
import { getSourceWeight } from "./sourceWeights";

export interface OpportunityScoreBreakdown {
  painClass: PainSignalClass;
  painIntensity: number;
  demandRecurrence: number;
  marketGap: number;
  engagementDepth: number;
  monetizationFit: number;
  sourceWeight: number;
  finalScore: number;
}

function daysSince(date: Date): number {
  const then = date.getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function computePainIntensity(painClass: PainSignalClass): number {
  switch (painClass) {
    case "validation":
      return 30;
    case "complaint":
      return 26;
    case "workaround":
      return 24;
    case "request":
      return 18;
    case "job_signal":
      return 14;
    default:
      return 6;
  }
}

function computeDemandRecurrence(
  signal: AggregatedSignal,
  relatedSignals: AggregatedSignal[],
): number {
  const keyword = signal.keywords?.[0]?.toLowerCase();
  if (!keyword) return 0;

  const recurrenceCount = relatedSignals.filter((s) => {
    const keywords = (s.keywords || []).map((k) => k.toLowerCase());
    return keywords.includes(keyword) && daysSince(s.createdAt) <= 7;
  }).length;

  return Math.min(recurrenceCount * 5, 25);
}

function computeMarketGap(painClass: PainSignalClass, title: string): number {
  const lower = title.toLowerCase();

  if (painClass === "validation") return 20;
  if (painClass === "workaround") return 18;

  if (
    painClass === "request" &&
    (/looking for a tool|does anyone know|best tool for|is there a saas/i.test(lower))
  ) {
    return 16;
  }

  if (painClass === "complaint") return 12;

  return 4;
}

function computeEngagementDepth(signal: AggregatedSignal): number {
  const engagement = signal.engagement || 0;
  return Math.min(Math.round(engagement / 10), 15);
}

function computeMonetizationFit(signal: AggregatedSignal): number {
  const text = `${signal.title} ${(signal.keywords || []).join(" ")}`.toLowerCase();

  const b2bTerms =
    /\b(team|enterprise|workflow|compliance|security|ops|manager|developer|devops|finance|billing|analytics|automation|saas|api)\b/i;

  return b2bTerms.test(text) ? 10 : 4;
}

export function computeOpportunityScore(
  signal: AggregatedSignal,
  relatedSignals: AggregatedSignal[],
): OpportunityScoreBreakdown {
  const painClass = classifyPainSignal(signal.title);

  const painIntensity = computePainIntensity(painClass);
  const demandRecurrence = computeDemandRecurrence(signal, relatedSignals);
  const marketGap = computeMarketGap(painClass, signal.title);
  const engagementDepth = computeEngagementDepth(signal);
  const monetizationFit = computeMonetizationFit(signal);
  const sourceWeight = getSourceWeight(signal);

  const rawScore =
    painIntensity +
    demandRecurrence +
    marketGap +
    engagementDepth +
    monetizationFit;

  const finalScore = Math.min(100, Math.round(rawScore * sourceWeight));

  return {
    painClass,
    painIntensity,
    demandRecurrence,
    marketGap,
    engagementDepth,
    monetizationFit,
    sourceWeight,
    finalScore,
  };
}