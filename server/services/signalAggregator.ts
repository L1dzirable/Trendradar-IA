/**
 * Signal Aggregator Service
 * Combines signals from multiple sources, deduplicates, and ranks them
 */

import { getRedditSignals } from "./redditSignals";
import { getHackerNewsSignals } from "./hackerNewsSignals";
import { getProductHuntSignals } from "./productHuntSignals";
import { persistSignals } from "../persist";
import { fetchGitHubSignals } from './githubSignals';
import { upsertConceptsFromSignal } from "./weakSignal/conceptExtractor";
import { writeEdgeSnapshots } from "./weakSignal/edgeSnapshotWriter";
import type { SignalForExtraction } from "./weakSignal/conceptExtractor";

export interface AggregatedSignal {
  id: string;
  title: string;
  source: "reddit" | "hackernews" | "producthunt" | "github";
  engagement: number;
  keywords: string[];
  inferredPainPoint?: string;
  url: string;
  createdAt: Date;
  score: number;
  duplicateCount: number;
  sourceScore: number;
}

const OPPORTUNITY_KEYWORDS = [
  "saas", "startup", "tool", "api", "platform", "automation",
  "software", "productivity", "workflow", "integration", "app",
  "service", "business", "market", "revenue", "customer", "problem",
];

function isOpportunitySignal(title: string, source: string): boolean {
  if (source === 'hackernews' || source === 'github') {
    return true;
  }
  const lower = title.toLowerCase();
  return OPPORTUNITY_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance calculation
 */
function getEditDistance(s1: string, s2: string): number {
  const costs = [];
  
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  
  return costs[s2.length];
}

/**
 * Calculate keyword overlap
 */
function getKeywordOverlap(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 && keywords2.length === 0) return 1;
  if (keywords1.length === 0 || keywords2.length === 0) return 0;
  
  const set2 = new Set(keywords2);
  const overlaps = keywords1.filter(k => set2.has(k)).length;
  const totalUnique = new Set([...keywords1, ...keywords2]).size;
  
  return overlaps > 0 ? overlaps / totalUnique : 0;
}

/**
 * Check if two signals are duplicates or near-duplicates
 */
function areSimilarSignals(sig1: AggregatedSignal, sig2: AggregatedSignal): boolean {
  // Title similarity (60%+ threshold)
  const titleSim = calculateSimilarity(sig1.title, sig2.title);
  if (titleSim > 0.6) return true;
  
  // Keyword overlap (50%+ threshold)
  const keywordOverlap = getKeywordOverlap(sig1.keywords, sig2.keywords);
  if (keywordOverlap > 0.5 && sig1.keywords.length > 2) return true;
  
  return false;
}

/**
 * Convert API signals to internal format
 */
function normalizeSignals(
  data: any[],
  source: "reddit" | "hackernews" | "producthunt" | "github"
): AggregatedSignal[] {
  return data.map(signal => {
    let engagement = 0;
    let sourceScore = 0;
    
    if (source === "reddit") {
      engagement = signal.upvotes + (signal.comments * 2);
      sourceScore = signal.score || 0;
    } else if (source === "hackernews") {
      engagement = signal.score + (signal.comments * 2);
      sourceScore = signal.score_ranking || 0;
    } else if (source === "producthunt") {
      engagement = signal.votes + (signal.comments ? signal.comments * 2 : 0);
      sourceScore = signal.score_ranking || 0;
    }
    
    return {
      id: signal.id,
      title: signal.title || signal.name || "",
      source,
      engagement,
      keywords: signal.keywords || [],
      inferredPainPoint: signal.inferredPainPoint,
      url: signal.url,
      createdAt: new Date(signal.createdAt),
      score: sourceScore,
      duplicateCount: 0,
      sourceScore,
    };
  });
}

/**
 * Deduplicate and cluster similar signals
 */
function deduplicateSignals(signals: AggregatedSignal[]): AggregatedSignal[] {
  const seen = new Set<string>();
  const clusters: AggregatedSignal[][] = [];
  
  for (const signal of signals) {
    if (seen.has(signal.id)) continue;
    
    // Find similar signals
    const cluster = [signal];
    for (const other of signals) {
      if (other.id === signal.id || seen.has(other.id)) continue;
      if (areSimilarSignals(signal, other)) {
        cluster.push(other);
        seen.add(other.id);
      }
    }
    
    seen.add(signal.id);
    clusters.push(cluster);
  }
  
  // Keep best signal from each cluster, mark duplicates
  const deduped: AggregatedSignal[] = [];
  for (const cluster of clusters) {
    if (cluster.length === 0) continue;
    
    // Pick signal with highest engagement as primary
    const primary = cluster.reduce((best, current) => 
      current.engagement > best.engagement ? current : best
    );
    
    primary.duplicateCount = cluster.length - 1;
    deduped.push(primary);
  }
  
  return deduped;
}

/**
 * Calculate composite score for ranking
 */
