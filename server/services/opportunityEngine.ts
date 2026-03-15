import { getAggregatedSignals } from "./signalAggregator";
import { computeOpportunityScore } from "./opportunityScore";
import type { AggregatedSignal } from "./signalAggregator";
import type { EnrichedOpportunity, LifecyclePhase, MacroDriver } from "../../shared/signals";
import { computeTrendVelocity } from "./trendVelocity";
import { detectGapType } from "./marketGap";
import { dedupeOpportunities } from './dedupeOpportunities';
import { normalizeTitle } from "./signalNormalizer";
import { canonicalizeTrend, buildTrendSlug } from './trendNormalizer';
import { recordTrendHistory } from "../persist";
import { classifyTrendLifecycle, computeVelocityFromHistory } from "./trendLifecycle";
import { db } from "../db";
import { trendHistory } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";
import { classifyMacroDriver } from "./macroClassifier";

type SignalSource = "reddit" | "hackernews" | "producthunt";


interface PainMapping {
  pain: string;
  trendName: (keyword: string) => string;
  explanation: (keyword: string, signalTitle: string) => string;
  businessIdea: (keyword: string) => string;
  monetization: string;
  difficultyScore: number;
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "have",
  "been",
  "are",
  "was",
  "were",
  "will",
  "would",
  "could",
  "should",
  "about",
  "there",
  "their",
  "them",
  "they",
  "you",
  "our",
  "out",
  "how",
  "what",
  "when",
  "where",
  "why",
  "can",
  "more",
  "than",
  "just",
  "over",
  "under",
  "using",
  "used",
  "need",
  "needs",
  "want",
  "wants",
  "make",
  "makes",
  "built",
  "build",
  "tool",
  "tools",
  "platform",
  "software",
  "app",
  "apps",
]);

const GENERIC_TERMS = new Set([
  "tool","tools","platform","solution","solutions","software",
  "product","products","service","services","system","systems",
  "startup","startups","saas","app","apps",
  "build","launch","scale","team","teams"
]);


const PAIN_MAPPINGS: PainMapping[] = [
  {
    pain: "Implementation difficulty",
    trendName: (k) => `${capitalize(k)} setup tool`,
    explanation: (k, title) =>
      `"${title}" suggests teams want ${k} solutions without implementation friction.`,
    businessIdea: (k) =>
      `A guided no-code setup wizard for ${k} that configures everything in minutes with minimal technical effort.`,
    monetization: "Freemium + $29/mo team plan",
    difficultyScore: 4,
  },
  {
    pain: "Unmet need or knowledge gap",
    trendName: (k) => `${capitalize(k)} knowledge platform`,
    explanation: (k, title) =>
      `"${title}" shows fragmented demand for clearer workflows, benchmarks, and practical know-how in ${k}.`,
    businessIdea: (k) =>
      `A curated ${k} intelligence hub with workflows, templates, benchmark data, and actionable weekly digests.`,
    monetization: "Free newsletter + $19/mo premium",
    difficultyScore: 3,
  },
  {
    pain: "Cost",
    trendName: (k) => `Affordable ${capitalize(k)} for SMBs`,
    explanation: (k, title) =>
      `"${title}" indicates users want ${k} solutions that feel useful without enterprise pricing.`,
    businessIdea: (k) =>
      `A lightweight ${k} SaaS focused on SMBs with simple onboarding, core features only, and transparent pricing.`,
    monetization: "$19-$49/mo subscription",
    difficultyScore: 5,
  },
  {
    pain: "Performance",
    trendName: (k) => `High-performance ${capitalize(k)} layer`,
    explanation: (k, title) =>
      `"${title}" points to speed, reliability, or scale pain in existing ${k} workflows.`,
    businessIdea: (k) =>
      `A performance optimization layer for ${k} with analytics, bottleneck detection, and one-click recommendations.`,
    monetization: "Usage-based + pro plan",
    difficultyScore: 7,
  },
  {
    pain: "User experience",
    trendName: (k) => `Redesigned ${capitalize(k)} experience`,
    explanation: (k, title) =>
      `"${title}" hints that current ${k} products solve the problem poorly from a UX standpoint.`,
    businessIdea: (k) =>
      `An opinionated ${k} product with cleaner UX, guided onboarding, and faster time-to-value.`,
    monetization: "Freemium + Pro + Team",
    difficultyScore: 4,
  },
  {
    pain: "Security/Privacy",
    trendName: (k) => `Privacy-first ${capitalize(k)}`,
    explanation: (k, title) =>
      `"${title}" suggests users are wary of trust, privacy, or control issues in current ${k} tools.`,
    businessIdea: (k) =>
      `A privacy-first ${k} platform with audit logs, self-hosted option, granular permissions, and clear data controls.`,
    monetization: "$49/mo pro or self-hosted license",
    difficultyScore: 6,
  },
  {
    pain: "Time/Efficiency",
    trendName: (k) => `${capitalize(k)} automation layer`,
    explanation: (k, title) =>
      `"${title}" reveals repeat manual work around ${k} that users want automated.`,
    businessIdea: (k) =>
      `A workflow automation tool for ${k} with templates, triggers, and integrations for repetitive tasks.`,
    monetization: "Per-seat pricing + automation credits",
    difficultyScore: 5,
  },
];

