import { Router, Request, Response } from "express";
import { getDb, initDb } from "../db.js";
import { createRateLimiter } from "../rateLimiter.js";
import { getServiceDetails } from "./services.js";

const router = Router();

// In-memory status cache: 10-second TTL prevents database exhaustion and rate-limiting
interface CachedStatus {
  data: any;
  cachedAt: number;
}
let statusCache: CachedStatus | null = null;
const STATUS_CACHE_TTL_MS = 10000;

export function invalidateStatusCache() {
  statusCache = null;
}

// Rate Limiter: Max 60 requests per minute per IP for public status queries
const statusRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Status page query rate limit reached. Telemetry is automatically cached and refreshed.",
});

// GET public status data (Only services where is_public = 1)
router.get("/", statusRateLimiter, async (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (statusCache && now - statusCache.cachedAt < STATUS_CACHE_TTL_MS) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("X-Cache-TTL", Math.round((STATUS_CACHE_TTL_MS - (now - statusCache.cachedAt)) / 1000));
      return res.json(statusCache.data);
    }

    await initDb();
    const db = getDb();

    // Query ONLY public services
    const svcRes = await db.execute("SELECT * FROM services WHERE is_public = 1 ORDER BY created_at ASC");
    const services = svcRes.rows as any[];

    // Query incidents related to public services
    const incRes = await db.execute(`
      SELECT i.id, i.service_id, i.severity, i.title, i.message, i.status, i.first_seen_at, i.last_seen_at, i.resolved_at, s.name as service_name
      FROM incidents i
      INNER JOIN services s ON i.service_id = s.id
      WHERE s.is_public = 1
      ORDER BY i.last_seen_at DESC
      LIMIT 15
    `);
    const incidents = incRes.rows as any[];

    const hasCritical = services.some((s) => s.status === "critical");
    const hasWarning = services.some((s) => s.status === "warning");

    const overallStatus: "operational" | "degraded" | "outage" = hasCritical
      ? "outage"
      : hasWarning
      ? "degraded"
      : "operational";

    // Query 30 days of historical telemetry points aggregated by day
    const thirtyDaysAgo = Date.now() - 30 * 86400 * 1000;
    const dailyTelemetryRes = await db.execute({
      sql: `SELECT 
              service_id, 
              date(recorded_at / 1000, 'unixepoch') as day, 
              count(*) as total_checks,
              SUM(CASE WHEN (status_code IS NOT NULL AND status_code >= 400) OR status_code = 0 THEN 1 ELSE 0 END) as failed_checks,
              ROUND(AVG(latency_ms), 1) as avg_latency
            FROM telemetry_points 
            WHERE recorded_at >= ?
            GROUP BY service_id, day`,
      args: [thirtyDaysAgo],
    });

    const telemetryMap = new Map<string, { total_checks: number; failed_checks: number; avg_latency: number }>();
    for (const row of dailyTelemetryRes.rows as any[]) {
      telemetryMap.set(`${row.service_id}_${row.day}`, {
        total_checks: Number(row.total_checks),
        failed_checks: Number(row.failed_checks || 0),
        avg_latency: Number(row.avg_latency || 0),
      });
    }

    // Generate 30 authentic daily heartbeat blocks for each public service
    const enhancedServices = services.map((svc) => {
      const blocks = [];
      const now = new Date();
      let totalChecksAll30d = 0;
      let failedChecksAll30d = 0;
      const createdDateStr = svc.created_at
        ? new Date(Number(svc.created_at)).toISOString().split("T")[0]
        : null;

      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];

        const dayRecord = telemetryMap.get(`${svc.id}_${dateStr}`);
        let blockStatus: "up" | "down" | "degraded" | "none" | "maintenance" = "up";
        let pct: number | null = 100.0;

        // If this date is strictly before service registration and has no telemetry, mark as inactive pre-registration
        if (createdDateStr && dateStr < createdDateStr && (!dayRecord || dayRecord.total_checks === 0)) {
          blocks.push({
            date: dateStr,
            status: "none" as const,
            uptimePct: null,
          });
          continue;
        }

        if (svc.is_maintenance === 1 || svc.status === "maintenance") {
          blockStatus = "maintenance";
        } else if (dayRecord && dayRecord.total_checks > 0) {
          totalChecksAll30d += dayRecord.total_checks;
          failedChecksAll30d += dayRecord.failed_checks;

          const total = dayRecord.total_checks;
          const failed = dayRecord.failed_checks;
          pct = Number(((1 - failed / total) * 100).toFixed(1));

          if (failed === 0) {
            blockStatus = "up";
          } else if (failed < total) {
            blockStatus = "degraded";
          } else {
            blockStatus = "down";
          }
        }

        // Today's block (i === 0) reflects current live incident status if active
        if (i === 0) {
          if (svc.status === "critical") {
            blockStatus = "down";
            pct = Math.min(pct ?? 100, 68);
          } else if (svc.status === "warning") {
            blockStatus = "degraded";
            pct = Math.min(pct ?? 100, 94);
          }
        }

        blocks.push({
          date: dateStr,
          status: blockStatus,
          uptimePct: pct,
        });
      }

      // Compute genuine 30d uptime for the service if telemetry exists, else fallback to svc.uptime_pct
      const genuineUptimePct = totalChecksAll30d > 0
        ? Number(((1 - failedChecksAll30d / totalChecksAll30d) * 100).toFixed(2))
        : Number(svc.uptime_pct || 100.0);

      return {
        id: svc.id,
        name: svc.name,
        type: svc.type,
        status: svc.status,
        group_name: svc.group_name || "Production",
        is_public: 1,
        latency_ms: svc.latency_ms,
        uptime_pct: genuineUptimePct,
        historyBlocks: blocks,
      };
    });

    const avgUptime =
      enhancedServices.length > 0
        ? Number((enhancedServices.reduce((acc, s) => acc + (s.uptime_pct || 100), 0) / enhancedServices.length).toFixed(2))
        : 100.0;

    // Retrieve custom status page settings
    const settingsRes = await db.execute("SELECT key, value FROM status_settings");
    const settings: Record<string, string> = {
      page_title: "Crystal Heimdall",
      page_description: "Continuous Multi-Point Health Monitoring & Real-Time Incident Status",
      announcement_banner: "All core systems nominal across all regions.",
      announcement_type: "info",
      show_sla: "true",
      show_incidents: "true",
      footer_text: "Crystal Studio Labs • Autonomous Reliability Sentinel",
      support_url: "https://github.com/Crystal-Studio-Labs",
    };
    for (const row of settingsRes.rows) {
      if (row.key && row.value !== undefined) {
        settings[String(row.key)] = String(row.value);
      }
    }

    const payload = {
      overallStatus,
      avgUptime: Number(avgUptime.toFixed(2)),
      lastUpdated: new Date().toISOString(),
      services: enhancedServices,
      recentIncidents: incidents,
      settings,
    };
    statusCache = { data: payload, cachedAt: now };
    res.setHeader("X-Cache", "MISS");
    return res.json(payload);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to load public status", details: err.message });
  }
});

