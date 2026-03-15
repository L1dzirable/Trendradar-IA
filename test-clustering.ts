/**
 * Test script to verify Trend Clustering Engine
 * This script triggers clustering and shows results
 */

import { runTrendClustering, getTopClusters } from "./server/services/weakSignal/trendClusterer";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function testClusteringEngine() {
  console.log("\n=== Trend Clustering Engine Test ===\n");

  try {
    // Step 1: Check pre-clustering state
    console.log("Step 1: Checking database state before clustering...");

    const [conceptCount] = await db.execute(sql`
      SELECT COUNT(*) as count FROM concept_nodes
      WHERE weak_signal_score >= 30
    `);
    console.log(`✓ Eligible concepts (score >= 30): ${(conceptCount as any).count}`);

    const [edgeCount] = await db.execute(sql`
      SELECT COUNT(*) as count FROM edge_snapshots
    `);
    console.log(`✓ Total edges in graph: ${(edgeCount as any).count}\n`);

    // Step 2: Run clustering
    console.log("Step 2: Running trend clustering...");
    const result = await runTrendClustering();

    if (result.success) {
      console.log(`✓ Clustering completed in ${result.durationMs}ms`);
      console.log(`✓ Created ${result.clustersCreated} clusters`);
      console.log(`✓ Clustered ${result.conceptsClustered} concepts\n`);

      // Step 3: Verify database state
      console.log("Step 3: Verifying database state...");

      const [clusterCount] = await db.execute(sql`
        SELECT COUNT(*) as count FROM trend_clusters
      `);
      console.log(`✓ Total clusters in database: ${(clusterCount as any).count}`);

      const [memberCount] = await db.execute(sql`
        SELECT COUNT(*) as count FROM trend_cluster_members
      `);
      console.log(`✓ Total cluster memberships: ${(memberCount as any).count}\n`);

      // Step 4: Display top clusters
      if (result.topClusters.length > 0) {
        console.log("=== TOP 10 TREND CLUSTERS ===\n");

        for (let i = 0; i < result.topClusters.length; i++) {
          const cluster = result.topClusters[i];
          console.log(`${i + 1}. ${cluster.label}`);
          console.log(`   Average Score: ${cluster.avgScore}`);
          console.log(`   Member Count: ${cluster.memberCount}`);
          console.log(`   Members: ${cluster.members.join(", ")}\n`);
        }
      }

      // Step 5: Get detailed cluster info from database
      console.log("=== DETAILED CLUSTER ANALYSIS ===\n");

      const detailedClusters = await db.execute(sql`
        SELECT
          tc.id,
          tc.label,
          tc.avg_weak_signal_score,
          tc.total_mentions,
          tc.source_diversity,
          tc.cluster_velocity,
          tc.first_seen,
          tc.last_seen,
          COUNT(tcm.id) as member_count,
          ARRAY_AGG(cn.concept ORDER BY tcm.concept_score DESC) as member_concepts,
          ARRAY_AGG(tcm.concept_score ORDER BY tcm.concept_score DESC) as member_scores
        FROM trend_clusters tc
        LEFT JOIN trend_cluster_members tcm ON tc.id = tcm.cluster_id
        LEFT JOIN concept_nodes cn ON tcm.concept_id = cn.id
        GROUP BY tc.id
        ORDER BY tc.avg_weak_signal_score DESC
        LIMIT 10
      `);

      for (const cluster of detailedClusters as any[]) {
        console.log(`Cluster: "${cluster.label}"`);
        console.log(`  Avg Weak Signal Score: ${cluster.avg_weak_signal_score}/100`);
        console.log(`  Total Mentions: ${cluster.total_mentions}`);
        console.log(`  Source Diversity: ${cluster.source_diversity}`);
        console.log(`  Cluster Velocity: ${parseFloat(cluster.cluster_velocity).toFixed(2)}`);
        console.log(`  First Seen: ${new Date(cluster.first_seen).toISOString()}`);
        console.log(`  Last Seen: ${new Date(cluster.last_seen).toISOString()}`);
        console.log(`  Member Count: ${cluster.member_count}`);
        console.log(`  Members:`);

        for (let i = 0; i < cluster.member_concepts.length && i < 10; i++) {
          console.log(`    - ${cluster.member_concepts[i]} (score: ${cluster.member_scores[i]})`);
        }
        console.log("");
      }

      console.log("\n=== Test Completed Successfully ===\n");

    } else {
      console.log("⚠ Clustering did not succeed\n");
    }

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

testClusteringEngine()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
