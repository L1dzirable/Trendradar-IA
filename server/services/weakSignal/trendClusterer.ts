/**
 * Trend Clustering Engine
 *
 * Groups related scored concepts into higher-level emerging trend clusters.
 * Uses graph relationships, co-occurrence strength, and concept scores to identify themes.
 */

import { db } from "../../db";
import { conceptNodes, edgeSnapshots } from "../../../shared/schema";
import { sql, gte, desc, inArray } from "drizzle-orm";

// Clustering parameters
const MIN_CLUSTER_SIZE = 2;           // Minimum concepts per cluster
const MAX_CLUSTER_SIZE = 15;          // Maximum concepts per cluster
const MIN_EDGE_WEIGHT = 2;            // Minimum co-occurrence strength
const MIN_CONCEPT_SCORE = 30;         // Only cluster concepts with decent signal
const SIMILARITY_THRESHOLD = 0.3;     // Edge weight similarity threshold
const RECENCY_DAYS = 30;              // Only consider recent concepts

interface ConceptNode {
  id: number;
  concept: string;
  weakSignalScore: number;
  mentionCount: number;
  lastSeen: Date | null;
  sourceDistribution: Record<string, number>;
  velocityScore: string;
}

interface Edge {
  conceptA: string;
  conceptB: string;
  weight: number;
}

interface Cluster {
  clusterLabel: string;
  memberConcepts: string[];
  conceptIds: number[];
  avgWeakSignalScore: number;
  totalMentions: number;
  sourceDiversity: number;
  clusterVelocity: number;
  firstSeen: Date;
  lastSeen: Date;
}

interface ClusteringResult {
  success: boolean;
  clustersCreated: number;
  conceptsClustered: number;
  durationMs: number;
  topClusters: Array<{
    label: string;
    memberCount: number;
    avgScore: number;
    members: string[];
  }>;
}

/**
 * Build adjacency graph from edge snapshots
 */
async function buildConceptGraph(): Promise<Map<string, Map<string, number>>> {
  const edges = await db
    .select({
      conceptA: edgeSnapshots.conceptA,
      conceptB: edgeSnapshots.conceptB,
      weight: edgeSnapshots.weight,
    })
    .from(edgeSnapshots)
    .where(gte(edgeSnapshots.weight, MIN_EDGE_WEIGHT));

  const graph = new Map<string, Map<string, number>>();

  for (const edge of edges) {
    // Add bidirectional edges
    if (!graph.has(edge.conceptA)) {
      graph.set(edge.conceptA, new Map());
    }
    if (!graph.has(edge.conceptB)) {
      graph.set(edge.conceptB, new Map());
    }

    const weightA = graph.get(edge.conceptA)!;
    const weightB = graph.get(edge.conceptB)!;

    weightA.set(edge.conceptB, (weightA.get(edge.conceptB) || 0) + (edge.weight || 1));
    weightB.set(edge.conceptA, (weightB.get(edge.conceptA) || 0) + (edge.weight || 1));
  }

  return graph;
}

/**
 * Get eligible concepts for clustering
 */
async function getEligibleConcepts(): Promise<ConceptNode[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RECENCY_DAYS);

  const concepts = await db
    .select({
      id: conceptNodes.id,
      concept: conceptNodes.concept,
      weakSignalScore: conceptNodes.weakSignalScore,
      mentionCount: conceptNodes.mentionCount,
      lastSeen: conceptNodes.lastSeen,
      sourceDistribution: conceptNodes.sourceDistribution,
      velocityScore: conceptNodes.velocityScore,
    })
    .from(conceptNodes)
    .where(
      sql`${conceptNodes.weakSignalScore} >= ${MIN_CONCEPT_SCORE}
          AND ${conceptNodes.lastSeen} >= ${cutoffDate}`
    )
    .orderBy(desc(conceptNodes.weakSignalScore));

  return concepts as ConceptNode[];
}

/**
 * Cluster concepts using graph-based community detection
 * Uses a simplified Louvain-inspired approach
 */
