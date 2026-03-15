import { Router, Request, Response } from "express";
import { getCachedOpportunities }    from "../services/opportunityEngine";
import { getOpportunityLimit }        from "../config/plans";
import type { PlanId }                from "../config/plans";
import { db } from "../db";
import { signals } from "../../shared/schema";
import { sql, eq } from "drizzle-orm";

const router = Router();

// Helper to get signal sources and quality for opportunities
async function enrichWithSignalSources(opportunities: any[]) {
  try {
    const slugs = opportunities.map(o => o.trendSlug).filter(Boolean);
    if (slugs.length === 0) return opportunities;

    // Query to get unique sources per trend slug by matching keywords
    const sourcesQuery = await db
      .select({
        keyword: signals.keyword,
        sources: sql<string[]>`array_agg(DISTINCT ${signals.source})`,
        avgQuality: sql<number>`ROUND(AVG(${signals.qualityScore}))`,
        qualityCount: sql<number>`COUNT(${signals.qualityScore})`,
      })
      .from(signals)
      .where(sql`${signals.keyword} IS NOT NULL`)
      .groupBy(signals.keyword);

    const dataByKeyword = new Map<string, { sources: string[], avgQuality: number, count: number }>();
    for (const row of sourcesQuery) {
      if (row.keyword) {
        dataByKeyword.set(row.keyword.toLowerCase(), {
          sources: row.sources,
          avgQuality: row.avgQuality || 5,
          count: row.qualityCount || 0,
        });
      }
    }

    return opportunities.map(opp => {
      // Try to find sources based on the trend name/slug keywords
      const keywords = (opp.trendSlug || '').split('-').filter((k: string) => k.length > 3);
      const sources = new Set<string>();
      let totalQuality = 0;
      let qualityCount = 0;

      for (const keyword of keywords) {
        const keywordData = dataByKeyword.get(keyword.toLowerCase());
        if (keywordData) {
          keywordData.sources.forEach(s => sources.add(s));
          totalQuality += keywordData.avgQuality * keywordData.count;
          qualityCount += keywordData.count;
        }
      }

      const signalQuality = qualityCount > 0 ? Math.round(totalQuality / qualityCount) : 5;

      return {
        ...opp,
        signalSources: Array.from(sources),
        signalQuality,
      };
    });
  } catch (err) {
    console.error('[opportunities] Error enriching signal sources:', err);
    return opportunities;
  }
}

// GET /api/opportunities?topic=ai&page=1
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const plan  = (req.user?.plan ?? "free") as PlanId;
    const topic = req.query.topic as string | undefined;
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 10;
    const cap   = getOpportunityLimit(plan);

    const all    = await getCachedOpportunities(topic);
    const enriched = await enrichWithSignalSources(all);
    const capped = cap === -1 ? enriched : enriched.slice(0, cap);
    const offset = (page - 1) * limit;
    const data   = capped.slice(offset, offset + limit);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total:      capped.length,
        totalPages: Math.ceil(capped.length / limit),
        hasMore:    offset + data.length < capped.length,
      },
      meta: {
        plan,
        cap,
        total_available: enriched.length,
        upgrade_url: cap !== -1 && enriched.length > cap ? "/pricing" : null,
      },
    });
  } catch (err) {
    console.error("[Opportunities] Erreur:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/opportunities/:index — détail (founder+ uniquement)
router.get("/:index", async (req: Request, res: Response): Promise<void> => {
  const plan = (req.user?.plan ?? "free") as PlanId;

  if (plan === "free") {
    res.status(403).json({
      error:       "Détail réservé aux plans payants",
      upgrade_url: "/pricing",
    });
    return;
  }

  try {
    const all = await getCachedOpportunities();
    const idx = parseInt(Array.isArray(req.params.index) ? req.params.index[0] : req.params.index);
    const opp = all[idx];

    if (!opp) {
      res.status(404).json({ error: "Opportunité introuvable" });
      return;
    }

    res.json({ data: opp });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;