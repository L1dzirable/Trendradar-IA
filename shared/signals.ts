import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  jsonb,
  uuid,
  varchar,
  index,
  unique
} from "drizzle-orm/pg-core";
import { signals } from "./schema";

export type LifecyclePhase =
  | "emerging"
  | "rising"
  | "peaking"
  | "declining";

export type MacroDriver =
  | "ai_adoption"
  | "regulatory_pressure"
  | "cost_reduction"
  | "developer_tooling"
  | "remote_work"
  | "platform_shift"
  | "unknown";

export type PainSignalClass =
  | 'complaint'
  | 'workaround'
  | 'request'
  | 'validation'
  | 'job_signal'
  | null;

export interface AggregatedSignal {
  title: string;
  source: string;
  keywords?: string[];
  score: number;
  engagement?: number;
  createdAt: Date;
  painClass?: PainSignalClass;
  sourceWeight?: number;
  inferredPainPoint?: string;
}

export interface OpportunityScoreFactors {
  painIntensity: number;
  demandRecurrence: number;
  marketGap: number;
  engagementDepth: number;
  monetisationFit: number;
  total: number;
}

export type GapType =
  | 'validated_demand'
  | 'diy_evidence'
  | 'emerging_interest';

export interface MarketGapCluster {
  keyword: string;
  signalCount: number;
  gapScore: number;
  gapType: GapType;
  signals: AggregatedSignal[];
}

export type VelocityStatus =
  | 'accelerating'
  | 'peaking'
  | 'fading';

export interface TrendVelocity {
  keyword: string;
  signalCount7d: number;
  signalCount14d: number;
  velocity: number;
  changePercent: number;
}

export interface EnrichedOpportunity {
  topic: string;
  trendName: string;
  trendSlug: string;
  explanation: string;
  businessIdea: string;
  monetization: string;
  difficultyScore: number;
  createdAt: Date;
  signalCount: number;

  scoreFactors: OpportunityScoreFactors;
  opportunityScore: number;
  opportunityLabel: 'High' | 'Watch' | 'Emerging' | 'Noise';

  painClass: PainSignalClass;
  velocity: number;
  lifecycle: LifecyclePhase;
  macroDriver: MacroDriver;
  gapType: GapType | null;
  icp: string;
  competitorGap: string;
  earlyCustomerHypothesis: string;

  signalQuality?: number;
  signalSources?: string[];
}

// ─────────────────────────────────────────────
// Weak Signal Engine tables
// ─────────────────────────────────────────────

export const conceptNodes = pgTable("concept_nodes", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  labelIdx: unique().on(table.label),
}));

export const conceptMentions = pgTable("concept_mentions", {
  id: serial("id").primaryKey(),

  signalId: integer("signal_id")
    .notNull()
    .references(() => signals.id, { onDelete: "cascade" }),

  conceptNodeId: integer("concept_node_id")
    .notNull()
    .references(() => conceptNodes.id, { onDelete: "cascade" }),

  extractedAt: timestamp("extracted_at").defaultNow().notNull(),
}, (table) => ({
  signalConceptIdx: unique().on(table.signalId, table.conceptNodeId),
}));

export const edgeSnapshots = pgTable("edge_snapshots", {
  id: serial("id").primaryKey(),

  conceptA: text("concept_a").notNull(),
  conceptB: text("concept_b").notNull(),

  signalId: integer("signal_id")
    .notNull()
    .references(() => signals.id, { onDelete: "cascade" }),

  source: text("source").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  edgeSignalIdx: unique().on(table.conceptA, table.conceptB, table.signalId),
}));