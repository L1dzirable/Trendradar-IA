import { pgTable, text, serial, integer, timestamp, jsonb, uuid, varchar, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { unique } from "drizzle-orm/pg-core";

export const trends = pgTable("trends", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  trendName: text("trend_name").notNull(),
  explanation: text("explanation").notNull(),
  businessIdea: text("business_idea").notNull(),
  monetization: text("monetization").notNull(),
  difficultyScore: integer("difficulty_score").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),

  source: text("source").notNull(),          // reddit / hn / producthunt
  externalId: text("external_id").notNull(), // id original plateforme

  title: text("title").notNull(),
  body: text("body"),

  url: text("url"),

  score: integer("score").default(0),
  commentCount: integer("comment_count").default(0),

  keyword: text("keyword"),

  rawJson: jsonb("raw_json"),

  qualityScore: integer("quality_score").default(5),
  qualityFactors: jsonb("quality_factors").default({}),

  // Roadmap Foundation Layer requirements
  rawText: text("raw_text"),           // Original unprocessed text
  rawSourceUrl: text("raw_source_url"), // Canonical source URL

  collectedAt: timestamp("collected_at").defaultNow().notNull(),
  }, (table) => {
  return {
    uniqueSourceExternal: unique().on(table.source, table.externalId)
  };
});

export const insertTrendSchema = createInsertSchema(trends).omit({ id: true, createdAt: true });

export type Trend = typeof trends.$inferSelect;
export type InsertTrend = z.infer<typeof insertTrendSchema>;

// API request schema
export const generateTrendRequestSchema = z.object({
  topic: z.string().min(1, "Please enter a topic"),
});

export type GenerateTrendRequest = z.infer<typeof generateTrendRequestSchema>;

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: varchar("clerk_id", { length: 255 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  fullName: varchar("full_name", { length: 255 }),
  plan: varchar("plan", { length: 50 }).default("free").notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).unique(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }).unique(),
  subscriptionStatus: varchar("subscription_status", { length: 50 }).default("inactive"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usageLogs = pgTable("usage_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const opportunities = pgTable("opportunities", {
  id:          uuid("id").primaryKey().defaultRandom(),
  title:       varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  category:    varchar("category", { length: 100 }),
  score:       integer("score").default(0),        // score de pertinence 0-100
  sources: jsonb("sources").$type<string[]>().default([]),
signalIds: jsonb("signal_ids").$type<string[]>().default([]),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

export const trendHistory = pgTable("trend_history", {
  id: serial("id").primaryKey(),
  trendSlug: varchar("trend_slug", { length: 255 }).notNull(),
  score: integer("score").notNull(),
  signalCount: integer("signal_count").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
}, (table) => ({
  trendSlugIdx: index("trend_history_slug_idx").on(table.trendSlug),
}));

export type Opportunity    = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UsageLog = typeof usageLogs.$inferSelect;
export type NewUsageLog = typeof usageLogs.$inferInsert;
export type Plan = "free" | "founder" | "pro" | "agency";
export const alertSubscriptions = pgTable("alert_subscriptions", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  trendSlug: varchar("trend_slug", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  confirmed: boolean("confirmed").default(false),
}, (table) => ({
  emailTrendUniq: unique().on(table.email, table.trendSlug),
}));

export const lifecycleChangeEvents = pgTable("lifecycle_change_events", {
  id: serial("id").primaryKey(),
  trendSlug: varchar("trend_slug", { length: 255 }).notNull(),
  fromLifecycle: varchar("from_lifecycle", { length: 50 }),
  toLifecycle: varchar("to_lifecycle", { length: 50 }).notNull(),
  detectedAt: timestamp("detected_at").defaultNow(),
  notified: boolean("notified").default(false),
});

export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }).notNull(),
  predictionText: text("prediction_text").notNull(),
  methodologyNotes: text("methodology_notes"),

  // Stage 1: Auto-draft
  draftedAt: timestamp("drafted_at").defaultNow().notNull(),
  draftScore: integer("draft_score").notNull(),
  draftSignalCount: integer("draft_signal_count").notNull(),
  draftSignalSnapshot: jsonb("draft_signal_snapshot").$type<any[]>().default([]),

  // Stage 2: Auto-promote
  publishedAt: timestamp("published_at"),
  isPublished: boolean("is_published").default(false),

  // Stage 3: Human verification
  status: varchar("status", { length: 20 }).default("draft"),
  verifiedAt: timestamp("verified_at"),
  verificationEvidence: text("verification_evidence"),
  verificationUrl: text("verification_url"),
  leadTimeDays: integer("lead_time_days"),

  autoCreated: boolean("auto_created").default(false),
}, (table) => ({
  oppIdIdx: index("predictions_opportunity_id_idx").on(table.opportunityId),
}));

export const conceptNodes = pgTable("concept_nodes", {
  id: serial("id").primaryKey(),
  concept: text("concept").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  label: text("label"),
  firstSeen: timestamp("first_seen"),
  lastSeen: timestamp("last_seen"),
  mentionCount: integer("mention_count").default(0),
  sourceDistribution: jsonb("source_distribution").default({}),
  weakSignalScore: integer("weak_signal_score").default(0),
  velocityScore: text("velocity_score").default("0"),
  frequencyScore: integer("frequency_score").default(0),
  diversityScore: integer("diversity_score").default(0),
  recencyScore: integer("recency_score").default(0),
  cooccurrenceScore: integer("cooccurrence_score").default(0),
  scoreUpdatedAt: timestamp("score_updated_at"),
}, (table) => ({
  conceptUniq: unique().on(table.concept),
}));

export const conceptMentions = pgTable("concept_mentions", {
  id: serial("id").primaryKey(),
  signalId: integer("signal_id").notNull().references(() => signals.id, { onDelete: "cascade" }),
  conceptId: integer("concept_id").notNull().references(() => conceptNodes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  signalConceptUniq: unique().on(table.signalId, table.conceptId),
}));

export const edgeSnapshots = pgTable(
  "edge_snapshots",
  {
    id:        serial("id").primaryKey(),
    conceptA:  text("concept_a").notNull(),
    conceptB:  text("concept_b").notNull(),
    weight:    integer("weight").default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    signalId:  integer("signal_id")
                 .references(() => signals.id, { onDelete: "cascade" }),
  }
);

export type EdgeSnapshot    = typeof edgeSnapshots.$inferSelect;
export type NewEdgeSnapshot = typeof edgeSnapshots.$inferInsert;
export type AlertSubscription = typeof alertSubscriptions.$inferSelect;
export type NewAlertSubscription = typeof alertSubscriptions.$inferInsert;
export type LifecycleChangeEvent = typeof lifecycleChangeEvents.$inferSelect;
export type NewLifecycleChangeEvent = typeof lifecycleChangeEvents.$inferInsert;
export type Prediction = typeof predictions.$inferSelect;
export type NewPrediction = typeof predictions.$inferInsert;