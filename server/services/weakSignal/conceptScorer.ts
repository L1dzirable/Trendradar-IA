/**
 * Weak Signal Scoring Engine
 *
 * Scores concepts based on multiple factors to identify emerging weak signals.
 * Uses existing infrastructure: concept_nodes, concept_mentions, edge_snapshots.
 */

import { db } from "../../db";
import { conceptNodes, conceptMentions, edgeSnapshots, signals } from "../../../shared/schema";
import { sql, eq, and, gte, desc } from "drizzle-orm";

// Configurable weights for final score calculation (must sum to 1.0)
const SCORING_WEIGHTS = {
  frequency: 0.25,
  velocity: 0.30,
  diversity: 0.20,
  recency: 0.15,
  cooccurrence: 0.10,
};

// Time windows for velocity calculation (in days)
const VELOCITY_WINDOWS = {
  recent: 7,   // Last 7 days
  previous: 14, // Previous 7-14 days
};

interface ConceptScoreComponents {
  conceptId: number;
  concept: string;
  frequencyScore: number;
  velocityScore: number;
  diversityScore: number;
  recencyScore: number;
  cooccurrenceScore: number;
  weakSignalScore: number;
}

interface ScoringStats {
  conceptsScored: number;
  topConcepts: Array<{
    concept: string;
    weakSignalScore: number;
  }>;
  durationMs: number;
  scoreDistribution: {
    min: number;
    max: number;
    avg: number;
  };
}

/**
 * Calculate frequency score (0-100)
 * Based on total mention count across all signals
 */
function calculateFrequencyScore(mentionCount: number): number {
  // Logarithmic scaling: rewards frequency but with diminishing returns
  // Score saturates at ~50 mentions
  const maxMentions = 50;
  const normalized = Math.min(mentionCount, maxMentions) / maxMentions;
  return Math.round(normalized * 100);
}

/**
 * Calculate velocity score
 * Measures growth rate of mentions over time
 * Returns decimal value (can be > 1.0 for explosive growth)
 */
async function calculateVelocityScore(conceptId: number): Promise<number> {
  const now = new Date();
  const recentDate = new Date(now.getTime() - VELOCITY_WINDOWS.recent * 24 * 60 * 60 * 1000);
  const previousDate = new Date(now.getTime() - (VELOCITY_WINDOWS.recent + VELOCITY_WINDOWS.previous) * 24 * 60 * 60 * 1000);

  // Count mentions in recent window
  const recentResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conceptMentions)
    .innerJoin(signals, eq(conceptMentions.signalId, signals.id))
    .where(
      and(
        eq(conceptMentions.conceptId, conceptId),
        gte(signals.collectedAt, recentDate)
      )
    );

  // Count mentions in previous window
  const previousResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conceptMentions)
    .innerJoin(signals, eq(conceptMentions.signalId, signals.id))
    .where(
      and(
        eq(conceptMentions.conceptId, conceptId),
        gte(signals.collectedAt, previousDate),
        sql`${signals.collectedAt} < ${recentDate}`
      )
    );

  const recentCount = recentResult[0]?.count || 0;
  const previousCount = previousResult[0]?.count || 0;

  // Calculate growth rate
  if (previousCount === 0) {
    // New concept: reward based on recent mentions
    return recentCount > 0 ? Math.min(recentCount * 0.5, 5.0) : 0;
  }

  const growthRate = (recentCount - previousCount) / previousCount;

  // Cap extreme values but allow high velocity signals
  return Math.max(-1.0, Math.min(growthRate, 10.0));
}

/**
 * Calculate diversity score (0-100)
 * Based on how many different sources mention the concept
 */