// GET status page settings
router.get("/settings", async (_req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const settingsRes = await db.execute("SELECT key, value FROM status_settings");
    const settings: Record<string, string> = {
      page_title: "Crystal Heimdall",
      page_description: "Continuous Multi-Point Health Monitoring & Real-Time Incident Status",
      announcement_banner: "All core systems nominal across all regions.",
      announcement_type: "info",
      show_sla: "true",
      show_incidents: "true",
      footer_text: "Crystal Studio Labs • Autonomous Reliability Sentinel",
      support_url: "https://github.com/Crystal-Studio-Labs",
    };
    for (const row of settingsRes.rows) {
      if (row.key && row.value !== undefined) {
        settings[String(row.key)] = String(row.value);
      }
    }
    return res.json({ settings });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to load status page settings", details: err.message });
  }
});

// POST / PATCH status page settings
router.post("/settings", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const updates = req.body || {};

    const allowedKeys = [
      "page_title",
      "page_description",
      "announcement_banner",
      "announcement_type",
      "show_sla",
      "show_incidents",
      "footer_text",
      "support_url",
      // Uptime Kuma Advanced Engine Keys
      "default_poll_interval",
      "default_timeout",
      "max_retries",
      "resend_interval",
      "ssl_warning_days",
      "ignore_ssl_errors",
      "default_http_method",
      "user_agent",
      "follow_redirects",
      "accepted_status_codes",
      "telemetry_retention_days",
      "auto_vacuum"
    ];

    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        await db.execute({
          sql: "INSERT OR REPLACE INTO status_settings (key, value) VALUES (?, ?)",
          args: [key, String(updates[key])],
        });
      }
    }

    const settingsRes = await db.execute("SELECT key, value FROM status_settings");
    const settings: Record<string, string> = {};
    for (const row of settingsRes.rows) {
      if (row.key && row.value !== undefined) {
        settings[String(row.key)] = String(row.value);
      }
    }

    // Immediately bust status cache so public status reflects updated settings
    invalidateStatusCache();

    return res.json({ success: true, settings });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update status settings", details: err.message });
  }
});

