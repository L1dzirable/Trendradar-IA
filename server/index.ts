import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { clerkMiddleware } from "@clerk/express";
import { attachUser } from "./middleware/requireAuth";
import { publicEndpointLimiter, billingLimiter, exportLimiter, adminEndpointLimiter } from "./middleware/rateLimiter";
import stripeRoutes from "./routes/stripe";
import authRoutes from "./routes/auth";
import billingRoutes from "./routes/billing";
import opportunityRoutes from "./routes/opportunities";
import exportRoutes from "./routes/export";
import graphRoutes from "./routes/graph";
import historyRoutes from "./routes/history";
import predictionsRoutes from "./routes/predictions";
import alertsRoutes from "./routes/alerts";
import weakSignalsRoutes from "./routes/weakSignals";

try {
  require('./scheduler');
  console.log('[server] scheduler initialized');
} catch (error: any) {
  console.error('[server] scheduler failed to initialize:', error.message);
}

const app = express();
const httpServer = createServer(app);

// 1. Webhooks raw EN PREMIER — avant tout body parser
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeRoutes
);
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  billingRoutes
);
app.post(
  "/api/auth/webhook",
  express.raw({ type: "application/json" }),
  authRoutes
);

// 2. Body parsers globaux
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 3. Clerk + attachUser
app.use(clerkMiddleware());
app.use(attachUser);

// 4. Logger
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      console.log(logLine);
    }
  });

  next();
});

// 5. Routes API
async function startServer() {
  // Routes API with rate limiting
  app.use("/api/stripe", stripeRoutes);
  app.use("/api/billing", billingLimiter, billingRoutes);
  app.use("/api/export", exportLimiter, exportRoutes);
  app.use("/api/auth", publicEndpointLimiter, authRoutes);
  app.use("/api/opportunities", publicEndpointLimiter, opportunityRoutes);
  app.use("/api/graph", publicEndpointLimiter, graphRoutes);
  app.use("/api/history", publicEndpointLimiter, historyRoutes);
  app.use("/api/predictions", publicEndpointLimiter, predictionsRoutes);
  app.use("/api/alerts", publicEndpointLimiter, alertsRoutes);
  app.use("/api/admin/weak-signals", adminEndpointLimiter, weakSignalsRoutes);

  await registerRoutes(app, httpServer);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(app, httpServer);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // This serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);

  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      console.log(`serving on port ${port}`);

      const { startPredictionCron } = require("./services/predictionCron");
      startPredictionCron();
    }
  );
}

startServer();