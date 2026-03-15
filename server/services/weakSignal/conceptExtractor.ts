import { db } from "../../db";
import { conceptNodes, conceptMentions } from "../../../shared/schema";
import { sql } from "drizzle-orm";
import type { PersistedSignal } from "../../persist";

const STOPWORDS = new Set([
  "about", "after", "also", "been", "before", "being", "between",
  "could", "does", "during", "each", "even", "from", "have", "here",
  "http", "https", "into", "just", "like", "make", "more", "most",
  "nbsp", "need", "only", "other", "over", "should", "some", "such",
  "than", "that", "their", "them", "then", "there", "these", "they",
  "this", "through", "time", "very", "was", "were", "what", "when",
  "where", "which", "while", "will", "with", "would", "your",
]);

const TECHNICAL_UNIGRAMS = new Set([
  "kubernetes", "terraform", "docker", "graphql", "grpc", "oauth",
  "webhook", "microservice", "serverless", "observability", "latency",
  "throughput", "embeddings", "tokenizer", "retrieval", "inference",
  "finetuning", "finetuned", "quantization", "distillation",
  "api", "auth", "saas", "sdk", "cli", "iam", "sso", "rbac",
  "token", "cache", "queue", "proxy", "vault", "mesh", "cron",
  "cors", "csrf", "jwt", "tls", "mtls", "cicd", "devops",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function isStopword(token: string): boolean {
  return STOPWORDS.has(token);
}

function extractConcepts(title: string, body: string | null | undefined): string[] {

  console.log(`[weakSignal:debug:6] extractConcepts called title="${title}" body=${body === null ? "null" : `"${body}"`}`);
  
  const tokens = tokenize(`${title} ${body ?? ""}`);

  console.log(`[weakSignal:debug:7] tokens:`, tokens);
  
  const concepts = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    const t0 = tokens[i];
    const t1 = tokens[i + 1];
    const t2 = tokens[i + 2];

    if (t1 && t2 && !isStopword(t0) && !isStopword(t1) && !isStopword(t2)) {
      concepts.add(`${t0} ${t1} ${t2}`);
    }

    if (t1 && !isStopword(t0) && !isStopword(t1)) {
      concepts.add(`${t0} ${t1}`);
    }

    if (!isStopword(t0) && (TECHNICAL_UNIGRAMS.has(t0) || t0.length >= 4)) {
      concepts.add(t0);
    }
  }

  return [...concepts];
}

async function upsertConceptNode(concept: string, source: string): Promise<number> {
  const now = new Date();

  const [row] = await db
    .insert(conceptNodes)
    .values({
      concept,
      firstSeen: now,
      lastSeen: now,
      mentionCount: 1,
      sourceDistribution: sql`jsonb_build_object(${source}, 1)`,
    })
    .onConflictDoUpdate({
      target: [conceptNodes.concept],
      set: {
        lastSeen: now,
        mentionCount: sql`${conceptNodes.mentionCount} + 1`,
        sourceDistribution: sql`jsonb_set(
          COALESCE(${conceptNodes.sourceDistribution}, '{}'::jsonb),
          array[${source}],
          COALESCE(
            (${conceptNodes.sourceDistribution}->>${source})::int + 1,
            1
          )::text::jsonb
        )`,
      },
    })
    .returning({ id: conceptNodes.id });
  return row.id;
}

export type SignalForExtraction = PersistedSignal & {
  title: string;
  body?: string | null;
};

export async function upsertConceptsFromSignal(
  signal: SignalForExtraction
): Promise<number[]> {
  const labels = extractConcepts(signal.title, signal.body);
  if (labels.length === 0) return [];

  const conceptNodeIds: number[] = [];

  for (const concept of labels) {
  const nodeId = await upsertConceptNode(concept, signal.source);
  conceptNodeIds.push(nodeId);
  await db
    .insert(conceptMentions)
    .values({ signalId: signal.id, conceptId: nodeId })
    .onConflictDoNothing();
  }

  return conceptNodeIds;
}