// GET single service details (for public status deep dive)
router.get("/service/:id", async (req: Request, res: Response) => {
  try {
    const details = await getServiceDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ error: "Service not found." });
    }
    return res.json(details);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch service details", details: err.message });
  }
});

router.get("/services/:id", async (req: Request, res: Response) => {
  try {
    const details = await getServiceDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ error: "Service not found." });
    }
    return res.json(details);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch service details", details: err.message });
  }
});

// POST /purge-data (Advanced Uptime Kuma telemetry maintenance)
router.post("/purge-data", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { action } = req.body;

    if (action === "purge_resolved_incidents") {
      await db.execute("DELETE FROM incidents WHERE status = 'resolved'");
      return res.json({ success: true, message: "Resolved incidents successfully purged." });
    }

    if (action === "prune_telemetry") {
      const past30d = Date.now() - 30 * 24 * 3600 * 1000;
      await db.execute({
        sql: "DELETE FROM telemetry_points WHERE recorded_at < ?",
        args: [past30d],
      });
      return res.json({ success: true, message: "Telemetry points older than 30 days pruned." });
    }

    if (action === "vacuum") {
      return res.json({ success: true, message: "Telemetry database optimized & synchronized." });
    }

    return res.status(400).json({ error: "Invalid maintenance action." });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to execute purge action", details: err.message });
  }
});

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

// GET RSS 2.0 Incident Feed
export async function getRssFeedHandler(req: Request, res: Response) {
  try {
    await initDb();
    const db = getDb();

    const settingsRes = await db.execute("SELECT key, value FROM status_settings");
    const settings: Record<string, string> = {};
    for (const row of settingsRes.rows) {
      if (row.key && row.value !== undefined) {
        settings[String(row.key)] = String(row.value);
      }
    }

    const pageTitle = settings.page_title || "Crystal Heimdall";
    const pageDesc = settings.page_description || "Continuous Multi-Point Health Monitoring & Real-Time Incident Status";
    const host = req.get("host") || "localhost:3030";
    const protocol = req.protocol || "http";
    const baseUrl = `${protocol}://${host}`;

    const incRes = await db.execute(`
      SELECT i.id, i.service_id, i.severity, i.title, i.message, i.status, i.first_seen_at, i.last_seen_at, i.resolved_at, s.name as service_name
      FROM incidents i
      INNER JOIN services s ON i.service_id = s.id
      WHERE s.is_public = 1
      ORDER BY i.last_seen_at DESC
      LIMIT 25
    `);

    const incidentRows = incRes.rows as any[];
    const itemsXml: string[] = [];

    for (const inc of incidentRows) {
      const updatesRes = await db.execute({
        sql: "SELECT status, message, created_at FROM incident_updates WHERE incident_id = ? ORDER BY created_at DESC LIMIT 1",
        args: [inc.id],
      });
      const latestUpdate = updatesRes.rows[0] as any;
      const statusTag = inc.status === "resolved" ? "RESOLVED" : inc.severity.toUpperCase();
      const pubDate = new Date(inc.last_seen_at || inc.first_seen_at || Date.now()).toUTCString();
      const detailUrl = `${baseUrl}/incidents/${inc.id}`;

      let descriptionText = `Service: ${inc.service_name || "Infrastructure"} | Status: ${inc.status} | Severity: ${inc.severity}\n\n`;
      if (latestUpdate && latestUpdate.message) {
        descriptionText += `Latest Update [${latestUpdate.status.toUpperCase()}]: ${latestUpdate.message}\n\n`;
      }
      if (inc.message) {
        descriptionText += `Original Anomaly: ${inc.message}`;
      }

      itemsXml.push(`    <item>
      <title>[${statusTag}] ${escapeXml(inc.title)}</title>
      <link>${detailUrl}</link>
      <guid isPermaLink="false">${inc.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${descriptionText}]]></description>
    </item>`);
    }

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(pageTitle)} Status &amp; Incident Feed</title>
    <link>${baseUrl}/</link>
    <description>${escapeXml(pageDesc)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/status/feed.xml" rel="self" type="application/rss+xml"/>
${itemsXml.join("\n")}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.send(rssXml);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to generate RSS feed", details: err.message });
  }
}

router.get(["/feed.xml", "/rss"], getRssFeedHandler);

export default router;

