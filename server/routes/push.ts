import { Router, Request, Response } from "express";
import crypto from "crypto";
import { getDb, initDb } from "../db.js";
import { getVapidPublicKey, sendWebPushNotification, StoredPushSubscription } from "../webpush.js";
import { createRateLimiter } from "../rateLimiter.js";
import { isOperatorReq } from "./auth.js";

const router = Router();

const pushRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many push subscription requests. Please try again shortly.",
});

// 1. GET /api/v1/push/vapid-public-key - Fetch VAPID public key for browser registration
router.get("/vapid-public-key", async (_req: Request, res: Response) => {
  try {
    const key = await getVapidPublicKey();
    return res.json({ publicKey: key });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to retrieve VAPID key", details: err.message });
  }
});

// 2. POST /api/v1/push/subscribe - Register browser PushSubscription
router.post("/subscribe", pushRateLimiter, async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { subscription, scope = "all" } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: "Invalid PushSubscription payload. Missing endpoint or keys." });
    }

    const cleanScope = ["all", "critical"].includes(String(scope).toLowerCase())
      ? String(scope).toLowerCase()
      : "all";

    const endpoint = String(subscription.endpoint).trim();
    const targetJson = JSON.stringify(subscription);
    const now = Date.now();

    // Check if endpoint is already registered
    const existingRes = await db.execute({
      sql: "SELECT * FROM subscribers WHERE target = ? LIMIT 1",
      args: [targetJson],
    });

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0] as any;
      await db.execute({
        sql: "UPDATE subscribers SET is_active = 1, scope = ? WHERE id = ?",
        args: [cleanScope, existing.id],
      });

      // Send confirmation push notification
      sendWebPushNotification(subscription as StoredPushSubscription, {
        title: "CRYSTAL HEIMDALL // PUSH ACTIVE",
        body: "Real-time alerts connected. You will receive notifications even when this browser is closed.",
        tag: "heimdall-welcome",
        url: "/dashboard",
      }).catch(() => {});

      return res.json({
        status: "subscribed",
        id: existing.id,
        type: "webpush",
        scope: cleanScope,
        token: existing.token,
        message: "Push subscription confirmed & updated.",
      });
    }

    const id = `sub-wp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const token = crypto.randomBytes(16).toString("hex");

    await db.execute({
      sql: "INSERT INTO subscribers (id, type, target, scope, token, is_active, created_at) VALUES (?, 'webpush', ?, ?, ?, 1, ?)",
      args: [id, targetJson, cleanScope, token, now],
    });

    // Send welcome confirmation push
    sendWebPushNotification(subscription as StoredPushSubscription, {
      title: "CRYSTAL HEIMDALL // PUSH ACTIVE",
      body: "Closed-browser push notifications armed. You will receive system alerts immediately.",
      tag: "heimdall-welcome",
      url: "/status",
    }).catch((err) => {
      console.warn("[WELCOME PUSH FAILED]:", err.message);
    });

    return res.status(201).json({
      status: "subscribed",
      id,
      type: "webpush",
      scope: cleanScope,
      token,
      message: "Browser successfully subscribed to real-time Web Push alerts.",
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to register push subscription", details: err.message });
  }
});

// 3. POST /api/v1/push/test - Test push dispatch to caller's subscription
router.post("/test", async (req: Request, res: Response) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "PushSubscription required for test dispatch." });
    }

    const result = await sendWebPushNotification(subscription as StoredPushSubscription, {
      title: "⚡ HEIMDALL SENTINEL TEST DISPATCH",
      body: "Closed-browser Web Push delivery confirmed! Probes and alarms are operational.",
      tag: "heimdall-test",
      url: "/dashboard",
      severity: "info",
    });

    return res.json({
      success: result.success,
      statusCode: result.statusCode,
      error: result.error,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Push test failed", details: err.message });
  }
});

export default router;
