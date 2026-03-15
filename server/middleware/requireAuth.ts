import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import type { User } from "../../shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }

  req.user = user;
  next();
}

export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const { userId } = getAuth(req);

  if (userId) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (user) req.user = user;
  }

  next();
}