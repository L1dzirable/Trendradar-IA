/**
 * Concept Velocity Calculator
 *
 * Calculates daily velocity and acceleration metrics for concepts.
 * Part of the Analysis Layer in the roadmap.
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";

interface VelocityStats {
  conceptsProcessed: number;
  acceleratingConcepts: number;
  durationMs: number;
  topAccelerating: Array<{
    concept: string;
    velocity7d: number;
    acceleration: number;
  }>;
}

const ACCELERATION_THRESHOLD = 0.5; // Minimum acceleration to mark as accelerating

/**
 * Calculate velocity and acceleration for all concepts
 * Compares current mention rates against historical windows
 */
export async function calculateConceptVelocity(): Promise<VelocityStats> {
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  console.log("[ConceptVelocityCalculator] Starting velocity calculation for", today);

  // Calculate velocity for each concept
  // This aggregates concept_mentions joined with signals to get temporal data
  await db.execute(sql`
    INSERT INTO concept_velocity (
      concept_id,
      concept,
      date,
      daily_mentions,
      weekly_mentions,
      monthly_mentions,
      velocity_7d,
      velocity_30d,
      acceleration,
      is_accelerating,
      created_at
    )
    SELECT
      cn.id as concept_id,
      cn.concept,
      ${today}::date as date,

      -- Daily mentions (today only)
      COUNT(*) FILTER (
        WHERE s.collected_at >= CURRENT_DATE
      ) as daily_mentions,

      -- Weekly mentions (last 7 days)
      COUNT(*) FILTER (
        WHERE s.collected_at >= CURRENT_DATE - INTERVAL '7 days'
      ) as weekly_mentions,

      -- Monthly mentions (last 30 days)
      COUNT(*) FILTER (
        WHERE s.collected_at >= CURRENT_DATE - INTERVAL '30 days'
      ) as monthly_mentions,

      -- Velocity 7d: (recent 7d) / (previous 7d) - 1
      CASE
        WHEN COUNT(*) FILTER (
          WHERE s.collected_at >= CURRENT_DATE - INTERVAL '14 days'
          AND s.collected_at < CURRENT_DATE - INTERVAL '7 days'
        ) > 0
        THEN (
          COUNT(*) FILTER (WHERE s.collected_at >= CURRENT_DATE - INTERVAL '7 days')::numeric /
          NULLIF(COUNT(*) FILTER (
            WHERE s.collected_at >= CURRENT_DATE - INTERVAL '14 days'
            AND s.collected_at < CURRENT_DATE - INTERVAL '7 days'
          ), 0)::numeric
        ) - 1
        ELSE 0
      END as velocity_7d,

      -- Velocity 30d: (recent 30d) / (previous 30d) - 1
      CASE
        WHEN COUNT(*) FILTER (
          WHERE s.collected_at >= CURRENT_DATE - INTERVAL '60 days'
          AND s.collected_at < CURRENT_DATE - INTERVAL '30 days'
        ) > 0
        THEN (
          COUNT(*) FILTER (WHERE s.collected_at >= CURRENT_DATE - INTERVAL '30 days')::numeric /
          NULLIF(COUNT(*) FILTER (
            WHERE s.collected_at >= CURRENT_DATE - INTERVAL '60 days'
            AND s.collected_at < CURRENT_DATE - INTERVAL '30 days'
          ), 0)::numeric
        ) - 1
        ELSE 0
      END as velocity_30d,

      -- Acceleration: change in velocity over time
      CASE
        WHEN COUNT(*) FILTER (WHERE s.collected_at >= CURRENT_DATE - INTERVAL '7 days') > 0
        THEN (
          (COUNT(*) FILTER (WHERE s.collected_at >= CURRENT_DATE - INTERVAL '7 days')::numeric /
           NULLIF(COUNT(*) FILTER (
             WHERE s.collected_at >= CURRENT_DATE - INTERVAL '14 days'
             AND s.collected_at < CURRENT_DATE - INTERVAL '7 days'
           ), 0)::numeric) - 1
        ) - COALESCE(
          (SELECT velocity_7d FROM concept_velocity
           WHERE concept_id = cn.id
           AND date = CURRENT_DATE - INTERVAL '7 days'
           LIMIT 1),
          0
        )
        ELSE 0
      END as acceleration,

      -- Is accelerating flag
      CASE
        WHEN (
          (COUNT(*) FILTER (WHERE s.collected_at >= CURRENT_DATE - INTERVAL '7 days')::numeric /
           NULLIF(COUNT(*) FILTER (
             WHERE s.collected_at >= CURRENT_DATE - INTERVAL '14 days'
             AND s.collected_at < CURRENT_DATE - INTERVAL '7 days'
           ), 0)::numeric) - 1
        ) - COALESCE(
          (SELECT velocity_7d FROM concept_velocity
           WHERE concept_id = cn.id
           AND date = CURRENT_DATE - INTERVAL '7 days'
           LIMIT 1),
          0
        ) > ${ACCELERATION_THRESHOLD}
        THEN true
        ELSE false
      END as is_accelerating,

      NOW() as created_at
    FROM concept_nodes cn
    LEFT JOIN concept_mentions cm ON cn.id = cm.concept_id
    LEFT JOIN signals s ON cm.signal_id = s.id
    WHERE s.collected_at >= CURRENT_DATE - INTERVAL '60 days'  -- Only analyze recent data
    GROUP BY cn.id, cn.concept
    HAVING COUNT(*) FILTER (WHERE s.collected_at >= CURRENT_DATE - INTERVAL '30 days') > 0  -- Skip inactive concepts
    ON CONFLICT (concept_id, date)
    DO UPDATE SET
      daily_mentions = EXCLUDED.daily_mentions,
      weekly_mentions = EXCLUDED.weekly_mentions,
      monthly_mentions = EXCLUDED.monthly_mentions,
      velocity_7d = EXCLUDED.velocity_7d,
      velocity_30d = EXCLUDED.velocity_30d,
      acceleration = EXCLUDED.acceleration,
      is_accelerating = EXCLUDED.is_accelerating
  `);

  // Get statistics
  const stats = await db.execute(sql`
    SELECT
      COUNT(*) as concepts_processed,
      COUNT(*) FILTER (WHERE is_accelerating = true) as accelerating_concepts
    FROM concept_velocity
    WHERE date = ${today}::date
  `);

  const conceptsProcessed = Number(stats.rows[0]?.concepts_processed || 0);
  const acceleratingConcepts = Number(stats.rows[0]?.accelerating_concepts || 0);

  // Get top accelerating concepts
  const topResult = await db.execute(sql`
    SELECT
      concept,
      velocity_7d,
      acceleration
    FROM concept_velocity
    WHERE date = ${today}::date
    AND is_accelerating = true
    ORDER BY acceleration DESC
    LIMIT 10
  `);

  const topAccelerating = topResult.rows.map(row => ({
    concept: String(row.concept),
    velocity7d: Number(row.velocity_7d),
    acceleration: Number(row.acceleration),
  }));

  const durationMs = Date.now() - startTime;

  console.log(`[ConceptVelocityCalculator] Completed in ${durationMs}ms`);
  console.log(`[ConceptVelocityCalculator] Processed: ${conceptsProcessed}, Accelerating: ${acceleratingConcepts}`);

  return {
    conceptsProcessed,
    acceleratingConcepts,
    durationMs,
    topAccelerating,
  };
}

/**
 * Get concepts with highest acceleration
 */
export async function getAcceleratingConcepts(limit: number = 20) {
  const today = new Date().toISOString().split('T')[0];

  const result = await db.execute(sql`
    SELECT
      cv.concept,
      cv.velocity_7d,
      cv.velocity_30d,
      cv.acceleration,
      cv.weekly_mentions,
      cn.weak_signal_score
    FROM concept_velocity cv
    JOIN concept_nodes cn ON cv.concept_id = cn.id
    WHERE cv.date = ${today}::date
    AND cv.is_accelerating = true
    ORDER BY cv.acceleration DESC, cv.velocity_7d DESC
    LIMIT ${limit}
  `);

  return result.rows;
}
