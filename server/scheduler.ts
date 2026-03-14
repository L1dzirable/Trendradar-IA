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

    const signals = await getAggregatedSignals(true);
    console.log(`[scheduler] fetched ${signals.length} signals`);

    const opportunities = await generateOpportunities(undefined, true);
    console.log(`[scheduler] generated ${opportunities.length} opportunities`);

    const { runPredictionDrafter } = await import('./services/predictionDrafter');
    await runPredictionDrafter();

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