function clusterConcepts(
  concepts: ConceptNode[],
  graph: Map<string, Map<string, number>>
): Cluster[] {
  const clusters: Cluster[] = [];
  const assigned = new Set<string>();

  // Sort concepts by score (process high-scoring concepts first)
  const sortedConcepts = [...concepts].sort(
    (a, b) => (b.weakSignalScore || 0) - (a.weakSignalScore || 0)
  );

  for (const seed of sortedConcepts) {
    if (assigned.has(seed.concept)) continue;

    const clusterMembers = new Set<string>([seed.concept]);
    const conceptIds = new Set<number>([seed.id]);
    assigned.add(seed.concept);

    // Get neighbors of seed concept
    const neighbors = graph.get(seed.concept);
    if (!neighbors || neighbors.size === 0) continue;

    // Build cluster by adding strongly connected neighbors
    const candidateNeighbors = Array.from(neighbors.entries())
      .filter(([neighbor, weight]) => !assigned.has(neighbor) && weight >= MIN_EDGE_WEIGHT)
      .sort((a, b) => b[1] - a[1]); // Sort by edge weight

    for (const [neighbor, weight] of candidateNeighbors) {
      if (clusterMembers.size >= MAX_CLUSTER_SIZE) break;

      // Check if neighbor is well-connected to existing cluster members
      const neighborEdges = graph.get(neighbor);
      if (!neighborEdges) continue;

      let internalConnections = 0;
      let totalWeight = 0;

      for (const member of clusterMembers) {
        if (neighborEdges.has(member)) {
          internalConnections++;
          totalWeight += neighborEdges.get(member) || 0;
        }
      }

      // Add if neighbor has strong connections to cluster
      const avgConnectionStrength = totalWeight / clusterMembers.size;
      if (avgConnectionStrength >= SIMILARITY_THRESHOLD * MIN_EDGE_WEIGHT) {
        clusterMembers.add(neighbor);

        // Find concept ID
        const neighborConcept = concepts.find(c => c.concept === neighbor);
        if (neighborConcept) {
          conceptIds.add(neighborConcept.id);
          assigned.add(neighbor);
        }
      }
    }

    // Only keep clusters with minimum size
    if (clusterMembers.size >= MIN_CLUSTER_SIZE) {
      const clusterConcepts = concepts.filter(c => conceptIds.has(c.id));

      const cluster = buildClusterMetadata(
        Array.from(clusterMembers),
        clusterConcepts
      );

      clusters.push(cluster);
    }
  }

  return clusters;
}

/**
 * Build cluster metadata from member concepts
 */
function buildClusterMetadata(
  memberConcepts: string[],
  conceptData: ConceptNode[]
): Cluster {
  // Calculate aggregate metrics
  const avgWeakSignalScore = Math.round(
    conceptData.reduce((sum, c) => sum + (c.weakSignalScore || 0), 0) / conceptData.length
  );

  const totalMentions = conceptData.reduce(
    (sum, c) => sum + (c.mentionCount || 0),
    0
  );

  // Calculate source diversity (unique sources across all concepts)
  const allSources = new Set<string>();
  for (const concept of conceptData) {
    const sources = concept.sourceDistribution || {};
    Object.keys(sources).forEach(s => allSources.add(s));
  }
  const sourceDiversity = allSources.size;

  // Calculate cluster velocity (average velocity)
  const clusterVelocity =
    conceptData.reduce((sum, c) => sum + parseFloat(c.velocityScore || "0"), 0) /
    conceptData.length;

  // Find first and last seen dates
  const validDates = conceptData
    .map(c => c.lastSeen)
    .filter((d): d is Date => d !== null);

  const lastSeen = validDates.length > 0
    ? new Date(Math.max(...validDates.map(d => d.getTime())))
    : new Date();

  const firstSeen = validDates.length > 0
    ? new Date(Math.min(...validDates.map(d => d.getTime())))
    : lastSeen;

  // Generate cluster label from top concepts
  const topConcepts = [...conceptData]
    .sort((a, b) => (b.weakSignalScore || 0) - (a.weakSignalScore || 0))
    .slice(0, 3)
    .map(c => c.concept);

  const clusterLabel = generateClusterLabel(topConcepts);

  return {
    clusterLabel,
    memberConcepts,
    conceptIds: conceptData.map(c => c.id),
    avgWeakSignalScore,
    totalMentions,
    sourceDiversity,
    clusterVelocity,
    firstSeen,
    lastSeen,
  };
}

/**
 * Generate meaningful cluster label from top concepts
 */
function generateClusterLabel(topConcepts: string[]): string {
  if (topConcepts.length === 0) return "Unnamed Cluster";
  if (topConcepts.length === 1) return topConcepts[0];
  if (topConcepts.length === 2) return `${topConcepts[0]} & ${topConcepts[1]}`;

  // Find common themes or just use top concepts
  return `${topConcepts[0]} + ${topConcepts.slice(1).join(", ")}`;
}

/**
 * Persist clusters to database
 */
