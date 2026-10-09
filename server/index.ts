import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { initDb } from "./db.js";
import { runPollCycle } from "./poller.js";

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3030;

// Middleware
app.use(cors());
app.use(express.json());

// Import Route Handlers
import authRoutes from "./routes/auth.js";
import servicesRoutes from "./routes/services.js";
import statusRoutes from "./routes/status.js";
import alertsRoutes from "./routes/alerts.js";
import incidentsRoutes from "./routes/incidents.js";
import analyticsRoutes from "./routes/analytics.js";
import channelsRoutes from "./routes/channels.js";
import telemetryRoutes from "./routes/telemetry.js";

// Mount API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/services", servicesRoutes);
app.use("/api/v1/status", statusRoutes);
app.use("/api/v1/alerts", alertsRoutes);
app.use("/api/v1/incidents", incidentsRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/channels", channelsRoutes);
app.use("/api/v1/telemetry", telemetryRoutes);

// Dead-Man's Switch ping check-in
app.all("/api/v1/ping/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const { getDb } = await import("./db.js");
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

    await db.execute({
      sql: "UPDATE services SET last_ping_at = ?, status = 'healthy', consecutive_failures = 0 WHERE id = ?",
      args: [now, service.id],
    });

    // Auto-resolve any active missed-heartbeat incident
    await db.execute({
      sql: "UPDATE incidents SET status = 'resolved', resolved_at = ? WHERE service_id = ? AND status = 'active'",
      args: [now, service.id],
    });

    return res.json({
      status: "ok",
      service: service.name,
      type: service.type,
      pingRecordedAt: new Date(now).toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to record ping", details: err.message });
  }
});

// Manual / Cron trigger for synthetic poll
app.get("/api/v1/cron/poll", async (req, res) => {
  try {
    const result = await runPollCycle();
    return res.json({ timestamp: new Date().toISOString(), summary: result });
  } catch (err: any) {
    return res.status(500).json({ error: "Poll cycle failed", details: err.message });
  }
});

// Static Client Serving (Production)
const clientDist = path.resolve(__dirname, "../dist-client");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Start Server and Poller
async function bootstrap() {
  await initDb();
  console.log("⚡ Database initialized.");

  app.listen(PORT, () => {
    console.log(`🚀 Crystal-Heimdall running at http://localhost:${PORT}`);
  });

  // Start 60-second synthetic polling daemon
  setInterval(async () => {
    try {
      await runPollCycle();
    } catch (err) {
      console.error("Background poller error:", err);
    }
  }, 60 * 1000);
}

bootstrap().catch(console.error);
