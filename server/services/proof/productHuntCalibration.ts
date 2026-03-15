/**
 * ProductHunt Calibration Service
 *
 * Calibrates the weak signal detection system by matching ProductHunt launches
 * to previously detected concepts, calculating lead time metrics.
 * Part of the Proof Layer in the roadmap.
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";

interface CalibrationResult {
  calibrationsAdded: number;
  averageLeadTimeDays: number;
  durationMs: number;
  recentCalibrations: Array<{
    phProductName: string;
    conceptLabel: string;
    leadTimeDays: number;
  }>;
}

/**
 * Check recent ProductHunt launches against our concept database
 * and record lead time for successful predictions
 */
export async function runProductHuntCalibration(): Promise<CalibrationResult> {
  const startTime = Date.now();

  console.log("[ProductHuntCalibration] Starting calibration run...");

  // This would normally fetch from ProductHunt API
  // For now, we'll check if any of our concepts match recent PH launches
  // In production, this would:
  // 1. Fetch recent PH launches
  // 2. Extract keywords/concepts from launch
  // 3. Match against our concept_nodes
  // 4. Calculate lead time if match found
  // 5. Insert into ph_calibration table

  // Placeholder implementation:
  // Get top concepts that might be validated by PH launches
  const matchableConcepts = await db.execute(sql`
    SELECT
      cn.id,
      cn.concept,
      cn.first_seen,
      cn.weak_signal_score
    FROM concept_nodes cn
    WHERE cn.weak_signal_score > 40
    AND cn.first_seen IS NOT NULL
    ORDER BY cn.weak_signal_score DESC
    LIMIT 100
  `);

  // In production, would match against actual PH data
  // For demonstration, showing structure:
  const calibrationsAdded = 0;

  // Calculate average lead time from existing calibrations
  const avgResult = await db.execute(sql`
    SELECT AVG(lead_time_days) as avg_lead_time
    FROM ph_calibration
    WHERE lead_time_days IS NOT NULL
  `);

  const averageLeadTimeDays = Number(avgResult.rows[0]?.avg_lead_time || 0);

  // Get recent calibrations
  const recentResult = await db.execute(sql`
    SELECT
      ph_product_name,
      concept_label,
      lead_time_days
    FROM ph_calibration
    ORDER BY created_at DESC
    LIMIT 10
  `);

  const recentCalibrations = recentResult.rows.map(row => ({
    phProductName: String(row.ph_product_name),
    conceptLabel: String(row.concept_label),
    leadTimeDays: Number(row.lead_time_days),
  }));

  // Update system_metrics with average lead time
  if (averageLeadTimeDays > 0) {
    await db.execute(sql`
      INSERT INTO system_metrics (key, value, updated_at)
      VALUES ('avg_lead_time_days', ${averageLeadTimeDays}, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `);
  }

  const durationMs = Date.now() - startTime;

  console.log(`[ProductHuntCalibration] Completed in ${durationMs}ms`);
  console.log(`[ProductHuntCalibration] Calibrations added: ${calibrationsAdded}`);
  console.log(`[ProductHuntCalibration] Average lead time: ${averageLeadTimeDays.toFixed(1)} days`);

  return {
    calibrationsAdded,
    averageLeadTimeDays,
    durationMs,
    recentCalibrations,
  };
}

/**
 * Manually add a ProductHunt calibration record
 */
export async function addProductHuntCalibration(params: {
  phProductId: string;
  phProductName: string;
  phTagline: string | null;
  conceptSlug: string;
  conceptLabel: string | null;
  firstSeenInTrendradar: Date;
  phLaunchDate: Date;
}): Promise<void> {
  const leadTimeDays = Math.floor(
    (params.phLaunchDate.getTime() - params.firstSeenInTrendradar.getTime()) /
    (1000 * 60 * 60 * 24)
  );

  await db.execute(sql`
    INSERT INTO ph_calibration (
      ph_product_id,
      ph_product_name,
      ph_tagline,
      concept_slug,
      concept_label,
      first_seen_in_trendradar,
      ph_launch_date,
      lead_time_days,
      created_at
    )
    VALUES (
      ${params.phProductId},
      ${params.phProductName},
      ${params.phTagline},
      ${params.conceptSlug},
      ${params.conceptLabel},
      ${params.firstSeenInTrendradar},
      ${params.phLaunchDate},
      ${leadTimeDays},
      NOW()
    )
  `);

  console.log(`[ProductHuntCalibration] Added calibration: ${params.phProductName} (lead time: ${leadTimeDays} days)`);

  // Recalculate average lead time
  await runProductHuntCalibration();
}

/**
 * Get system lead time metric
 */
export async function getAverageLeadTime(): Promise<number> {
  const result = await db.execute(sql`
    SELECT value
    FROM system_metrics
    WHERE key = 'avg_lead_time_days'
    LIMIT 1
  `);

  return Number(result.rows[0]?.value || 0);
}
