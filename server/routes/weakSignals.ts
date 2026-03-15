import { Router } from "express";
import { requireAdminKey } from "../middleware/requireAdminKey";
import { adminEndpointLimiter } from "../middleware/rateLimiter";
import { runWeakSignalScoring, getTopWeakSignals } from "../services/weakSignal/conceptScorer";
import { runTrendClustering, getTopClusters } from "../services/weakSignal/trendClusterer";
import { opportunityEngine } from "../services/opportunity/opportunityEngine";
import { predictionEngine } from "../services/predictions/predictionEngine";

const router = Router();

router.post("/run-scoring", requireAdminKey, adminEndpointLimiter, async (req, res) => {
  try {
    console.log("[WeakSignals] Admin triggered scoring run");

    const startTime = Date.now();
    const stats = await runWeakSignalScoring();

    return res.json({
      success: true,
      conceptsScored: stats.conceptsScored,
      topConcepts: stats.topConcepts,
      durationMs: stats.durationMs,
      scoreDistribution: stats.scoreDistribution,
    });
  } catch (err) {
    console.error("[WeakSignals] Scoring failed:", err);
    return res.status(500).json({
      success: false,
      error: "Weak signal scoring failed",
    });
  }
});

router.get("/top", adminEndpointLimiter, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const topSignals = await getTopWeakSignals(limit);

    return res.json({
      success: true,
      concepts: topSignals,
      count: topSignals.length,
    });
  } catch (err) {
    console.error("[WeakSignals] Failed to get top signals:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve top weak signals",
    });
  }
});

router.post("/run-clustering", requireAdminKey, adminEndpointLimiter, async (req, res) => {
  try {
    console.log("[TrendClusters] Admin triggered clustering run");

    const result = await runTrendClustering();

    return res.json({
      success: result.success,
      clustersCreated: result.clustersCreated,
      conceptsClustered: result.conceptsClustered,
      durationMs: result.durationMs,
      topClusters: result.topClusters,
    });
  } catch (err) {
    console.error("[TrendClusters] Clustering failed:", err);
    return res.status(500).json({
      success: false,
      error: "Trend clustering failed",
    });
  }
});

router.get("/clusters/top", adminEndpointLimiter, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const topClusters = await getTopClusters(limit);

    return res.json({
      success: true,
      clusters: topClusters,
      count: topClusters.length,
    });
  } catch (err) {
    console.error("[TrendClusters] Failed to get top clusters:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve top trend clusters",
    });
  }
});

router.post("/run-opportunity-generation", requireAdminKey, adminEndpointLimiter, async (req, res) => {
  try {
    console.log("[OpportunityEngine] Admin triggered opportunity generation");

    const startTime = Date.now();
    const opportunities = await opportunityEngine.generateOpportunities();
    const durationMs = Date.now() - startTime;

    const topOpportunities = opportunities
      .slice(0, 5)
      .map(opp => ({
        title: opp.title,
        confidence_score: opp.confidence_score,
        window_estimate: opp.window_estimate,
      }));

    return res.json({
      success: true,
      opportunitiesCreated: opportunities.length,
      topOpportunities,
      durationMs,
    });
  } catch (err) {
    console.error("[OpportunityEngine] Generation failed:", err);
    return res.status(500).json({
      success: false,
      error: "Opportunity generation failed",
    });
  }
});

router.post("/run-prediction-generation", requireAdminKey, adminEndpointLimiter, async (req, res) => {
  try {
    console.log("[PredictionEngine] Admin triggered prediction generation");

    const startTime = Date.now();
    const predictions = await predictionEngine.generatePredictions();
    const durationMs = Date.now() - startTime;

    const topPredictions = predictions
      .slice(0, 5)
      .map(pred => ({
        title: pred.title,
        confidence_score: pred.confidence_score,
        predicted_window: pred.predicted_window,
        status: pred.status,
      }));

    return res.json({
      success: true,
      predictionsCreated: predictions.length,
      topPredictions,
      durationMs,
    });
  } catch (err) {
    console.error("[PredictionEngine] Generation failed:", err);
    return res.status(500).json({
      success: false,
      error: "Prediction generation failed",
    });
  }
});

export default router;
