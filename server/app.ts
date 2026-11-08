import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { initDb, getDb } from "./db.js";
import { runPollCycle } from "./poller.js";
import { createRateLimiter } from "./rateLimiter.js";

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Disable information disclosure headers
app.disable("x-powered-by");

// Security Headers & Defense In Depth Middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Allow framing for the embeddable status widget, deny for administrative and status pages
  if (!req.path.includes("/widget") && !req.path.includes("/embed")) {
    res.setHeader("X-Frame-Options", "DENY");
  }
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// Middleware
app.use(cors());
app.use(express.json());

// Global API Rate Limiter (300 req/min per IP) to mitigate denial of service & scraping
const globalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: "Global API rate limit exceeded. Please throttle request frequency.",
});
app.use("/api/", globalApiLimiter);

// Heartbeat Ping Rate Limiter (120 req/min)
const pingRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: "Sentinel heartbeat rate limit reached. Max 120 ping signals per minute.",
});

// Ensure database tables exist (Cold-start safety for serverless)
app.use(async (req, _res, next) => {
  if (req.path === "/api/health" || req.path === "/api" || req.path.startsWith("/badges")) {
    return next();
  }
  try {
    await initDb();
    next();
  } catch (err: any) {
    console.warn("[App Cold-Start DB Warning]:", err?.message);
    next();
  }
});

// Import Route Handlers
import authRoutes from "./routes/auth.js";
import servicesRoutes from "./routes/services.js";
import statusRoutes from "./routes/status.js";
import alertsRoutes from "./routes/alerts.js";
import incidentsRoutes from "./routes/incidents.js";
import analyticsRoutes from "./routes/analytics.js";
import channelsRoutes from "./routes/channels.js";
import telemetryRoutes from "./routes/telemetry.js";
import badgesRoutes from "./routes/badges.js";
import groupsRoutes from "./routes/groups.js";
import subscribersRoutes from "./routes/subscribers.js";
import maintenanceRoutes from "./routes/maintenance.js";
import widgetRoutes from "./routes/widget.js";
import pushRoutes from "./routes/push.js";
import { getRssFeedHandler } from "./routes/status.js";

// Root API Health Endpoint
app.get(["/api", "/api/health"], (_req, res) => {
  res.json({
    sentinel: "Crystal Heimdall",
    organization: "Crystal Studio Labs",
    status: "operational",
    runtime: process.env.VERCEL ? "vercel-serverless" : "standalone-node",
    timestamp: new Date().toISOString(),
  });
});

// Mount Public RSS Feed on all standard endpoints
app.get([
  "/api/v1/rss",
  "/api/v1/feed.xml",
  "/api/v1/status/feed.xml",
  "/api/v1/status/rss",
  "/status/feed.xml",
  "/feed.xml",
  "/rss"
], getRssFeedHandler);