function calculateCompositeScore(signal: AggregatedSignal): number {
  // Factor 1: Engagement score (normalized to 0-40)
  const maxEngagement = 1000;
  const engagementScore = Math.min(40, (signal.engagement / maxEngagement) * 40);
  
  // Factor 2: Source platform score (0-30)
  const sourceScore = Math.min(30, signal.sourceScore * 0.3);
  
  // Factor 3: Recency boost (0-20)
  const ageInDays = (Date.now() - signal.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const recencyBoost = Math.max(0, 20 - (ageInDays * 2));
  
  // Factor 4: Cross-source signals bonus (0-10)
  const duplicateBonus = signal.duplicateCount > 0 ? Math.min(10, signal.duplicateCount * 3) : 0;
  
  return engagementScore + sourceScore + recencyBoost + duplicateBonus;
}

/**
 * Fetch and aggregate all signals
 */
export async function fetchAggregatedSignals(): Promise<AggregatedSignal[]> {
  try {
    // Fetch from all sources in parallel
    const [redditData, hnData, phData, githubData] = await Promise.all([
  getRedditSignals(),
  getHackerNewsSignals(),
  getProductHuntSignals(),
  fetchGitHubSignals(),
]);

    // Normalize to common format
    const redditSignals = normalizeSignals(redditData, "reddit");
    const hnSignals = normalizeSignals(hnData, "hackernews");
    const phSignals = normalizeSignals(phData, "producthunt");
    const githubSignals = normalizeSignals(githubData, "github");
    // Combine all signals
    const allSignals = [...redditSignals, ...hnSignals, ...phSignals, ...githubSignals];
const filteredSignals = allSignals.filter((s) => isOpportunitySignal(s.title, s.source));



    const uniqueSignals = Array.from(
  new Map(
    filteredSignals.map((s) => [`${s.source}::${s.id}`, s])
  ).values()
);

    console.log(`[weakSignal:debug:1] uniqueSignals count: ${uniqueSignals.length}`);

let returned: PersistedSignal[] = [];
try {
  returned = await persistSignals(uniqueSignals);

  console.log("returned signals:", returned.length);

  console.log(`[weakSignal:debug:2] returned count: ${returned.length}`);
  
} catch (err) {
  console.error("[persistSignals] error:", err);
}

    const rawByKey = new Map<string, AggregatedSignal>();

    for (const r of uniqueSignals) {
  rawByKey.set(`${r.source}::${r.id}`, r);
  if (r.url) rawByKey.set(`${r.source}::${r.url}`, r);
    }

  const signalsForExtraction: SignalForExtraction[] = returned
    .map((r) => {
      // Try externalId first, then url as fallback
      const raw =
  rawByKey.get(`${r.source}::${r.externalId}`) ??
  rawByKey.get(`${r.source}::${r.id}`) ??
  rawByKey.get(`${r.source}::${r.url}`);

      if (!raw) {
        console.warn(
          `[weakSignal] no raw match for persisted signal — source=${r.source} externalId=${r.externalId}`
        );
        return null;
      }

      return {
        ...r,
        title: raw.title,
        body: null,
      } satisfies SignalForExtraction;
    })
    .filter((s): s is SignalForExtraction => s !== null);

    console.log("signalsForExtraction:", signalsForExtraction.length);

    console.log(`[weakSignal:debug:3] signalsForExtraction count: ${signalsForExtraction.length}`);
if (signalsForExtraction.length > 0) {
  console.log(`[weakSignal:debug:3] sample signal:`, JSON.stringify(signalsForExtraction[0]));
}

    try {
  console.log(
    `[weakSignal] processing ${signalsForExtraction.length} signals for extraction`
  );

      for (const signal of signalsForExtraction) {
  console.log(`[weakSignal:debug:4] processing signal id=${signal.id} title="${signal.title}"`);

  const conceptNodeIds = await upsertConceptsFromSignal(signal);

  console.log(`[weakSignal:debug:5] conceptNodeIds for signal ${signal.id}:`, conceptNodeIds);

  await writeEdgeSnapshots(signal, conceptNodeIds);
      }
} catch (err) {
  console.error("[weakSignal] extraction failed - pipeline continuing:", err);
    }
    
// Deduplicate
const deduped = deduplicateSignals(filteredSignals);

    // Calculate composite scores
    const scored = deduped.map(signal => ({
      ...signal,
      score: calculateCompositeScore(signal),
    }));

    // Sort by composite score and return top 20
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  } catch (err) {
    console.error("Error fetching aggregated signals:", err);
    return [];
  }
}

/**
 * Get cached aggregated signals (10-minute TTL)
 */
let cachedSignals: AggregatedSignal[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

export async function getAggregatedSignals(forceRefresh: boolean = false): Promise<AggregatedSignal[]> {
  const now = Date.now();

  if (!forceRefresh && cachedSignals.length > 0 && now - lastFetchTime < CACHE_TTL) {
    return cachedSignals;
  }

  try {
    cachedSignals = await fetchAggregatedSignals();
    lastFetchTime = now;
    return cachedSignals;
  } catch (err) {
    console.error("Failed to get aggregated signals:", err);
    return cachedSignals;
  }
}
