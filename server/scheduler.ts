import cron from 'node-cron';
import { getAggregatedSignals } from './services/signalAggregator';
import { generateOpportunities } from './services/opportunityEngine';
import { sendWeeklyDigest } from './services/emailService';
import { enrichPersistedSignals } from './services/signalEnricher';

let isRunning = false;

async function runFullPipeline() {
  if (isRunning) {
    console.log('[scheduler] pipeline already running, skipping this cycle');
    return;
  }

  isRunning = true;
  const startTime = new Date().toISOString();

  try {
    console.log(`[scheduler] starting pipeline at ${startTime}`);

    // FOUNDATION LAYER: Signal ingestion & raw_text persistence
    const signals = await getAggregatedSignals(true);
    console.log(`[scheduler] fetched ${signals.length} signals`);

    // FOUNDATION LAYER: Concept extraction, mentions, edge snapshots
    // (already handled in signalAggregator.ts)

    // FOUNDATION LAYER: Aggregate edge_snapshots into concept_edges
    const { aggregateConceptEdges } = await import('./services/weakSignal/conceptEdgesAggregator');
    const edgeStats = await aggregateConceptEdges();
    console.log(`[scheduler] aggregated ${edgeStats.edgesAggregated} concept edges`);

    // ANALYSIS LAYER: Calculate velocity and acceleration
    const { calculateConceptVelocity } = await import('./services/weakSignal/conceptVelocityCalculator');
    const velocityStats = await calculateConceptVelocity();
    console.log(`[scheduler] calculated velocity for ${velocityStats.conceptsProcessed} concepts, ${velocityStats.acceleratingConcepts} accelerating`);

    // ANALYSIS LAYER: Trend clustering (community detection)
    // (already running in signalAggregator.ts after scoring)

    // ANALYSIS LAYER: Opportunity generation
    const opportunities = await generateOpportunities(undefined, true);
    console.log(`[scheduler] generated ${opportunities.length} opportunities`);

    // ANALYSIS LAYER: Prediction drafting
    const { runPredictionDrafter } = await import('./services/predictionDrafter');
    await runPredictionDrafter();

    // ANALYSIS LAYER: Prediction generation
    const { predictionEngine } = await import('./services/predictions/predictionEngine');
    const predictions = await predictionEngine.generatePredictions();
    console.log(`[scheduler] generated ${predictions.length} predictions`);

    // PROOF LAYER: ProductHunt calibration
    const { runProductHuntCalibration } = await import('./services/proof/productHuntCalibration');
    const calibrationResult = await runProductHuntCalibration();
    console.log(`[scheduler] calibration: avg lead time ${calibrationResult.averageLeadTimeDays.toFixed(1)} days`);

    // Signal enrichment
    await enrichPersistedSignals();

    console.log(`[scheduler] pipeline completed at ${new Date().toISOString()} — ${signals.length} signals processed`);
  } catch (error: any) {
    console.error(`[scheduler] pipeline failed at ${new Date().toISOString()}: ${error.message}`);
  } finally {
    isRunning = false;
  }
}

async function runWeeklyDigest() {
  try {
    console.log('[scheduler] sending weekly digest emails');
    await sendWeeklyDigest();
    console.log('[scheduler] weekly digest sent successfully');
  } catch (error: any) {
    console.error(`[scheduler] weekly digest failed: ${error.message}`);
  }
}

cron.schedule('0 */6 * * *', async () => {
  console.log('[scheduler] triggering 6-hour pipeline run');
  await runFullPipeline();
});

cron.schedule('0 8 * * 1', async () => {
  console.log('[scheduler] triggering weekly digest (Monday 08:00)');
  await runWeeklyDigest();
});

console.log('[scheduler] cron jobs initialized:');
console.log('  - Full pipeline: every 6 hours (0 */6 * * *)');
console.log('  - Weekly digest: Mondays at 08:00 (0 8 * * 1)');

runFullPipeline().catch(err => {
  console.error('[scheduler] initial pipeline run failed:', err);
});