// Preferred SaaS markets
const SAAS_CATEGORIES = new Set([
  "workflow",
  "automation",
  "monitoring",
  "analytics",
  "compliance",
  "security",
  "payments",
  "billing",
  "reporting",
  "scheduling",
  "authentication",
  "authorization",
  "observability",
  "alerting",
  "agents",
  "ai",
  "devtools",
  "integration",
]);

// Safe fallback keywords if nothing valid is found
const FALLBACK_KEYWORDS = [
  "workflow automation",
  "team collaboration",
  "data analytics",
  "api integration",
  "monitoring",
  "compliance",
];

const QUALIFIER_NORMALISATION_MAP: Record<string,string> = {
  "pull request": "Code Review",
  "pull requests": "Code Review",
  "code review": "Code Review",

  "compliance report": "Compliance",
  "compliance reporting": "Compliance",
  "compliance": "Compliance",

  "customer support": "Customer Support",
  "support team": "Customer Support",

  "developers": "Developers",
  "dev team": "Developers",

  "small business": "Small Businesses",

  "reporting": "Reporting",
  "audit": "Audit & Compliance",

  "data pipeline": "Data Pipelines",

  "api": "API Integrations",

  "saas": "SaaS Teams",
  "startup": "Startups",
  "enterprise": "Enterprise Teams"
};

const NOISE_WORDS = new Set([
  "new",
  "ship",
  "launch",
  "release",
  "update",
  "v1",
  "v2",
  "beta",
  "alpha",
  "oss",
  "open",
  "free",
  "my",
  "our",
  "we",
  "i",
  "the"
]);

const FALLBACK_MAPPING: PainMapping = {
  pain: "General",
  trendName: (k) => `Vertical SaaS for ${capitalize(k)}`,
  explanation: (k, title) =>
    `"${title}" indicates demand is forming around ${k}, but existing products still feel broad or incomplete.`,
  businessIdea: (k) =>
    `A focused vertical SaaS for ${k}, built around one painful workflow and expanded from real user demand.`,
  monetization: "$29-$79/mo subscription",
  difficultyScore: 5,
};

function isProperNoun(word: string, originalTitle: string): boolean {
  const words = originalTitle.split(/\s+/);

  return words.some((w) => {
    if (w.length < 3) return false;

    const cleaned = w.replace(/[^a-zA-Z0-9]/g, "");
    const lower = cleaned.toLowerCase();

    return (
      cleaned[0] === cleaned[0]?.toUpperCase() &&
      lower === word
    );
  });
}

