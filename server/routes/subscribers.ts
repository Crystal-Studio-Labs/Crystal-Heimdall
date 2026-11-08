import { Router, Request, Response } from "express";
import crypto from "crypto";
import { getDb, initDb } from "../db.js";
import { isOperatorReq } from "./auth.js";
import { createRateLimiter } from "../rateLimiter.js";
import { sendIncidentEmail } from "../email.js";

const router = Router();

// Rate limiter: Max 20 subscription operations per 15 mins per IP to prevent spamming
const subscribeLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Subscription rate limit exceeded. Please wait a few minutes before trying again.",
});

// Helper to mask target for privacy
export function maskTarget(target: string, type: "email" | "webhook"): string {
  if (type === "email") {
    const parts = target.split("@");
    if (parts.length !== 2) return "***";
    const user = parts[0];
    const domain = parts[1];
    const maskedUser = user.length <= 2 ? user[0] + "***" : user.slice(0, 2) + "***" + user.slice(-1);
    return `${maskedUser}@${domain}`;
  } else {
    try {
      const url = new URL(target);
      return `${url.protocol}//${url.hostname}/...${target.slice(-6)}`;
    } catch {
      return "***";
    }
  }
}

// 1. POST /api/v1/subscribers - Public Registration
router.post("/", subscribeLimiter, async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { type, target, scope = "all" } = req.body;

    const cleanType = String(type || "").trim().toLowerCase();
    if (cleanType !== "email" && cleanType !== "webhook") {
      return res.status(400).json({ error: "Invalid type. Must be 'email' or 'webhook'." });
    }

    const rawTarget = String(target || "").trim();
    if (!rawTarget) {
      return res.status(400).json({ error: "Subscription target (email or webhook URL) is required." });
    }

    let cleanTarget = rawTarget;
    if (cleanType === "email") {
      cleanTarget = cleanTarget.toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanTarget) || cleanTarget.length > 255) {
        return res.status(400).json({ error: "Invalid email address format." });
      }
    } else {
      try {
        const parsedUrl = new URL(cleanTarget);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          return res.status(400).json({ error: "Webhook must use http or https protocol." });
        }
      } catch {
        return res.status(400).json({ error: "Invalid webhook URL format." });
      }
    }

    const cleanScope = ["all", "critical"].includes(String(scope).toLowerCase())
      ? String(scope).toLowerCase()
      : "all";

    // Check if destination is already registered
    const existingRes = await db.execute({
      sql: "SELECT * FROM subscribers WHERE target = ? LIMIT 1",
      args: [cleanTarget],
    });

    const now = Date.now();
    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0] as any;
      if (Number(existing.is_active) === 1) {
        return res.status(200).json({
          status: "subscribed",
          alreadySubscribed: true,
          id: existing.id,
          type: existing.type,
          target: maskTarget(existing.target, existing.type),
          scope: existing.scope,
          token: existing.token,
          message: "Destination is already subscribed to system incident alerts.",
        });
      } else {
        // Reactivate subscription
        await db.execute({
          sql: "UPDATE subscribers SET is_active = 1, scope = ? WHERE id = ?",
          args: [cleanScope, existing.id],
        });
        return res.status(200).json({
          status: "subscribed",
          id: existing.id,
          type: existing.type,
          target: maskTarget(existing.target, existing.type),
          scope: cleanScope,
          token: existing.token,
          message: "Subscription successfully reactivated.",
        });
      }
    }

    const id = `sub-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const token = crypto.randomBytes(16).toString("hex");

    await db.execute({
      sql: "INSERT INTO subscribers (id, type, target, scope, token, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
      args: [id, cleanType, cleanTarget, cleanScope, token, now],
    });

    return res.status(201).json({
      status: "subscribed",
      id,
      type: cleanType,
      target: maskTarget(cleanTarget, cleanType as any),
      scope: cleanScope,
      token,
      message: "Successfully subscribed to incident alerts. Real-time notices will dispatch automatically.",
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to create subscription", details: err.message });
  }
});

// 2. GET /api/v1/subscribers - Operator Listing
router.get("/", async (req: Request, res: Response) => {
  try {
    if (!isOperatorReq(req)) {
      return res.status(401).json({ error: "Operator authentication required." });
    }

    await initDb();
    const db = getDb();

    const result = await db.execute("SELECT * FROM subscribers ORDER BY created_at DESC");
    const subscribers = result.rows as any[];

    const activeList = subscribers.filter((s) => Number(s.is_active) === 1);
    const emailCount = activeList.filter((s) => s.type === "email").length;
    const webhookCount = activeList.filter((s) => s.type === "webhook").length;

    return res.json({
      total: activeList.length,
      emailCount,
      webhookCount,
      subscribers: subscribers.map((s) => ({
        id: s.id,
        type: s.type,
        target: s.target,
        maskedTarget: maskTarget(s.target, s.type),
        scope: s.scope,
        token: s.token,
        isActive: Number(s.is_active) === 1,
        createdAt: s.created_at,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to list subscribers", details: err.message });
  }
});

// 3. DELETE /api/v1/subscribers/:id - Unsubscribe conduit (Operator OR token-based)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;
    const token = req.query.token as string | undefined;

    const subRes = await db.execute({
      sql: "SELECT * FROM subscribers WHERE id = ? LIMIT 1",
      args: [id],
    });

    if (subRes.rows.length === 0) {
      return res.status(404).json({ error: "Subscriber not found." });
    }

    const subscriber = subRes.rows[0] as any;
    const isOperator = isOperatorReq(req);
    const isTokenMatch = token && token.trim() === subscriber.token;

    if (!isOperator && !isTokenMatch) {
      return res.status(403).json({ error: "Invalid unsubscription credentials or token." });
    }

    await db.execute({
      sql: "DELETE FROM subscribers WHERE id = ?",
      args: [id],
    });

    return res.json({
      status: "unsubscribed",
      message: "You have been successfully removed from incident alerts.",
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to unsubscribe", details: err.message });
  }
});

// 4. Incident Broadcast Hook for Subscribers
export async function notifySubscribers(incident: {
  id: string;
  title: string;
  severity: "info" | "warning" | "critical";
  message?: string;
  status: string;
  serviceName?: string;
}): Promise<{ deliveredCount: number; subscriberCount: number }> {
  try {
    const db = getDb();
    const res = await db.execute("SELECT * FROM subscribers WHERE is_active = 1");
    const activeSubscribers = res.rows as any[];

    if (activeSubscribers.length === 0) {
      return { deliveredCount: 0, subscriberCount: 0 };
    }

    let delivered = 0;
    const isCritical = incident.severity === "critical" || incident.status === "outage";

    for (const sub of activeSubscribers) {
      // Check scope
      if (sub.scope === "critical" && !isCritical) {
        continue;
      }

      if (sub.type === "webhook") {
        // Asynchronous fire-and-forget webhook
        fetch(sub.target, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Crystal-Heimdall/2.0 (+https://github.com/Crystal-Studio-Labs)",
          },
          body: JSON.stringify({
            event: "incident_alert",
            source: "Crystal Heimdall",
            incidentId: incident.id,
            service: incident.serviceName || "Core Platform",
            severity: incident.severity,
            status: incident.status,
            title: incident.title,
            message: incident.message || "No contextual details provided.",
            timestamp: new Date().toISOString(),
            unsubscribeUrl: `/api/v1/subscribers/${sub.id}?token=${sub.token}`,
          }),
        }).catch((err) => {
          console.warn(`[SUBSCRIBER WEBHOOK ERROR] (${sub.id}):`, err.message);
        });
        delivered++;
      } else if (sub.type === "email") {
        // Dispatched via transactional email driver (Resend / Dry-Run)
        sendIncidentEmail({
          to: sub.target,
          token: sub.token,
          subscriberId: sub.id,
          incidentId: incident.id,
          subject: `[HEIMDALL // ${incident.severity.toUpperCase()}] ${incident.title}`,
          title: incident.title,
          severity: incident.severity,
          status: incident.status,
          serviceName: incident.serviceName,
          message: incident.message,
        }).catch((err) => {
          console.warn(`[SUBSCRIBER EMAIL ERROR] (${sub.id}):`, err.message);
        });
        delivered++;
      }
    }

    return { deliveredCount: delivered, subscriberCount: activeSubscribers.length };
  } catch (err: any) {
    console.error("[NOTIFY SUBSCRIBERS FAILED]:", err.message);
    return { deliveredCount: 0, subscriberCount: 0 };
  }
}

export default router;
