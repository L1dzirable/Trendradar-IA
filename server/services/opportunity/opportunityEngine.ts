import { db } from '../../db.js';
import { sql } from 'drizzle-orm';

export interface OpportunityInput {
  title: string;
  description: string;
  painPoint: string;
  targetMarket: string;
  whyNow: string;
  clusterId: number;
  confidenceScore: number;
  windowEstimate: string;
}

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  pain_point: string;
  target_market: string;
  why_now: string;
  cluster_id: number;
  confidence_score: number;
  window_estimate: string;
  created_at: Date;
  updated_at: Date;
}

interface ClusterData {
  id: number;
  label: string;
  avg_weak_signal_score: number;
  cluster_velocity: number;
  source_diversity: number;
  total_mentions: number;
  created_at: Date;
  concepts: string[];
}

export class OpportunityEngine {
  async generateOpportunities(): Promise<Opportunity[]> {
    const clusters = await this.getRecentClusters();
    const opportunities: Opportunity[] = [];

    for (const cluster of clusters) {
      const opportunity = await this.generateOpportunityFromCluster(cluster);
      if (opportunity) {
        opportunities.push(opportunity);
      }
    }

    return opportunities;
  }

  private async getRecentClusters(): Promise<ClusterData[]> {
    const result = await db.execute(sql`
      SELECT
        tc.id,
        tc.label,
        tc.avg_weak_signal_score,
        tc.cluster_velocity,
        tc.source_diversity,
        tc.total_mentions,
        tc.created_at,
        array_agg(c.term ORDER BY tcm.centrality_score DESC) as concepts
      FROM trend_clusters tc
      JOIN trend_cluster_members tcm ON tc.id = tcm.cluster_id
      JOIN concepts c ON tcm.concept_id = c.id
      WHERE tc.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY tc.id, tc.label, tc.avg_weak_signal_score, tc.cluster_velocity,
               tc.source_diversity, tc.total_mentions, tc.created_at
      ORDER BY tc.avg_weak_signal_score DESC
      LIMIT 50
    `);

    return result.rows as ClusterData[];
  }

  private async generateOpportunityFromCluster(cluster: ClusterData): Promise<Opportunity | null> {
    const confidenceScore = this.calculateConfidenceScore(cluster);

    if (confidenceScore < 30) {
      return null;
    }

    const windowEstimate = this.estimateWindow(cluster);
    const targetMarket = this.identifyTargetMarket(cluster);
    const painPoint = this.extractPainPoint(cluster);
    const whyNow = this.buildWhyNow(cluster);
    const description = this.buildDescription(cluster);

    const opportunityData: OpportunityInput = {
      title: cluster.label,
      description,
      painPoint,
      targetMarket,
      whyNow,
      clusterId: cluster.id,
      confidenceScore: Math.round(confidenceScore),
      windowEstimate
    };

    return await this.insertOpportunity(opportunityData);
  }

  private calculateConfidenceScore(cluster: ClusterData): number {
    const scoreWeight = 0.40;
    const velocityWeight = 0.30;
    const diversityWeight = 0.20;
    const noveltyWeight = 0.10;

    const normalizedScore = Math.min(cluster.avg_weak_signal_score / 100, 1);
    const normalizedVelocity = Math.min(Number(cluster.cluster_velocity) / 50, 1);
    const normalizedDiversity = Math.min(cluster.source_diversity / 5, 1);
    const normalizedNovelty = Math.min(cluster.total_mentions / 20, 1);

    const confidence = (
      normalizedScore * scoreWeight +
      normalizedVelocity * velocityWeight +
      normalizedDiversity * diversityWeight +
      normalizedNovelty * noveltyWeight
    ) * 100;

    return Math.min(confidence, 100);
  }

  private estimateWindow(cluster: ClusterData): string {
    const velocity = Number(cluster.cluster_velocity);

    if (velocity > 20) return "3-6 months";
    if (velocity > 10) return "6-12 months";
    if (velocity > 5) return "12-18 months";
    return "18-24 months";
  }

  private identifyTargetMarket(cluster: ClusterData): string {
    const concepts = cluster.concepts.map(c => c.toLowerCase());

    if (concepts.some(c => c.includes('developer') || c.includes('coding') || c.includes('programming'))) {
      return "Software developers and engineering teams";
    }
    if (concepts.some(c => c.includes('enterprise') || c.includes('business'))) {
      return "Enterprise organizations and business teams";
    }
    if (concepts.some(c => c.includes('startup') || c.includes('founder'))) {
      return "Startups and early-stage companies";
    }
    if (concepts.some(c => c.includes('data') || c.includes('analytics') || c.includes('ai'))) {
      return "Data teams and AI practitioners";
    }
    if (concepts.some(c => c.includes('security') || c.includes('compliance'))) {
      return "Security teams and compliance officers";
    }
    if (concepts.some(c => c.includes('saas') || c.includes('cloud'))) {
      return "SaaS companies and cloud-native organizations";
    }

    return "Technology teams and product builders";
  }

