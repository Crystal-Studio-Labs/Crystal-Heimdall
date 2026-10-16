import { Router, Request, Response } from "express";
import { getDb, initDb } from "../db.js";
import { checkTcpPort, checkSslExpiry, parseTargetAddress } from "../probers.js";

const router = Router();

// GET all services (with 24-hour hourlyBlocks for dashboard sparkline)
router.get("/", async (_req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const result = await db.execute("SELECT * FROM services ORDER BY created_at DESC");
    const services = result.rows as any[];

    // Fetch past 24 hours hourly buckets
    const now = Date.now();
    const past24h = now - 24 * 3600 * 1000;
    const hourlyRes = await db.execute({
      sql: `SELECT 
              service_id, 
              CAST((recorded_at - ?) / 3600000 AS INTEGER) as hour_bucket, 
              count(*) as total_checks,
              SUM(CASE WHEN (status_code IS NOT NULL AND status_code >= 400) OR status_code = 0 THEN 1 ELSE 0 END) as failed_checks
            FROM telemetry_points 
            WHERE recorded_at >= ? 
            GROUP BY service_id, hour_bucket`,
      args: [past24h, past24h],
    });

    const hourlyMap = new Map<string, { total_checks: number; failed_checks: number }>();
    for (const row of hourlyRes.rows as any[]) {
      hourlyMap.set(`${row.service_id}_${row.hour_bucket}`, {
        total_checks: Number(row.total_checks),
        failed_checks: Number(row.failed_checks || 0),
      });
    }

    const enhanced = services.map((svc) => {
      const isMaint = svc.is_maintenance === 1 || svc.status === "maintenance";
      const isHealthy = svc.status === "healthy";
      const isWarning = svc.status === "warning";

      // Build 24 hourly blocks (0 = 24h ago, 23 = current hour)
      const hourlyBlocks = Array.from({ length: 24 }).map((_, b) => {
        const bucketData = hourlyMap.get(`${svc.id}_${b}`);
        if (isMaint) return { hour: b, status: "maintenance" };

        if (bucketData && bucketData.total_checks > 0) {
          if (bucketData.failed_checks === 0) return { hour: b, status: "up" };
          if (bucketData.failed_checks < bucketData.total_checks) return { hour: b, status: "degraded" };
          return { hour: b, status: "down" };
        }

        // If no checks recorded in this historical hour, reflect current live status for current hour or nominal
        if (b === 23) {
          return { hour: b, status: isHealthy ? "up" : isWarning ? "degraded" : "down" };
        }
        return { hour: b, status: "up" };
      });

      return {
        ...svc,
        hourlyBlocks,
      };
    });

    return res.json({ services: enhanced });
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
      group_name = "Production",
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "Name and type are required." });
    }

    const id = `srv-${Date.now().toString(36)}`;
    const apiKey = `key_live_heimdall_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
    const now = Date.now();
    const isPublicVal = typeof is_public !== "undefined" ? (is_public ? 1 : 0) : 1;
    const groupVal = String(group_name || "Production").trim();

    // Real SSL certificate expiry inspection if https
    let sslExpiryDays = null;
    if (endpoint && endpoint.startsWith("https://")) {
      try {
        const parsed = parseTargetAddress(endpoint, port);
        const sslRes = await checkSslExpiry(parsed.host, parsed.port, 3000);
        if (sslRes.daysRemaining !== null) {
          sslExpiryDays = sslRes.daysRemaining;
        }
      } catch (_e) {
        // Fallback gracefully
      }
    }

    await db.execute({
      sql: `INSERT INTO services (
              id, name, type, endpoint, poll_interval_sec, expected_interval_sec, 
              grace_period_sec, api_key, status, is_public, port, keyword, 
              expected_status_code, retry_count, ssl_expiry_days, is_maintenance,
              group_name, last_ping_at, latency_ms, uptime_pct, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'healthy', ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 100.0, ?)`,
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
        groupVal,
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
        group_name: groupVal,
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
    const { is_public, is_maintenance, name, endpoint, port, keyword, expected_status_code, group_name } = req.body;

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

    if (typeof group_name !== "undefined") {
      await db.execute({
        sql: "UPDATE services SET group_name = ? WHERE id = ?",
        args: [String(group_name).trim(), id],
      });
    }

    return res.json({ status: "updated", id });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update service", details: err.message });
  }
});

// PUT full update for an existing service (Target editing)
router.put("/:id", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;
    const {
      name,
      type,
      endpoint,
      port,
      group_name = "Production",
      poll_interval_sec = 60,
      expected_interval_sec,
      grace_period_sec = 300,
      is_public = 1,
      keyword,
      expected_status_code = "200-299",
      retry_count = 2,
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "Name and type are required." });
    }

    const isPublicVal = is_public ? 1 : 0;
    const groupVal = String(group_name || "Production").trim();

    // Re-inspect SSL if HTTPS endpoint
    let sslExpiryDays = null;
    if (endpoint && endpoint.startsWith("https://")) {
      try {
        const parsed = parseTargetAddress(endpoint, port);
        const sslRes = await checkSslExpiry(parsed.host, parsed.port, 3000);
        if (sslRes.daysRemaining !== null) {
          sslExpiryDays = sslRes.daysRemaining;
        }
      } catch (_e) {}
    }

    await db.execute({
      sql: `UPDATE services 
            SET name = ?, type = ?, endpoint = ?, port = ?, group_name = ?,
                poll_interval_sec = ?, expected_interval_sec = ?, grace_period_sec = ?,
                is_public = ?, keyword = ?, expected_status_code = ?, retry_count = ?,
                ssl_expiry_days = COALESCE(?, ssl_expiry_days)
            WHERE id = ?`,
      args: [
        String(name).trim(),
        type,
        endpoint ? String(endpoint).trim() : null,
        port ? Number(port) : null,
        groupVal,
        Number(poll_interval_sec) || 60,
        expected_interval_sec ? Number(expected_interval_sec) : null,
        Number(grace_period_sec) || 300,
        isPublicVal,
        keyword ? String(keyword).trim() : null,
        String(expected_status_code).trim(),
        Number(retry_count) || 2,
        sslExpiryDays,
        id,
      ],
    });

    const updatedRes = await db.execute({
      sql: "SELECT * FROM services WHERE id = ?",
      args: [id],
    });

    if (updatedRes.rows.length === 0) {
      return res.status(404).json({ error: "Service target not found" });
    }

    return res.json({
      status: "updated",
      service: updatedRes.rows[0],
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update service", details: err.message });
  }
});

// POST batch operations on services
router.post("/batch", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { action, ids, group_name } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action is required" });
    }

    const hasIds = Array.isArray(ids) && ids.length > 0;

    if (action === "pause-all") {
      if (hasIds) {
        for (const id of ids) {
          await db.execute({
            sql: "UPDATE services SET is_maintenance = 1, status = 'maintenance' WHERE id = ?",
            args: [id],
          });
        }
      } else {
        await db.execute("UPDATE services SET is_maintenance = 1, status = 'maintenance'");
      }
      return res.json({ status: "success", action: "pause-all", count: hasIds ? ids.length : "all" });
    }

    if (action === "resume-all") {
      if (hasIds) {
        for (const id of ids) {
          await db.execute({
            sql: "UPDATE services SET is_maintenance = 0, status = 'healthy' WHERE id = ?",
            args: [id],
          });
        }
      } else {
        await db.execute("UPDATE services SET is_maintenance = 0, status = 'healthy'");
      }
      return res.json({ status: "success", action: "resume-all", count: hasIds ? ids.length : "all" });
    }

    if (action === "delete-selected" && hasIds) {
      for (const id of ids) {
        await db.execute({
          sql: "DELETE FROM services WHERE id = ?",
          args: [id],
        });
      }
      return res.json({ status: "success", action: "delete-selected", count: ids.length });
    }

    if (action === "set-group" && hasIds && group_name) {
      for (const id of ids) {
        await db.execute({
          sql: "UPDATE services SET group_name = ? WHERE id = ?",
          args: [String(group_name).trim(), id],
        });
      }
      return res.json({ status: "success", action: "set-group", group: group_name, count: ids.length });
    }

    return res.status(400).json({ error: "Unsupported batch action or missing parameters" });
  } catch (err: any) {
    return res.status(500).json({ error: "Batch operation failed", details: err.message });
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

    // TCP Socket Port Check target (e.g. Postgres, Redis, Game/Custom Servers)
    if (svc.type === "port-check" || (svc.endpoint && svc.endpoint.startsWith("tcp://"))) {
      const target = parseTargetAddress(svc.endpoint || "", svc.port);
      const portRes = await checkTcpPort(target.host, target.port, 5000);
      const isHealthy = portRes.isHealthy;
      const latencyMs = portRes.latencyMs;
      const nextStatus = isHealthy ? "healthy" : "critical";
      const errorDetail = portRes.errorMessage;

      await db.execute({
        sql: `UPDATE services 
              SET status = ?, latency_ms = ?, last_ping_at = ?, consecutive_failures = ?
              WHERE id = ?`,
        args: [nextStatus, latencyMs, now, isHealthy ? 0 : 1, svc.id],
      });

      await db.execute({
        sql: "INSERT INTO telemetry_points (service_id, latency_ms, status_code, recorded_at) VALUES (?, ?, ?, ?)",
        args: [svc.id, latencyMs, isHealthy ? 200 : null, now],
      });

      return res.json({
        id: svc.id,
        name: svc.name,
        isHealthy,
        status: nextStatus,
        latency_ms: latencyMs,
        statusCode: isHealthy ? 200 : 0,
        error: errorDetail || null,
        target: `${target.host}:${target.port}`,
        probedAt: new Date(now).toISOString(),
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

      // If HTTPS, check SSL certificate validity and expiry days
      if (isHealthy && svc.endpoint.startsWith("https://")) {
        try {
          const parsed = parseTargetAddress(svc.endpoint);
          const sslRes = await checkSslExpiry(parsed.host, parsed.port, 3000);
          if (sslRes.daysRemaining !== null) {
            await db.execute({
              sql: "UPDATE services SET ssl_expiry_days = ? WHERE id = ?",
              args: [sslRes.daysRemaining, svc.id],
            });
          }
        } catch (_sslErr) {}
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
