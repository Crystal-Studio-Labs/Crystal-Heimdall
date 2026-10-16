import { Router, Request, Response } from "express";
import { getDb, initDb } from "../db.js";

const router = Router();

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

function renderSvgBadge(label: string, value: string, color: string): string {
  const cleanLabel = escapeXml(label.trim());
  const cleanValue = escapeXml(value.trim());

  // Approximate character-width measurement for monospace font
  const labelWidth = Math.max(40, Math.round(cleanLabel.length * 7.2 + 16));
  const valueWidth = Math.max(40, Math.round(cleanValue.length * 7.2 + 16));
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${cleanLabel}: ${cleanValue}">
  <title>${cleanLabel}: ${cleanValue}</title>
  <g shape-rendering="crispEdges">
    <rect width="${labelWidth}" height="20" fill="#18181b"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="11" font-weight="700">
    <text x="${Math.round(labelWidth / 2)}" y="14" fill="#a1a1aa">${cleanLabel}</text>
    <text x="${labelWidth + Math.round(valueWidth / 2)}" y="14" fill="#ffffff">${cleanValue}</text>
  </g>
</svg>`;
}

// GET dynamic SVG status badge for fleet or individual target
router.get("/:id/status.svg", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;
    const metric = (req.query.metric as string) || "status";
    const customLabel = req.query.label as string | undefined;

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Fleet-wide aggregation badge
    if (id === "fleet") {
      const svcRes = await db.execute("SELECT status, uptime_pct FROM services WHERE is_public = 1");
      const services = svcRes.rows as any[];

      const hasCritical = services.some((s) => s.status === "critical");
      const hasWarning = services.some((s) => s.status === "warning");
      const overallStatus = hasCritical ? "outage" : hasWarning ? "degraded" : "operational";
      const statusColor = hasCritical ? "#f43f5e" : hasWarning ? "#f59e0b" : "#10b981";

      const avgUptime =
        services.length > 0
          ? Number((services.reduce((acc, s) => acc + (s.uptime_pct || 100), 0) / services.length).toFixed(2))
          : 100.0;

      if (metric === "uptime") {
        const uptimeColor = avgUptime >= 99.0 ? "#10b981" : avgUptime >= 95.0 ? "#f59e0b" : "#f43f5e";
        const svg = renderSvgBadge(customLabel || "FLEET UPTIME", `${avgUptime}%`, uptimeColor);
        return res.send(svg);
      }

      const svg = renderSvgBadge(customLabel || "FLEET STATUS", overallStatus.toUpperCase(), statusColor);
      return res.send(svg);
    }

    // Individual service target badge
    const svcRes = await db.execute({
      sql: "SELECT * FROM services WHERE id = ? OR name = ? LIMIT 1",
      args: [id, id],
    });

    if (svcRes.rows.length === 0) {
      const svg = renderSvgBadge(customLabel || "heimdall", "target not found", "#71717a");
      return res.send(svg);
    }

    const service = svcRes.rows[0] as any;
    const label = customLabel || service.name;

    if (metric === "uptime") {
      const uptime = Number(service.uptime_pct || 100);
      const uptimeColor = uptime >= 99.0 ? "#10b981" : uptime >= 95.0 ? "#f59e0b" : "#f43f5e";
      const svg = renderSvgBadge(label, `${uptime.toFixed(1)}%`, uptimeColor);
      return res.send(svg);
    }

    if (metric === "latency") {
      const svg = renderSvgBadge(label, `${service.latency_ms || 0}ms`, "#0284c7");
      return res.send(svg);
    }

    // Default: status metric
    let statusText = service.status === "healthy" ? "online" : service.status;
    let statusColor = "#10b981";

    if (service.status === "critical") {
      statusText = "down";
      statusColor = "#f43f5e";
    } else if (service.status === "warning") {
      statusText = "degraded";
      statusColor = "#f59e0b";
    } else if (service.status === "maintenance" || service.is_maintenance === 1) {
      statusText = "maintenance";
      statusColor = "#0284c7";
    }

    const svg = renderSvgBadge(label, statusText.toUpperCase(), statusColor);
    return res.send(svg);
  } catch (err: any) {
    const errorSvg = renderSvgBadge("error", "badge generator failed", "#f43f5e");
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    return res.status(500).send(errorSvg);
  }
});

export default router;
