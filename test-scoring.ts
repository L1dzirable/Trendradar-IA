/**
 * Test script to verify Weak Signal Scoring Engine
 * This script triggers signal collection, concept extraction, and scoring
 */

import { fetchAggregatedSignals } from "./server/services/signalAggregator";
import { runWeakSignalScoring, getTopWeakSignals } from "./server/services/weakSignal/conceptScorer";
import { db } from "./server/db";
import { conceptNodes, conceptMentions, signals } from "./shared/schema";
import { sql } from "drizzle-orm";

async function testScoringEngine() {
  console.log("\n=== Weak Signal Scoring Engine Test ===\n");

  try {
    // Step 1: Fetch signals (this will trigger concept extraction and scoring)
    console.log("Step 1: Fetching and aggregating signals...");
    const aggregatedSignals = await fetchAggregatedSignals();
    console.log(`✓ Fetched ${aggregatedSignals.length} aggregated signals\n`);

    // Step 2: Check database counts
    console.log("Step 2: Checking database state...");

    const [signalCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(signals);
    console.log(`✓ Total signals in database: ${signalCount.count}`);

    const [conceptCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conceptNodes);
    console.log(`✓ Total concepts in database: ${conceptCount.count}`);

    const [mentionCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conceptMentions);
    console.log(`✓ Total concept mentions: ${mentionCount.count}\n`);

    // Step 3: Run scoring manually (if not already run)
    if (conceptCount.count > 0) {
      console.log("Step 3: Running weak signal scoring...");
      const stats = await runWeakSignalScoring();
      console.log(`✓ Scored ${stats.conceptsScored} concepts in ${stats.durationMs}ms`);
      console.log(`✓ Score distribution: min=${stats.scoreDistribution.min}, max=${stats.scoreDistribution.max}, avg=${stats.scoreDistribution.avg}\n`);

      // Step 4: Get top 20 concepts
      console.log("Step 4: Retrieving top 20 weak signals...\n");
      const topSignals = await getTopWeakSignals(20);

      console.log("=== TOP 20 WEAK SIGNALS ===\n");
      topSignals.forEach((signal, index) => {
        console.log(`${index + 1}. ${signal.concept}`);
        console.log(`   Weak Signal Score: ${signal.weakSignalScore}`);
        console.log(`   - Frequency: ${signal.frequencyScore}`);
        console.log(`   - Velocity: ${signal.velocityScore.toFixed(2)}`);
        console.log(`   - Diversity: ${signal.diversityScore}`);
        console.log(`   - Recency: ${signal.recencyScore}`);
        console.log(`   - Co-occurrence: ${signal.cooccurrenceScore}\n`);
      });

      // Step 5: Show detailed breakdown of top 5
      console.log("\n=== DETAILED BREAKDOWN: TOP 5 CONCEPTS ===\n");
      const top5 = topSignals.slice(0, 5);

      for (const signal of top5) {
        const [details] = await db
          .select({
            concept: conceptNodes.concept,
            mentionCount: conceptNodes.mentionCount,
            firstSeen: conceptNodes.firstSeen,
            lastSeen: conceptNodes.lastSeen,
            sourceDistribution: conceptNodes.sourceDistribution,
          })
          .from(conceptNodes)
          .where(sql`${conceptNodes.id} = ${signal.conceptId}`);

        if (details) {
          console.log(`Concept: "${details.concept}"`);
          console.log(`Weak Signal Score: ${signal.weakSignalScore}/100`);
          console.log(`Mentions: ${details.mentionCount}`);
          console.log(`First Seen: ${details.firstSeen?.toISOString()}`);
          console.log(`Last Seen: ${details.lastSeen?.toISOString()}`);
          console.log(`Source Distribution:`, details.sourceDistribution);
          console.log(`Component Scores:`);
          console.log(`  - Frequency: ${signal.frequencyScore}/100 (based on ${details.mentionCount} mentions)`);
          console.log(`  - Velocity: ${signal.velocityScore.toFixed(2)} (growth rate)`);
          console.log(`  - Diversity: ${signal.diversityScore}/100 (${Object.keys(details.sourceDistribution as object).length} sources)`);
          console.log(`  - Recency: ${signal.recencyScore}/100`);
          console.log(`  - Co-occurrence: ${signal.cooccurrenceScore}/100\n`);
        }
      }

      console.log("\n=== Test Completed Successfully ===\n");
    } else {
      console.log("⚠ No concepts found. Signal collection may not have run or no concepts were extracted.\n");
    }

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

testScoringEngine()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
