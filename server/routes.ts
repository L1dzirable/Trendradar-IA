import type { Express } from "express";
import type { Server } from "http";
import { getRedditSignals } from "./services/redditSignals";
import { getHackerNewsSignals } from "./services/hackerNewsSignals";
import { getProductHuntSignals } from "./services/productHuntSignals";
import { getAggregatedSignals } from "./services/signalAggregator";
import { getCachedOpportunities } from "./services/opportunityEngine";
import { publicEndpointLimiter } from "./middleware/rateLimiter";

export async function registerRoutes(app: Express, httpServer: Server): Promise<Server> {

  // Get aggregated signals from all sources
  app.get("/api/signals/combined", publicEndpointLimiter, async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === "true";
      const signals = await getAggregatedSignals(forceRefresh);
      return res.json({ signals, count: signals.length });
    } catch (err) {
      console.error("Error fetching aggregated signals:", err);
      return res.status(500).json({ error: "Failed to fetch aggregated signals" });
    }
  });

  // Get Reddit market signals
  app.get("/api/signals/reddit", publicEndpointLimiter, async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === "true";
      const signals = await getRedditSignals(forceRefresh);
      return res.json({ signals, count: signals.length });
    } catch (err) {
      console.error("Error fetching Reddit signals:", err);
      return res.status(500).json({ error: "Failed to fetch Reddit signals" });
    }
  });

  // Get Hacker News market signals
  app.get("/api/signals/hackernews", publicEndpointLimiter, async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === "true";
      const signals = await getHackerNewsSignals(forceRefresh);
      return res.json({ signals, count: signals.length });
    } catch (err) {
      console.error("Error fetching Hacker News signals:", err);
      return res.status(500).json({ error: "Failed to fetch Hacker News signals" });
    }
  });

  // Get Product Hunt market signals
  app.get("/api/signals/producthunt", publicEndpointLimiter, async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === "true";
      const signals = await getProductHuntSignals(forceRefresh);
      return res.json({ signals, count: signals.length });
    } catch (err) {
      console.error("Error fetching Product Hunt signals:", err);
      return res.status(500).json({ error: "Failed to fetch Product Hunt signals" });
    }
  });

  // Generate SaaS opportunities
app.get("/api/opportunities", publicEndpointLimiter, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === "true";

    const topic = String(req.query.topic || "").trim();
    
    const data = await 
      getCachedOpportunities(topic, forceRefresh);

    return res.json(data);
  } catch (err) {
    console.error("Error generating opportunities:", err);
    return res.status(500).json({
      error: "Failed to generate opportunities"
    });
  }
});

  app.get("/api/trends", publicEndpointLimiter, async (req, res) => {

  const topic = String(req.query.topic || "").trim();

  const trends = await getCachedOpportunities(topic);

  res.json(trends);

});

app.post("/api/trends", publicEndpointLimiter, async (req, res) => {
  try {
    const topic = String(req.body?.topic || "").trim();
    const forceRefresh = req.query.refresh === "true";

    const trends = await getCachedOpportunities(topic, forceRefresh);

    return res.json({ trends });

  } catch (err) {
    console.error("Error generating trends:", err);
    return res.status(500).json({
      error: "trend generation failed"
    });
  }
});

  return httpServer;
}