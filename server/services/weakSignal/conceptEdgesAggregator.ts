/**
 * Concept Edges Aggregator
 *
 * Aggregates edge_snapshots into concept_edges table for propagation detection
 * and graph analysis. Part of the Foundation Layer in the roadmap.
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";

interface AggregationStats {
  edgesAggregated: number;
  newEdges: number;
  updatedEdges: number;
  durationMs: number;
}

/**
 * Aggregate edge_snapshots into concept_edges table
 * This runs after edge snapshots are written during signal processing
 */
export async function aggregateConceptEdges(): Promise<AggregationStats> {
  const startTime = Date.now();

  console.log("[ConceptEdgesAggregator] Starting edge aggregation...");

  // Aggregate all edge_snapshots into concept_edges
  // This upserts: if edge exists, update counts; if new, insert
  const result = await db.execute(sql`
    INSERT INTO concept_edges (
      concept_a,
      concept_b,
      total_weight,
      first_seen,
      last_seen,
      signal_count,
      source_distribution,
      created_at,
      updated_at
    )
    SELECT
      LEAST(es.concept_a, es.concept_b) as concept_a,
      GREATEST(es.concept_a, es.concept_b) as concept_b,
      COUNT(*) as total_weight,
      MIN(es.created_at) as first_seen,
      MAX(es.created_at) as last_seen,
      COUNT(DISTINCT es.signal_id) as signal_count,
      jsonb_object_agg(
        COALESCE(s.source, 'unknown'),
        COUNT(*)
      ) FILTER (WHERE s.source IS NOT NULL) as source_distribution,
      NOW() as created_at,
      NOW() as updated_at
    FROM edge_snapshots es
    LEFT JOIN signals s ON es.signal_id = s.id
    GROUP BY LEAST(es.concept_a, es.concept_b), GREATEST(es.concept_a, es.concept_b)
    ON CONFLICT (concept_a, concept_b)
    DO UPDATE SET
      total_weight = EXCLUDED.total_weight,
      last_seen = EXCLUDED.last_seen,
      signal_count = EXCLUDED.signal_count,
      source_distribution = EXCLUDED.source_distribution,
      updated_at = NOW()
  `);

  // Get counts
  const counts = await db.execute(sql`
    SELECT
      COUNT(*) as total_edges,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 minute') as new_edges
    FROM concept_edges
  `);

  const totalEdges = Number(counts.rows[0]?.total_edges || 0);
  const newEdges = Number(counts.rows[0]?.new_edges || 0);
  const updatedEdges = totalEdges - newEdges;

  const durationMs = Date.now() - startTime;

  console.log(`[ConceptEdgesAggregator] Completed in ${durationMs}ms`);
  console.log(`[ConceptEdgesAggregator] Total edges: ${totalEdges}, New: ${newEdges}, Updated: ${updatedEdges}`);

  return {
    edgesAggregated: totalEdges,
    newEdges,
    updatedEdges,
    durationMs,
  };
}

/**
 * Get top concept edges by weight
 */
export async function getTopConceptEdges(limit: number = 20) {
  const result = await db.execute(sql`
    SELECT
      concept_a,
      concept_b,
      total_weight,
      first_seen,
      last_seen,
      signal_count,
      source_distribution
    FROM concept_edges
    ORDER BY total_weight DESC, last_seen DESC
    LIMIT ${limit}
  `);

  return result.rows;
}
