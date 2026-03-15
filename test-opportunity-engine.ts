import { opportunityEngine } from './server/services/opportunity/opportunityEngine';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function testOpportunityEngine() {
  console.log("\n=== Testing Opportunity Engine ===\n");

  try {
    console.log("1. Checking trend_clusters data...");
    const clustersResult = await db.execute(sql`
      SELECT id, label, avg_weak_signal_score, cluster_velocity, source_diversity, concept_count
      FROM trend_clusters
      ORDER BY avg_weak_signal_score DESC
      LIMIT 5
    `);
    console.log(`Found ${clustersResult.rows.length} clusters`);
    clustersResult.rows.forEach((cluster: any) => {
      console.log(`  - ${cluster.label} (score: ${cluster.avg_weak_signal_score}, velocity: ${cluster.cluster_velocity})`);
    });

    console.log("\n2. Generating opportunities...");
    const startTime = Date.now();
    const opportunities = await opportunityEngine.generateOpportunities();
    const durationMs = Date.now() - startTime;

    console.log(`✓ Generated ${opportunities.length} opportunities in ${durationMs}ms`);

    console.log("\n3. Top opportunities created:");
    opportunities.slice(0, 10).forEach((opp, idx) => {
      console.log(`\n${idx + 1}. ${opp.title}`);
      console.log(`   Confidence: ${opp.confidence_score}`);
      console.log(`   Window: ${opp.window_estimate}`);
      console.log(`   Target: ${opp.target_market}`);
    });

    console.log("\n4. Verifying database...");
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM opportunities`);
    console.log(`Total opportunities in DB: ${countResult.rows[0].count}`);

    console.log("\n=== Test Complete ===\n");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

testOpportunityEngine();