async function persistClusters(clusters: Cluster[]): Promise<void> {
  console.log(`[TrendClusterer] Persisting ${clusters.length} clusters...`);

  for (const cluster of clusters) {
    try {
      // Insert cluster
      const [insertedCluster] = await db.execute(sql`
        INSERT INTO trend_clusters (
          label,
          avg_weak_signal_score,
          total_mentions,
          source_diversity,
          cluster_velocity,
          first_seen,
          last_seen,
          created_at,
          updated_at
        ) VALUES (
          ${cluster.clusterLabel},
          ${cluster.avgWeakSignalScore},
          ${cluster.totalMentions},
          ${cluster.sourceDiversity},
          ${cluster.clusterVelocity},
          ${cluster.firstSeen},
          ${cluster.lastSeen},
          NOW(),
          NOW()
        )
        RETURNING id
      `);

      const clusterId = (insertedCluster as any).id;

      // Insert cluster members
      for (let i = 0; i < cluster.conceptIds.length; i++) {
        const conceptId = cluster.conceptIds[i];
        const conceptScore = await db.execute(sql`
          SELECT weak_signal_score FROM concept_nodes WHERE id = ${conceptId}
        `);

        const score = (conceptScore as any)[0]?.weak_signal_score || 0;

        await db.execute(sql`
          INSERT INTO trend_cluster_members (
            cluster_id,
            concept_id,
            concept_score,
            created_at
          ) VALUES (
            ${clusterId},
            ${conceptId},
            ${score},
            NOW()
          )
          ON CONFLICT DO NOTHING
        `);
      }
    } catch (err) {
      console.error(`[TrendClusterer] Error persisting cluster "${cluster.clusterLabel}":`, err);
    }
  }
}

/**
 * Main clustering execution
 */
export async function runTrendClustering(): Promise<ClusteringResult> {
  const startTime = Date.now();

  console.log("[TrendClusterer] Starting trend clustering...");

  try {
    // Step 1: Get eligible concepts
    const concepts = await getEligibleConcepts();
    console.log(`[TrendClusterer] Found ${concepts.length} eligible concepts`);

    if (concepts.length === 0) {
      return {
        success: true,
        clustersCreated: 0,
        conceptsClustered: 0,
        durationMs: Date.now() - startTime,
        topClusters: [],
      };
    }

    // Step 2: Build concept graph
    const graph = await buildConceptGraph();
    console.log(`[TrendClusterer] Built graph with ${graph.size} nodes`);

    // Step 3: Run clustering algorithm
    const clusters = clusterConcepts(concepts, graph);
    console.log(`[TrendClusterer] Generated ${clusters.length} clusters`);

    // Step 4: Persist to database
    await persistClusters(clusters);

    // Step 5: Build result summary
    const conceptsClustered = clusters.reduce(
      (sum, c) => sum + c.memberConcepts.length,
      0
    );

    const topClusters = clusters
      .sort((a, b) => b.avgWeakSignalScore - a.avgWeakSignalScore)
      .slice(0, 10)
      .map(c => ({
        label: c.clusterLabel,
        memberCount: c.memberConcepts.length,
        avgScore: c.avgWeakSignalScore,
        members: c.memberConcepts.slice(0, 5), // Top 5 members
      }));

    const durationMs = Date.now() - startTime;

    console.log(`[TrendClusterer] Completed in ${durationMs}ms`);
    console.log(`[TrendClusterer] Created ${clusters.length} clusters covering ${conceptsClustered} concepts`);

    return {
      success: true,
      clustersCreated: clusters.length,
      conceptsClustered,
      durationMs,
      topClusters,
    };
  } catch (err) {
    console.error("[TrendClusterer] Error during clustering:", err);
    throw err;
  }
}

/**
 * Get top clusters from database
 */
export async function getTopClusters(limit: number = 20) {
  const clusters = await db.execute(sql`
    SELECT
      tc.id,
      tc.label,
      tc.avg_weak_signal_score,
      tc.total_mentions,
      tc.source_diversity,
      tc.cluster_velocity,
      tc.first_seen,
      tc.last_seen,
      tc.created_at,
      COUNT(tcm.id) as member_count,
      ARRAY_AGG(cn.concept ORDER BY tcm.concept_score DESC) as member_concepts
    FROM trend_clusters tc
    LEFT JOIN trend_cluster_members tcm ON tc.id = tcm.cluster_id
    LEFT JOIN concept_nodes cn ON tcm.concept_id = cn.id
    GROUP BY tc.id
    ORDER BY tc.avg_weak_signal_score DESC
    LIMIT ${limit}
  `);

  return clusters;
}