// Mount API Routes
app.use(["/status/widget", "/api/v1/status/widget", "/widget"], widgetRoutes);
app.use(["/api/v1/push", "/push"], pushRoutes);
app.use(["/api/v1/subscribers", "/subscribers"], subscribersRoutes);
app.use(["/api/v1/maintenance", "/maintenance"], maintenanceRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/services", servicesRoutes);
app.use("/api/v1/groups", groupsRoutes);
app.use("/api/v1/status", statusRoutes);
app.use(["/api/v1/badges", "/api/badges", "/badges", "/api/v1/badge", "/api/badge", "/badge"], badgesRoutes);
app.use("/api/v1/alerts", alertsRoutes);
app.use("/api/v1/incidents", incidentsRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/channels", channelsRoutes);
app.use("/api/v1/telemetry", telemetryRoutes);

// Two-Way Sentinel Lifecycle Sync & Dead-Man's Switch ping check-in
app.all("/api/v1/ping/:key", pingRateLimiter, async (req, res) => {
  try {
    const { key } = req.params;
    const db = getDb();

    const svcRes = await db.execute({
      sql: "SELECT * FROM services WHERE api_key = ?",
      args: [key],
    });

    if (svcRes.rows.length === 0) {
      return res.status(404).json({ error: "Invalid API key" });
    }

    const service = svcRes.rows[0] as any;
    const now = Date.now();

    // Parse event payload if provided via POST/PUT JSON
    const body = (typeof req.body === "object" && req.body !== null) ? req.body : {};
    const rawEvent = (body.event || req.query.event || "heartbeat").toString().toLowerCase();
    const event: "online" | "heartbeat" | "offline" = 
      rawEvent === "offline" ? "offline" : rawEvent === "online" ? "online" : "heartbeat";

    const runtimeMeta = JSON.stringify({
      event,
      uptime: body.uptime !== undefined ? Number(body.uptime) : undefined,
      memoryMB: body.memoryMB !== undefined ? Number(body.memoryMB) : undefined,
      reason: body.reason ? String(body.reason) : undefined,
      version: body.version ? String(body.version) : undefined,
      timestamp: now,
      ip: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
    });

    if (event === "offline") {
      // Graceful shutdown reported by application (SIGTERM/SIGINT)
      await db.execute({
        sql: `UPDATE services 
              SET last_ping_at = ?, status = 'maintenance', is_maintenance = 1, last_event = 'offline', runtime_meta = ?
              WHERE id = ?`,
        args: [now, runtimeMeta, service.id],
      });

      return res.json({
        status: "ok",
        service: service.name,
        acknowledged: "offline",
        maintenance: true,
        message: "Graceful shutdown acknowledged. Maintenance mode activated to suppress alarms.",
        pingRecordedAt: new Date(now).toISOString(),
      });
    }

    // "online" or "heartbeat" event
    await db.execute({
      sql: `UPDATE services 
            SET last_ping_at = ?, status = 'healthy', is_maintenance = 0, consecutive_failures = 0, last_event = ?, runtime_meta = ?
            WHERE id = ?`,
      args: [now, event, runtimeMeta, service.id],
    });

    // Record telemetry point for sparklines
    await db.execute({
      sql: "INSERT INTO telemetry_points (service_id, latency_ms, status_code, recorded_at) VALUES (?, 0, 200, ?)",
      args: [service.id, now],
    });

    // Auto-resolve any active incident for this service
    await db.execute({
      sql: "UPDATE incidents SET status = 'resolved', resolved_at = ? WHERE service_id = ? AND status = 'active'",
      args: [now, service.id],
    });

    return res.json({
      status: "ok",
      service: service.name,
      acknowledged: event,
      maintenance: false,
      type: service.type,
      pingRecordedAt: new Date(now).toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to record ping", details: err.message });
  }
});

// In-memory throttle tracker to protect poll cycle from saturation
let lastPollCycleTime = 0;
const MIN_PUBLIC_POLL_INTERVAL_MS = 15000; // 15 seconds

// Manual / Cron trigger for synthetic poll (Vercel Cron & External Pingers)
app.get("/api/v1/cron/poll", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = Boolean(req.headers["x-vercel-cron"]);

  const authHeader = req.headers.authorization;
  const querySecret = req.query.secret as string | undefined;
  const isAuthorized =
    isVercelCron ||
    (cronSecret && (authHeader === `Bearer ${cronSecret.trim()}` || querySecret === cronSecret.trim()));

  const now = Date.now();

  // If unauthenticated public trigger, enforce a 15-second debounce cooldown to prevent DB saturation
  if (!isAuthorized && now - lastPollCycleTime < MIN_PUBLIC_POLL_INTERVAL_MS) {
    return res.status(200).json({
      status: "throttled",
      message: "Poll cycle was recently executed. Cooldown active.",
      cooldownRemainingSec: Math.ceil((MIN_PUBLIC_POLL_INTERVAL_MS - (now - lastPollCycleTime)) / 1000),
      timestamp: new Date().toISOString(),
    });
  }

  try {
    lastPollCycleTime = now;
    const result = await runPollCycle();
    return res.json({ timestamp: new Date().toISOString(), summary: result });
  } catch (err: any) {
    return res.status(500).json({ error: "Poll cycle failed", details: err.message });
  }
});

// Serve XML Sitemap & Robots.txt explicitly
app.get("/sitemap.xml", (_req, res) => {
  const distPath = path.resolve(__dirname, "../dist-client/sitemap.xml");
  const pubPath = path.resolve(__dirname, "../client/public/sitemap.xml");
  const target = fs.existsSync(distPath) ? distPath : pubPath;
  if (fs.existsSync(target)) {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.sendFile(target);
  }
  return res.status(404).send("Sitemap not found");
});

app.get("/robots.txt", (_req, res) => {
  const distPath = path.resolve(__dirname, "../dist-client/robots.txt");
  const pubPath = path.resolve(__dirname, "../client/public/robots.txt");
  const target = fs.existsSync(distPath) ? distPath : pubPath;
  if (fs.existsSync(target)) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.sendFile(target);
  }
  return res.status(404).send("Robots.txt not found");
});

// Static Client Serving (when running standalone Node server)
const clientDist = path.resolve(__dirname, "../dist-client");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Global Express Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Heimdall Internal Server Error]", err);
  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal Server Error",
      message: err?.message || String(err),
    });
  }
});

export { app, initDb };
export default app;
