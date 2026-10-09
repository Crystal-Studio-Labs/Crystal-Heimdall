import { Router, Request, Response } from "express";
import { getDb, initDb } from "../db.js";

const router = Router();

// GET all services
router.get("/", async (_req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const result = await db.execute("SELECT * FROM services ORDER BY created_at DESC");
    return res.json({ services: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch services", details: err.message });
  }
});

// POST create service
router.post("/", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { 
      name, 
      type, 
      endpoint, 
      poll_interval_sec, 
      expected_interval_sec, 
      grace_period_sec, 
      is_public,
      port,
      keyword,
      expected_status_code = "200-299",
      retry_count = 2,
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "Name and type are required." });
    }

    const id = `srv-${Date.now().toString(36)}`;
    const apiKey = `key_live_heimdall_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
    const now = Date.now();
    const isPublicVal = typeof is_public !== "undefined" ? (is_public ? 1 : 0) : 1;

    // Default simulated SSL expiry if https
    let sslExpiryDays = null;
    if (endpoint && endpoint.startsWith("https://")) {
      sslExpiryDays = 45 + Math.floor(Math.random() * 60);
    }

    await db.execute({
      sql: `INSERT INTO services (
              id, name, type, endpoint, poll_interval_sec, expected_interval_sec, 
              grace_period_sec, api_key, status, is_public, port, keyword, 
              expected_status_code, retry_count, ssl_expiry_days, is_maintenance,
              last_ping_at, latency_ms, uptime_pct, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'healthy', ?, ?, ?, ?, ?, ?, 0, ?, 0, 100.0, ?)`,
      args: [
        id,
        String(name).trim(),
        type,
        endpoint ? String(endpoint).trim() : null,
        Number(poll_interval_sec) || 60,
        expected_interval_sec ? Number(expected_interval_sec) : null,
        Number(grace_period_sec) || 300,
        apiKey,
        isPublicVal,
        port ? Number(port) : null,
        keyword ? String(keyword).trim() : null,
        String(expected_status_code).trim(),
        Number(retry_count) || 2,
        sslExpiryDays,
        now,
        now,
      ],
    });

    return res.json({
      status: "created",
      service: {
        id,
        name,
        type,
        endpoint,
        api_key: apiKey,
        is_public: isPublicVal,
        port,
        keyword,
        expected_status_code,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to create service", details: err.message });
  }
});

// PATCH toggle public visibility, maintenance mode, or details
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;
    const { is_public, is_maintenance, name, endpoint, port, keyword, expected_status_code } = req.body;

    if (typeof is_public !== "undefined") {
      const isPublicVal = is_public ? 1 : 0;
      await db.execute({
        sql: "UPDATE services SET is_public = ? WHERE id = ?",
        args: [isPublicVal, id],
      });
    }

    if (typeof is_maintenance !== "undefined") {
      const isMaintVal = is_maintenance ? 1 : 0;
      const statusVal = isMaintVal ? "maintenance" : "healthy";
      await db.execute({
        sql: "UPDATE services SET is_maintenance = ?, status = ? WHERE id = ?",
        args: [isMaintVal, statusVal, id],
      });
    }

    if (name) {
      await db.execute({
        sql: "UPDATE services SET name = ? WHERE id = ?",
        args: [name, id],
      });
    }

    if (endpoint) {
      await db.execute({
        sql: "UPDATE services SET endpoint = ? WHERE id = ?",
        args: [endpoint, id],
      });
    }

    if (typeof port !== "undefined") {
      await db.execute({
        sql: "UPDATE services SET port = ? WHERE id = ?",
        args: [port ? Number(port) : null, id],
      });
    }

    if (typeof keyword !== "undefined") {
      await db.execute({
        sql: "UPDATE services SET keyword = ? WHERE id = ?",
        args: [keyword ? String(keyword).trim() : null, id],
      });
    }

    if (expected_status_code) {
      await db.execute({
        sql: "UPDATE services SET expected_status_code = ? WHERE id = ?",
        args: [String(expected_status_code).trim(), id],
      });
    }

    return res.json({ status: "updated", id });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update service", details: err.message });
  }
});

// POST instant live probe for a single service (Uptime Kuma instant test feature)
router.post("/:id/probe", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;

    const svcRes = await db.execute({
      sql: "SELECT * FROM services WHERE id = ?",
      args: [id],
    });

    if (svcRes.rows.length === 0) {
      return res.status(404).json({ error: "Service target not found" });
    }

    const svc = svcRes.rows[0] as any;
    const now = Date.now();

    if (svc.type === "deadman-cron" || svc.type === "webhook-sink") {
      return res.json({
        id: svc.id,
        name: svc.name,
        status: svc.status,
        type: svc.type,
        message: "Passive target (awaits inbound ping or crash payload)",
        latency_ms: 0,
      });
    }

    if (!svc.endpoint) {
      return res.status(400).json({ error: "No endpoint URL configured for probe" });
    }

    const startTime = performance.now();
    let isHealthy = false;
    let statusCode = 0;
    let latencyMs = 0;
    let errorDetail = "";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const fetchRes = await fetch(svc.endpoint, {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "Crystal-Heimdall-Sentinel/2.0" },
      });
      clearTimeout(timeoutId);

      latencyMs = Math.round(performance.now() - startTime);
      statusCode = fetchRes.status;

      // Status code check
      const expectedCodes = svc.expected_status_code || "200-299";
      if (expectedCodes === "200-299") {
        isHealthy = fetchRes.ok;
      } else {
        const allowed = expectedCodes.split(",").map((c: string) => c.trim());
        isHealthy = allowed.includes(String(statusCode));
      }

      // Keyword check
      if (isHealthy && svc.keyword) {
        const bodyText = await fetchRes.text();
        if (!bodyText.includes(svc.keyword)) {
          isHealthy = false;
          errorDetail = `Keyword '${svc.keyword}' not found in response body`;
        }
      }

      if (!isHealthy && !errorDetail) {
        errorDetail = `HTTP ${statusCode} ${fetchRes.statusText}`;
      }
    } catch (err: any) {
      latencyMs = Math.round(performance.now() - startTime);
      isHealthy = false;
      errorDetail = err.name === "AbortError" ? "Timeout (>6000ms)" : err.message;
    }

    const nextStatus = isHealthy ? "healthy" : "critical";

    await db.execute({
      sql: `UPDATE services 
            SET status = ?, latency_ms = ?, last_ping_at = ?, consecutive_failures = ?
            WHERE id = ?`,
      args: [nextStatus, latencyMs, now, isHealthy ? 0 : 1, svc.id],
    });

    await db.execute({
      sql: "INSERT INTO telemetry_points (service_id, latency_ms, status_code, recorded_at) VALUES (?, ?, ?, ?)",
      args: [svc.id, latencyMs, statusCode || null, now],
    });

    return res.json({
      id: svc.id,
      name: svc.name,
      isHealthy,
      status: nextStatus,
      latency_ms: latencyMs,
      statusCode,
      error: errorDetail || null,
      probedAt: new Date(now).toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Probe failed", details: err.message });
  }
});

// DELETE service
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;

    await db.execute({
      sql: "DELETE FROM services WHERE id = ?",
      args: [id],
    });

    return res.json({ status: "deleted", id });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete service", details: err.message });
  }
});

export default router;