  private extractPainPoint(cluster: ClusterData): string {
    const concepts = cluster.concepts.map(c => c.toLowerCase());
    const label = cluster.label.toLowerCase();

    if (label.includes('productivity') || concepts.some(c => c.includes('productivity'))) {
      return "Teams struggle with inefficient workflows and context switching that hampers productivity and slows down delivery.";
    }
    if (label.includes('monitoring') || label.includes('observability')) {
      return "Organizations lack visibility into system behavior, making it difficult to debug issues and ensure reliability.";
    }
    if (label.includes('automation')) {
      return "Manual, repetitive tasks consume valuable time and introduce human error, limiting team scalability.";
    }
    if (label.includes('security')) {
      return "Security vulnerabilities and compliance requirements create risk and slow down development cycles.";
    }
    if (label.includes('data') || label.includes('analytics')) {
      return "Teams struggle to extract insights from growing data volumes and make data-driven decisions effectively.";
    }
    if (label.includes('collaboration')) {
      return "Distributed teams face challenges coordinating work and maintaining alignment across different tools and timezones.";
    }
    if (label.includes('deployment') || label.includes('infrastructure')) {
      return "Complex deployment processes and infrastructure management create bottlenecks and reduce deployment frequency.";
    }

    return `Current solutions for ${cluster.label.toLowerCase()} are fragmented, difficult to integrate, and fail to meet evolving team needs.`;
  }

  private buildWhyNow(cluster: ClusterData): string {
    const velocity = cluster.cluster_velocity;
    const diversity = cluster.source_diversity;
    const score = cluster.avg_weak_signal_score;

    let reasons: string[] = [];

    if (velocity > 15) {
      reasons.push("Rapidly accelerating interest across multiple communities");
    } else if (velocity > 8) {
      reasons.push("Growing momentum and community adoption");
    }

    if (diversity >= 4) {
      reasons.push("Strong signals across diverse sources (HackerNews, Reddit, GitHub, ProductHunt)");
    } else if (diversity >= 3) {
      reasons.push("Validated by multiple independent communities");
    }

    if (score > 60) {
      reasons.push("High-quality discussions indicate genuine market need");
    } else if (score > 45) {
      reasons.push("Emerging pattern with strong early validation");
    }

    const conceptText = cluster.concept_count > 5
      ? "Multiple interconnected concepts suggest a maturing ecosystem"
      : "Core concepts are crystallizing into actionable patterns";

    reasons.push(conceptText);

    return reasons.join(". ") + ".";
  }

  private buildDescription(cluster: ClusterData): string {
    const topConcepts = cluster.concepts.slice(0, 5).join(", ");

    return `An emerging opportunity in the ${cluster.label} space. Key themes include: ${topConcepts}. This trend is showing strong signals across multiple developer communities with ${cluster.source_diversity} distinct sources and a velocity score of ${Number(cluster.cluster_velocity).toFixed(1)}.`;
  }

  private async insertOpportunity(data: OpportunityInput): Promise<Opportunity> {
    const result = await db.execute(sql`
      INSERT INTO opportunities (
        title,
        description,
        pain_point,
        target_market,
        why_now,
        cluster_id,
        confidence_score,
        window_estimate
      )
      VALUES (
        ${data.title},
        ${data.description},
        ${data.painPoint},
        ${data.targetMarket},
        ${data.whyNow},
        ${data.clusterId},
        ${data.confidenceScore},
        ${data.windowEstimate}
      )
      RETURNING *
    `);

    return result.rows[0] as Opportunity;
  }

  async getTopOpportunities(limit: number = 20): Promise<Opportunity[]> {
    const result = await db.execute(sql`
      SELECT
        o.*,
        tc.label as cluster_label
      FROM opportunities o
      JOIN trend_clusters tc ON o.cluster_id = tc.id
      ORDER BY o.confidence_score DESC, o.created_at DESC
      LIMIT ${limit}
    `);

    return result.rows as Opportunity[];
  }

  async deleteOldOpportunities(daysToKeep: number = 30): Promise<number> {
    const result = await db.execute(sql`
      DELETE FROM opportunities
      WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
    `);

    return result.rowCount || 0;
  }
}

export const opportunityEngine = new OpportunityEngine();
