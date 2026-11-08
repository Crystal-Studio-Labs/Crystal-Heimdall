import { Router, Request, Response } from "express";
import { getDb, initDb } from "../db.js";

const router = Router();

router.get(["/", "/widget", "/embed"], async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();

    // Query public services
    const svcRes = await db.execute("SELECT id, name, status, uptime_pct, is_maintenance FROM services WHERE is_public = 1");
    const services = svcRes.rows as any[];

    const hasCritical = services.some((s) => s.status === "critical");
    const hasWarning = services.some((s) => s.status === "warning");
    const overallStatus = hasCritical ? "outage" : hasWarning ? "degraded" : "operational";

    const avgUptime = services.length > 0
      ? (services.reduce((acc, s) => acc + (s.uptime_pct || 100), 0) / services.length).toFixed(2)
      : "100.00";

    const isCompact = req.query.compact === "true" || req.query.compact === "1";
    const statusText =
      overallStatus === "operational"
        ? "ALL SYSTEMS OPERATIONAL"
        : overallStatus === "degraded"
        ? "DEGRADED PERFORMANCE"
        : "SERVICE OUTAGE DETECTED";

    const statusColor =
      overallStatus === "operational"
        ? "#10b981"
        : overallStatus === "degraded"
        ? "#f59e0b"
        : "#ef4444";

    const statusBg =
      overallStatus === "operational"
        ? "rgba(16, 185, 129, 0.12)"
        : overallStatus === "degraded"
        ? "rgba(245, 158, 11, 0.12)"
        : "rgba(239, 68, 68, 0.15)";

    const statusBorder =
      overallStatus === "operational"
        ? "#059669"
        : overallStatus === "degraded"
        ? "#d97706"
        : "#dc2626";

    // Set permissive frame headers for embedding
    res.removeHeader("X-Frame-Options");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=15, s-maxage=30");

    if (isCompact) {
      // Compact Pill Widget (Height: 34px, Width: ~220px)
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Crystal Heimdall Status Pill</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: transparent;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      line-height: 1;
      display: inline-block;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: #070a0f;
      border: 1px solid ${statusBorder};
      color: #f4f4f5;
      text-decoration: none;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      box-shadow: 2px 2px 0px #000;
      transition: all 0.15s ease;
    }
    .pill:hover {
      border-color: #06b6d4;
      color: #38bdf8;
    }
    .dot {
      width: 7px;
      height: 7px;
      background: ${statusColor};
      border-radius: 50%;
      box-shadow: 0 0 6px ${statusColor};
      display: inline-block;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    .uptime {
      color: #a1a1aa;
      font-size: 10px;
      font-weight: normal;
    }
  </style>
</head>
<body>
  <a href="/" target="_blank" rel="noreferrer" class="pill" title="Crystal Heimdall: ${statusText} (${avgUptime}% Uptime)">
    <span class="dot"></span>
    <span>${overallStatus === "operational" ? "OPERATIONAL" : overallStatus.toUpperCase()}</span>
    <span class="uptime">${avgUptime}%</span>
  </a>
</body>
</html>`;
      return res.send(html);
    }

    // Full Brutalist Card Widget (Height: ~74px, Width: ~320px)
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Crystal Heimdall Live Status Widget</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: transparent;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      padding: 4px;
    }
    .widget-card {
      background: #070a0f;
      border: 2px solid #27272a;
      box-shadow: 3px 3px 0px #000;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-decoration: none;
      color: #f4f4f5;
      transition: border-color 0.15s ease;
    }
    .widget-card:hover {
      border-color: #06b6d4;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      font-size: 9px;
      font-weight: 700;
      color: #71717a;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .link-arrow {
      color: #06b6d4;
      font-size: 10px;
    }
    .status-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dot {
      width: 9px;
      height: 9px;
      background: ${statusColor};
      border-radius: 50%;
      box-shadow: 0 0 8px ${statusColor};
      shrink-0;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.35; transform: scale(0.9); }
    }
    .status-label {
      font-size: 11px;
      font-weight: 900;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .metrics {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid #18181b;
      padding-top: 4px;
      font-size: 10px;
      color: #a1a1aa;
    }
    .uptime-val {
      color: ${statusColor};
      font-weight: 700;
    }
  </style>
</head>
<body>
  <a href="/" target="_blank" rel="noreferrer" class="widget-card" title="Click to view live status on Crystal Heimdall">
    <div class="header">
      <span class="brand">CRYSTAL HEIMDALL SENTINEL</span>
      <span class="link-arrow">↗</span>
    </div>
    <div class="status-row">
      <span class="dot"></span>
      <span class="status-label">${statusText}</span>
    </div>
    <div class="metrics">
      <span>Fleet SLA: <span class="uptime-val">${avgUptime}%</span></span>
      <span>${services.length} Monitored</span>
    </div>
  </a>
</body>
</html>`;
    return res.send(html);
  } catch (err: any) {
    return res.status(500).send("Status Widget Error: " + err.message);
  }
});

export default router;
