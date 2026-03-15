import { Request, Response, NextFunction } from "express";

function logSecurityEvent(req: Request, reason: string) {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";
  const route = req.originalUrl || req.url;
  const providedKey = req.headers["x-admin-key"] ? "provided" : "missing";

  console.error(
    `[SECURITY_EVENT] ${timestamp} | IP: ${ip} | Route: ${route} | User-Agent: ${userAgent} | Key: ${providedKey} | Reason: ${reason}`
  );
}

export function requireAdminKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const adminKey = req.headers["x-admin-key"];
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    res.status(500).json({ error: "Admin API key not configured" });
    return;
  }

  if (!adminKey) {
    logSecurityEvent(req, "Admin endpoint accessed without key");
    res.status(401).json({ error: "Unauthorized: Invalid or missing admin key" });
    return;
  }

  if (adminKey !== expectedKey) {
    logSecurityEvent(req, "Admin endpoint accessed with invalid key");
    res.status(401).json({ error: "Unauthorized: Invalid or missing admin key" });
    return;
  }

  next();
}