function capitalize(value: string): string {
  if (!value) return value;

  if (value === "ai") return "AI";
  if (value === "ai agents") return "AI Agents";

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function extractBigrams(text: string): string[] {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  const bigrams: string[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(words[i] + " " + words[i + 1]);
  }

  return bigrams;
}

function pickMapping(painPoint?: string): PainMapping {
  if (!painPoint) return FALLBACK_MAPPING;
  const normalizedPain = normalize(painPoint);

  return (
    PAIN_MAPPINGS.find((mapping) =>
      normalizedPain.includes(normalize(mapping.pain)),
    ) ?? FALLBACK_MAPPING
  );
}

function pickPrimaryKeyword(signal: AggregatedSignal, topic?: string): string {
  const titleLower = signal.title.toLowerCase();

  // 1. Highest priority: exact SaaS category found in title
  for (const category of Array.from(SAAS_CATEGORIES)) {
    if (titleLower.includes(category)) {
      return category;
    }
  }

  // 2. Score keywords: reward SaaS categories, penalize proper nouns
  const scored = [...(signal.keywords || [])]
    .map((k) => normalize(k))
    .filter((k) => k.length >= 3 && !STOPWORDS.has(k))
    .map((k) => ({
      keyword: k,
      score:
        (SAAS_CATEGORIES.has(k) ? 20 : 0) +
        (isProperNoun(k, signal.title) ? -50 : 0) +
        k.length,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored[0].keyword;
  }

  // 3. Bigrams from title, but only if they are not proper nouns
  const safeBigrams = extractBigrams(signal.title).filter((bigram) =>
    bigram.split(" ").every((w) => !isProperNoun(w, signal.title))
  );

  if (safeBigrams.length > 0) {
    return safeBigrams[0];
  }

  // 4. Topic hint if provided
  if (topic?.trim()) {
    return normalize(topic);
  }

  // 5. Safe fallback
  const idx = signal.title.length % FALLBACK_KEYWORDS.length;
  return FALLBACK_KEYWORDS[idx];
}

function scoreSignalForTopic(signal: AggregatedSignal, topic?: string): number {
  if (!topic || !topic.trim()) return signal.score;

  const q = topic.trim().toLowerCase();
  const terms = q.split(/\s+/); // support multi-word queries

  const title = signal.title.toLowerCase();
  const pain = (signal.inferredPainPoint || "").toLowerCase();
  const keywords = Array.from(
  new Set((signal.keywords ?? []).map((k) => k.toLowerCase()))
);

  const keywordJoined = keywords.join(" ");
  let bonus = 0;

  // Exact full-query matches (highest value)
  if (title.includes(q)) bonus += 60;
  if (pain.includes(q)) bonus += 30;
  if (keywordJoined.includes(q)) bonus += 40;

  // Partial term matches (for multi-word searches)
  for (const term of terms) {
    if (term.length < 3) continue; // skip very short terms

    if (title.includes(term)) bonus += 15;
    if (pain.includes(term)) bonus += 10;
    if (keywordJoined.includes(term)) bonus += 12;
  }

  if (bonus === 0) return 0;

  return signal.score + bonus;
}

function inferPainPoint(signal: any, primaryKeyword: string): string {
  const title = (signal.title || "").toLowerCase();

  if (title.includes("sandbox") || title.includes("safehouse")) {
    return "testing and sandboxing AI agents safely";
  }

  if (title.includes("debug") || title.includes("error")) {
    return "debugging AI agent failures and prompt issues";
  }

  if (title.includes("monitor") || title.includes("tracking")) {
    return "monitoring AI agent behaviour in production";
  }

  if (title.includes("workflow") || title.includes("automation")) {
    return "orchestrating multi-agent workflows";
  }

  if (title.includes("prompt")) {
    return "optimising prompts across AI agents";
  }

  if (title.includes("agent")) {
  return "managing and orchestrating AI agents";
  }

  return `managing ${primaryKeyword} workflows efficiently`;

 }

const CATEGORY_PREFIXES: Record<string, string> = {
  ai: "AI",
  automation: "Workflow Automation",
  fintech: "Fintech",
  devtools: "Developer Tooling",
  compliance: "Compliance",
  analytics: "Analytics",
  payments: "Payments",
};

function composeTrendName(primaryKeyword: string, signal: AggregatedSignal): string {
  const prefix = CATEGORY_PREFIXES[primaryKeyword] || capitalize(primaryKeyword);

  const cleanTitle = signal.title
    .replace(/^(show hn|ask hn|tell hn):?/i, "")
    .replace(/\[.*?\]/g, "")
    .trim();

  const lower = cleanTitle.toLowerCase();

  const patterns: RegExp[] = [
  /\bfor\s+([a-z][a-z\s]{2,40})/,
  /\bto\s+([a-z][a-z\s]{2,35})/,
  /\bbuilt\s+for\s+([a-z][a-z\s]{2,35})/,
  /\bthat\s+([a-z][a-z\s]{2,30})/
];

  let rawQualifier: string | null = null;

for (const pattern of patterns) {
  const match = lower.match(pattern);
  if (match) {
    rawQualifier = match[1].trim();
    break;
  }
}
  if (!rawQualifier) return prefix;
  
const words = rawQualifier.split(/\s+/).slice(0, 3);
const truncated = words.join(" ");

  const normalised = QUALIFIER_NORMALISATION_MAP[truncated];
if (normalised) {
  return `${prefix} for ${normalised}`;
}

if (NOISE_WORDS.has(words[0])) {
  return prefix;
}

return `${prefix} for ${capitalize(truncated)}`;
}

function getOpportunityLabel(score: number) {
  if (score >= 80) return "High";
  if (score >= 60) return "Watch";
  if (score >= 40) return "Emerging";
  return "Noise";
}

function buildTrendFromSignal(
  signal: AggregatedSignal,
  allSignals: AggregatedSignal[],
  index: number,
  topic?: string,
  ): EnrichedOpportunity | null {

  const cleanTitle = normalizeTitle(signal.title);
if (cleanTitle === null) {
  console.log(`[normalize] REJECTED: "${signal.title}"`);
  return null;
}
  
  const painPoint = signal.inferredPainPoint || "General";
  const mapping = pickMapping(painPoint);
  const primaryKeyword = pickPrimaryKeyword(signal, topic);
  const pain = inferPainPoint(signal, primaryKeyword);

  const scoreBreakdown = computeOpportunityScore(signal, allSignals);
  const opportunityScore = scoreBreakdown.finalScore;
  const opportunityLabel = getOpportunityLabel(opportunityScore);
  console.log(`[score] "${cleanTitle}" score=${opportunityScore} label=${opportunityLabel}`);
  const velocity = computeTrendVelocity(primaryKeyword, allSignals);
  const trendName = cleanTitle;
  const canonical = canonicalizeTrend(trendName);
  const displayName = canonical ?? trendName;
  const trendSlug = buildTrendSlug(displayName);
  
  return {
  topic: painPoint || topic || "Emerging trend",

    trendName: displayName,
    trendSlug,

    signalCount: 1,

    painClass: scoreBreakdown.painClass,
    opportunityLabel,

  explanation: `Signals from ${signal.source} suggest growing demand for tools solving "${pain}". Strong signal around ${capitalize(primaryKeyword)}.`,

  businessIdea: `Build a SaaS platform focused on "${pain}". Start with a simple product helping teams handle this problem faster and expand with analytics, automation and integrations.`,

  monetization: mapping.monetization,
  difficultyScore: mapping.difficultyScore,
  opportunityScore,

    createdAt: signal.createdAt,

 scoreFactors: {
  painIntensity: scoreBreakdown.painIntensity,
  demandRecurrence: scoreBreakdown.demandRecurrence,
  marketGap: scoreBreakdown.marketGap,
  engagementDepth: scoreBreakdown.engagementDepth,
  monetisationFit: scoreBreakdown.monetizationFit,
  total: scoreBreakdown.finalScore
 },

  velocity: 0,
  lifecycle: "emerging" as LifecyclePhase,
  macroDriver: "unknown" as MacroDriver,
  gapType: detectGapType(signal),
  icp: "Early stage SaaS teams",
  competitorGap: "Existing tools are fragmented or complex",
  earlyCustomerHypothesis: "Teams currently solve this with spreadsheets or manual workflows"
};
}

function buildTrendFromSignalGroup(
  canonical: string,
  groupSignals: AggregatedSignal[],
  allSignals: AggregatedSignal[],
  topic?: string
): EnrichedOpportunity | null {

  const primary = groupSignals.reduce((best, s) =>
    s.score > best.score ? s : best
  );

  const opp = buildTrendFromSignal(primary, allSignals, 0, topic);
  if (!opp) return null;

  return {
  ...opp,
  trendName: canonical,
  trendSlug: buildTrendSlug(canonical),
  signalCount: groupSignals.length,
  lifecycle: "emerging",
  macroDriver: "unknown",
};
}

async function fetchTrendHistory(
  trendSlug: string
): Promise<{ score: number; recordedAt: Date }[]> {
  try {
    return await db
      .select({
        score: trendHistory.score,
        recordedAt: trendHistory.recordedAt,
      })
      .from(trendHistory)
      .where(eq(trendHistory.trendSlug, trendSlug))
      .orderBy(desc(trendHistory.recordedAt))
      .limit(5);
  } catch (err) {
    console.error(`[trendHistory] fetch failed for ${trendSlug}:`, err);
    return [];
  }
}

async function enrichOpportunities(
  opportunities: EnrichedOpportunity[],
  groupSignalsMap: Map<string, AggregatedSignal[]>
): Promise<EnrichedOpportunity[]> {
  return Promise.all(
    opportunities.map(async (opp) => {
      const history = await fetchTrendHistory(opp.trendSlug);
      const lifecycle = classifyTrendLifecycle(history);
      const velocity = computeVelocityFromHistory(history);
      const signals = groupSignalsMap.get(opp.trendSlug) ?? [];
      const macroDriver = classifyMacroDriver(signals);
      return { ...opp, lifecycle, velocity, macroDriver };
    })
  );
}

export async function generateOpportunities(
  topic?: string,
  forceRefresh = false,
): Promise<EnrichedOpportunity[]> {
  const signals = await getAggregatedSignals(forceRefresh);

  if (!signals.length) return [];

  const ranked = [...signals]
  .map((signal) => ({
    signal,
    rank: scoreSignalForTopic(signal, topic),
  }))
  .filter((item) => item.rank > 0)
  .sort((a, b) => b.rank - a.rank);

const topSignals = ranked
  .slice(0, 6)
  .map((item) => item.signal);

  const groups = new Map<string, AggregatedSignal[]>();
const slugToCanonical = new Map<string, string>();

for (const signal of topSignals) {
  const cleanTitle = normalizeTitle(signal.title);
  if (!cleanTitle) continue;

  const canonical = canonicalizeTrend(cleanTitle) ?? cleanTitle;
  const slug = buildTrendSlug(canonical);

  if (!groups.has(slug)) {
    groups.set(slug, []);
    slugToCanonical.set(slug, canonical);
  }

  groups.get(slug)!.push(signal);
}

const trends = Array.from(groups.entries())
  .map(([slug, groupSignals]) =>
    buildTrendFromSignalGroup(
      slugToCanonical.get(slug)!,
      groupSignals,
      signals,
      topic
    )
  )
  .filter((trend): trend is EnrichedOpportunity =>
    trend !== null && trend.opportunityLabel !== "Noise"
  );

  console.log(`[engine] topSignals=${topSignals.length} trendsAfterFilter=${trends.length}`);
  
const seen = new Set<string>();

const deduped = trends.filter((t) => {
  const slug = t.trendName.toLowerCase();
  if (seen.has(slug)) return false;
  seen.add(slug);
  return true;
});

  console.log("[gate-debug]", deduped.map(o => ({
  slug: o.trendSlug,
  score: o.opportunityScore,
  signals: o.signalCount,
})));

  const confident = deduped.filter(o =>
  o.signalCount >= 1 && o.opportunityScore >= 25
);

  await recordTrendHistory(deduped);
  const enriched = await enrichOpportunities(confident, groups);

  console.log(JSON.stringify({
  event: "pipeline_run",
  ts: new Date().toISOString(),
  signals_in: signals.length,
  top_signals: topSignals.length,
  trends_after_filter: trends.length,
  after_dedup: deduped.length,
  lifecycle_dist: enriched.reduce((acc, o) => {
    acc[o.lifecycle] = (acc[o.lifecycle] || 0) + 1;
    return acc;
  }, {} as Record<string, number>),
  macro_dist: enriched.reduce((acc, o) => {
    const key = o.macroDriver ?? "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>),
  score_range: deduped.length
    ? [
        Math.min(...deduped.map(o => o.opportunityScore)),
        Math.max(...deduped.map(o => o.opportunityScore)),
      ]
    : [],
}));

  try {
    const { autoDraftPredictions } = await import("./predictionDraft");
    const draftedCount = await autoDraftPredictions();
    if (draftedCount > 0) {
      console.log(`[predictions] Auto-drafted ${draftedCount} predictions`);
    }
  } catch (error) {
    console.error("[predictions] Auto-draft failed:", error);
  }

return enriched;
}

// simple in-memory cache
const CACHE_TTL = 1000 * 60 * 5;
let cachedKey = "";
let cachedData: EnrichedOpportunity[] = [];
let lastFetchTime = 0;

export async function getCachedOpportunities(
  topic?: string,
  forceRefresh = false,
): Promise<EnrichedOpportunity[]> {
  const key = (topic || "").trim().toLowerCase();
  const now = Date.now();

  if (
    !forceRefresh &&
    cachedData.length > 0 &&
    cachedKey === key &&
    now - lastFetchTime < CACHE_TTL
  ) {
    return cachedData;
  }

  const opportunities = await generateOpportunities(topic, forceRefresh);

  cachedKey = key;
cachedData = dedupeOpportunities(opportunities);
lastFetchTime = now;
8
  return cachedData;
}