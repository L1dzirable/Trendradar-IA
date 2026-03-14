import { Router } from "express";
import { db } from "../db";
import { trendHistory } from "../../shared/schema";
import { eq, desc, gte, sql } from "drizzle-orm";

const router = Router();

type LifecyclePhase = "emerging" | "rising" | "peaking" | "declining";

function getLifecycleFromScore(score: number): LifecyclePhase {
  if (score < 25) return "emerging";
  if (score < 60) return "rising";
  if (score < 85) return "peaking";
  return "declining";
}

interface HistoryRecord {
  score: number;
  signalCount: number;
  lifecycle: LifecyclePhase;
  recordedAt: string;
}

interface HistoryResponse {
  slug: string;
  history: HistoryRecord[];
}

router.get("/", async (req, res) => {
  try {
    const slugs = await db
      .selectDistinct({ slug: trendHistory.trendSlug })
      .from(trendHistory)
      .orderBy(trendHistory.trendSlug);

    res.json({ slugs: slugs.map(row => row.slug) });
  } catch (error) {
    console.error("Error fetching trend slugs:", error);
    res.status(500).json({ error: "Failed to fetch trend slugs" });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const records = await db
      .select({
        score: trendHistory.score,
        signalCount: trendHistory.signalCount,
        recordedAt: trendHistory.recordedAt,
      })
      .from(trendHistory)
      .where(
        sql`${trendHistory.trendSlug} = ${slug} AND ${trendHistory.recordedAt} >= ${ninetyDaysAgo}`
      )
      .orderBy(trendHistory.recordedAt);

    const history: HistoryRecord[] = records.map(record => ({
      score: record.score,
      signalCount: record.signalCount,
      lifecycle: getLifecycleFromScore(record.score),
      recordedAt: record.recordedAt.toISOString(),
    }));

    const response: HistoryResponse = {
      slug,
      history,
    };

    res.json(response);
  } catch (error) {
    console.error(`Error fetching history for slug ${req.params.slug}:`, error);
    res.status(500).json({ error: "Failed to fetch trend history" });
  }
});

export default router;