function calculateDiversityScore(sourceDistribution: Record<string, number>): number {
  if (!sourceDistribution || typeof sourceDistribution !== 'object') {
    return 0;
  }

  const sources = Object.keys(sourceDistribution);
  const sourceCount = sources.length;

  // Score based on number of distinct sources (max 4: reddit, hackernews, producthunt, github)
  const maxSources = 4;
  const baseScore = (sourceCount / maxSources) * 70;

  // Bonus for balanced distribution (no single source dominates)
  const totalMentions = Object.values(sourceDistribution).reduce((sum, count) => sum + count, 0);
  if (totalMentions > 0 && sourceCount > 1) {
    const entropy = sources.reduce((ent, source) => {
      const p = sourceDistribution[source] / totalMentions;
      return ent - p * Math.log2(p);
    }, 0);
    const maxEntropy = Math.log2(sourceCount);
    const balanceBonus = (entropy / maxEntropy) * 30;
    return Math.round(baseScore + balanceBonus);
  }

  return Math.round(baseScore);
}

/**
 * Calculate recency score (0-100)
 * Concepts mentioned recently score higher
 */
function calculateRecencyScore(lastSeen: Date | null): number {
  if (!lastSeen) {
    return 0;
  }

  const now = Date.now();
  const ageInDays = (now - lastSeen.getTime()) / (1000 * 60 * 60 * 24);

  // Exponential decay: half-life of ~7 days
  const decayRate = 0.1;
  const score = 100 * Math.exp(-decayRate * ageInDays);

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Calculate co-occurrence score (0-100)
 * Concepts connected to many other emerging concepts score higher
 */
async function calculateCooccurrenceScore(concept: string): Promise<number> {
  // Count unique concepts this concept appears with
  const result = await db
    .select({
      uniqueConnections: sql<number>`count(DISTINCT CASE WHEN ${edgeSnapshots.conceptA} = ${concept} THEN ${edgeSnapshots.conceptB} ELSE ${edgeSnapshots.conceptA} END)::int`
    })
    .from(edgeSnapshots)
    .where(
      sql`${edgeSnapshots.conceptA} = ${concept} OR ${edgeSnapshots.conceptB} = ${concept}`
    );

  const uniqueConnections = result[0]?.uniqueConnections || 0;

  // Logarithmic scaling: rewards connections but with diminishing returns
  const maxConnections = 20;
  const normalized = Math.min(uniqueConnections, maxConnections) / maxConnections;
  return Math.round(normalized * 100);
}

/**
 * Calculate composite weak signal score
 */
function calculateWeakSignalScore(components: ConceptScoreComponents): number {
  const {
    frequencyScore,
    velocityScore,
    diversityScore,
    recencyScore,
    cooccurrenceScore,
  } = components;

  // Normalize velocity score to 0-100 range (it can be negative or > 1)
  const normalizedVelocity = Math.max(0, Math.min(100, 50 + velocityScore * 10));

  const composite =
    frequencyScore * SCORING_WEIGHTS.frequency +
    normalizedVelocity * SCORING_WEIGHTS.velocity +
    diversityScore * SCORING_WEIGHTS.diversity +
    recencyScore * SCORING_WEIGHTS.recency +
    cooccurrenceScore * SCORING_WEIGHTS.cooccurrence;

  return Math.round(Math.max(0, Math.min(100, composite)));
}

/**
 * Score a single concept
 */
async function scoreConcept(
  conceptId: number,
  concept: string,
  mentionCount: number,
  lastSeen: Date | null,
  sourceDistribution: Record<string, number>
): Promise<ConceptScoreComponents> {
  const frequencyScore = calculateFrequencyScore(mentionCount);
  const velocityScore = await calculateVelocityScore(conceptId);
  const diversityScore = calculateDiversityScore(sourceDistribution);
  const recencyScore = calculateRecencyScore(lastSeen);
  const cooccurrenceScore = await calculateCooccurrenceScore(concept);

  const components: ConceptScoreComponents = {
    conceptId,
    concept,
    frequencyScore,
    velocityScore,
    diversityScore,
    recencyScore,
    cooccurrenceScore,
    weakSignalScore: 0, // Will be calculated next
  };

  components.weakSignalScore = calculateWeakSignalScore(components);

  return components;
}

/**
 * Main scoring engine
 * Scores all concepts in the database
 */
export async function runWeakSignalScoring(): Promise<ScoringStats> {
  const startTime = Date.now();

  console.log("[WeakSignalScoring] Starting scoring run...");

  // Get all concepts with their metadata
  const concepts = await db
    .select({
      id: conceptNodes.id,
      concept: conceptNodes.concept,
      mentionCount: conceptNodes.mentionCount,
      lastSeen: conceptNodes.lastSeen,
      sourceDistribution: conceptNodes.sourceDistribution,
    })
    .from(conceptNodes);

  console.log(`[WeakSignalScoring] Found ${concepts.length} concepts to score`);

  if (concepts.length === 0) {
    return {
      conceptsScored: 0,
      topConcepts: [],
      durationMs: Date.now() - startTime,
      scoreDistribution: { min: 0, max: 0, avg: 0 },
    };
  }

  const scoredConcepts: ConceptScoreComponents[] = [];

  // Score each concept
  for (const concept of concepts) {
    try {
      const scores = await scoreConcept(
        concept.id,
        concept.concept,
        concept.mentionCount || 0,
        concept.lastSeen,
        (concept.sourceDistribution as Record<string, number>) || {}
      );

      scoredConcepts.push(scores);

      // Update database with scores
      await db
        .update(conceptNodes)
        .set({
          weakSignalScore: scores.weakSignalScore,
          velocityScore: scores.velocityScore.toString(),
          frequencyScore: scores.frequencyScore,
          diversityScore: scores.diversityScore,
          recencyScore: scores.recencyScore,
          cooccurrenceScore: scores.cooccurrenceScore,
          scoreUpdatedAt: new Date(),
        })
        .where(eq(conceptNodes.id, concept.id));

    } catch (err) {
      console.error(`[WeakSignalScoring] Error scoring concept ${concept.concept}:`, err);
    }
  }

  // Calculate statistics
  const scores = scoredConcepts.map(c => c.weakSignalScore);
  const scoreDistribution = {
    min: Math.min(...scores),
    max: Math.max(...scores),
    avg: Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length),
  };

  // Get top 10 concepts
  const topConcepts = scoredConcepts
    .sort((a, b) => b.weakSignalScore - a.weakSignalScore)
    .slice(0, 10)
    .map(c => ({
      concept: c.concept,
      weakSignalScore: c.weakSignalScore,
    }));

  const durationMs = Date.now() - startTime;

  console.log(`[WeakSignalScoring] Completed in ${durationMs}ms`);
  console.log(`[WeakSignalScoring] Score distribution:`, scoreDistribution);
  console.log(`[WeakSignalScoring] Top concepts:`, topConcepts.slice(0, 5));

  return {
    conceptsScored: concepts.length,
    topConcepts,
    durationMs,
    scoreDistribution,
  };
}

/**
 * Get top scored concepts
 */
export async function getTopWeakSignals(limit: number = 20): Promise<ConceptScoreComponents[]> {
  const results = await db
    .select({
      id: conceptNodes.id,
      concept: conceptNodes.concept,
      weakSignalScore: conceptNodes.weakSignalScore,
      velocityScore: conceptNodes.velocityScore,
      frequencyScore: conceptNodes.frequencyScore,
      diversityScore: conceptNodes.diversityScore,
      recencyScore: conceptNodes.recencyScore,
      cooccurrenceScore: conceptNodes.cooccurrenceScore,
    })
    .from(conceptNodes)
    .orderBy(desc(conceptNodes.weakSignalScore))
    .limit(limit);

  return results.map(r => ({
    conceptId: r.id,
    concept: r.concept,
    weakSignalScore: r.weakSignalScore || 0,
    velocityScore: parseFloat(r.velocityScore as string || "0"),
    frequencyScore: r.frequencyScore || 0,
    diversityScore: r.diversityScore || 0,
    recencyScore: r.recencyScore || 0,
    cooccurrenceScore: r.cooccurrenceScore || 0,
  }));
}
