import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { usageLogs } from "../../shared/schema";
import { and, eq, gte, count } from "drizzle-orm";
import { PLANS } from "../config/plans";

export function requirePlan(allowed: string | string[]) {
  const allowedPlans = Array.isArray(allowed) ? allowed : [allowed];

  return (req: Request, res: Response, next: NextFunction): void => {
    const userPlan = req.user?.plan ?? "free";
    const subStatus = req.user?.subscriptionStatus;

    if (userPlan !== "free" && subStatus !== "active") {
      res.status(403).json({
        error: "Abonnement inactif",
        upgrade_url: "/pricing",
      });
      return;
    }

    if (!allowedPlans.includes(userPlan)) {
      res.status(403).json({
        error: "Plan insuffisant",
        current_plan: userPlan,
        upgrade_url: "/pricing",
      });
      return;
    }

    next();
  };
}

export function checkUsageLimit(action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Non authentifié" });
      return;
    }

    const plan = PLANS[req.user.plan as keyof typeof PLANS];
    const limit = plan.limits[action as keyof typeof plan.limits];

    if (limit === -1) {
      next();
      return;
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [result] = await db
      .select({ total: count() })
      .from(usageLogs)
      .where(
        and(
          eq(usageLogs.userId, req.user.id),
          eq(usageLogs.action, action),
          gte(usageLogs.createdAt, startOfMonth)
        )
      );

    if ((result?.total ?? 0) >= limit) {
      res.status(429).json({
        error: "Limite mensuelle atteinte",
        limit,
      });
      return;
    }

    next();
  };
}