import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetAt < now) {
      delete store[key];
    }
  });
}, 60000);

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipFailedRequests?: boolean;
}

function logBlockedRequest(req: Request, reason: string) {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";
  const route = req.originalUrl || req.url;

  console.warn(
    `[RATE_LIMIT_BLOCKED] ${timestamp} | IP: ${ip} | Route: ${route} | User-Agent: ${userAgent} | Reason: ${reason}`
  );
}

export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = "Too many requests, please try again later",
    keyGenerator = (req: Request) => req.ip || req.socket.remoteAddress || "unknown",
    skipFailedRequests = false,
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!store[key] || store[key].resetAt < now) {
      store[key] = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    store[key].count++;

    const remaining = Math.max(0, maxRequests - store[key].count);
    const resetAt = store[key].resetAt;

    res.setHeader("X-RateLimit-Limit", maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", remaining.toString());
    res.setHeader("X-RateLimit-Reset", new Date(resetAt).toISOString());

    if (store[key].count > maxRequests) {
      logBlockedRequest(req, `Exceeded ${maxRequests} requests per ${windowMs}ms window`);

      res.status(429).json({
        error: message,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      });
      return;
    }

    if (skipFailedRequests) {
      res.on("finish", () => {
        if (res.statusCode >= 400) {
          store[key].count = Math.max(0, store[key].count - 1);
        }
      });
    }

    next();
  };
}

export const publicEndpointLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  message: "Too many requests from this IP, please try again later",
});

export const strictEndpointLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: "Rate limit exceeded for this endpoint",
});

export const adminEndpointLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: "Admin endpoint rate limit exceeded",
  keyGenerator: (req: Request) => {
    const adminKey = req.headers["x-admin-key"] as string;
    return `admin:${adminKey || req.ip || "unknown"}`;
  },
});

export const billingLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  message: "Too many billing requests, please try again later",
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id;
    return userId ? `user:${userId}` : `ip:${req.ip || "unknown"}`;
  },
});

export const exportLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  message: "Export limit exceeded, please try again later",
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id;
    return userId ? `user:${userId}` : `ip:${req.ip || "unknown"}`;
  },
});
