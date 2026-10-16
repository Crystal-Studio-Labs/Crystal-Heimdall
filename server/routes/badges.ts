import { Router, Request, Response } from "express";
import { getDb, initDb } from "../db.js";

const router = Router();

const DEFAULT_REDIRECT_URL = "https://crystal-heimdall.vercel.app/";

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

function renderSvgBadge(
  label: string,
  value: string,
  color: string,
  redirectUrl: string = DEFAULT_REDIRECT_URL
): string {
  const cleanLabel = escapeXml(label.trim());
  const cleanValue = escapeXml(value.trim());
  const cleanLink = escapeXml((redirectUrl || DEFAULT_REDIRECT_URL).trim());

  // Approximate character-width measurement for monospace font (7.2px per char + 16px padding)
  const labelWidth = Math.max(40, Math.round(cleanLabel.length * 7.2 + 16));
  const valueWidth = Math.max(40, Math.round(cleanValue.length * 7.2 + 16));
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${totalWidth} 20" width="${totalWidth}" height="20" role="img" aria-label="${cleanLabel}: ${cleanValue}">
  <title>${cleanLabel}: ${cleanValue} (Click to open Crystal Heimdall)</title>
  <a xlink:href="${cleanLink}" href="${cleanLink}" target="_blank">
    <g shape-rendering="crispEdges">
      <rect width="${labelWidth}" height="20" fill="#18181b"/>
      <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    </g>
    <g fill="#fff" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="11" font-weight="700">
      <text x="${Math.round(labelWidth / 2)}" y="14" fill="#a1a1aa">${cleanLabel}</text>
      <text x="${labelWidth + Math.round(valueWidth / 2)}" y="14" fill="#ffffff">${cleanValue}</text>
    </g>
  </a>
</svg>`;
}

// Helper to handle project group badge generation
async function handleProjectGroupBadge(groupParam: string, req: Request, res: Response) {
  const db = getDb();
  let group = decodeURIComponent(groupParam).trim();
  group = group.replace(/\.svg$/i, "").replace(/\/status$/i, "").trim();
  const metric = (req.query.metric as string) || "status";
  const customLabel = req.query.label as string | undefined;
  const redirectUrl = (req.query.link as string) || DEFAULT_REDIRECT_URL;

  // Resolve canonical group name if passed by ID or case-mismatched name
  const grpCheck = await db.execute({
    sql: "SELECT id, name FROM project_groups WHERE LOWER(name) = LOWER(?) OR id = ? LIMIT 1",
    args: [group, group],
  });
  const canonicalName = grpCheck.rows.length > 0 ? (grpCheck.rows[0].name as string) : group;

  // Find all services in this project group (including legacy/unassigned services under Production)
  const isProdQuery = canonicalName.toLowerCase() === "production" || group.toLowerCase() === "production";
  const svcRes = await db.execute({
    sql: isProdQuery
      ? `SELECT status, uptime_pct, latency_ms FROM services 
         WHERE (LOWER(group_name) = 'production' OR group_name IS NULL OR group_name = '')`
      : `SELECT status, uptime_pct, latency_ms FROM services 
         WHERE LOWER(group_name) = LOWER(?) OR LOWER(group_name) = LOWER(?)`,
    args: isProdQuery ? [] : [group, canonicalName],
  });

  const services = svcRes.rows as any[];
  const label = customLabel || canonicalName.toUpperCase();

  // If no services tagged with this group, verify if group exists in project_groups or services
  if (services.length === 0) {
    if (grpCheck.rows.length === 0) {
      const anySvc = await db.execute({
        sql: isProdQuery
          ? `SELECT count(*) as count FROM services 
             WHERE (LOWER(group_name) = 'production' OR group_name IS NULL OR group_name = '')`
          : `SELECT count(*) as count FROM services 
             WHERE LOWER(group_name) = LOWER(?) OR LOWER(group_name) = LOWER(?)`,
        args: isProdQuery ? [] : [group, canonicalName],
      });
      if (Number(anySvc.rows[0]?.count || 0) === 0) {
        const svg = renderSvgBadge(label, "PROJECT NOT FOUND", "#71717a", redirectUrl);
        return res.send(svg);
      }
    }

    if (metric === "uptime") {
      const svg = renderSvgBadge(label, "100.0%", "#10b981", redirectUrl);
      return res.send(svg);
    }

    if (metric === "latency") {
      const svg = renderSvgBadge(label, "0ms", "#0284c7", redirectUrl);
      return res.send(svg);
    }

    const svg = renderSvgBadge(label, "OPERATIONAL", "#10b981", redirectUrl);
    return res.send(svg);
  }

  // Calculate project aggregate metrics
  const hasCritical = services.some((s) => s.status === "critical");
  const hasWarning = services.some((s) => s.status === "warning");
  const allMaintenance = services.every((s) => s.status === "maintenance");
  
  const overallStatus = hasCritical ? "outage" : hasWarning ? "degraded" : allMaintenance ? "maintenance" : "operational";
  const statusColor = hasCritical ? "#f43f5e" : hasWarning ? "#f59e0b" : allMaintenance ? "#0284c7" : "#10b981";

  const avgUptime = Number(
    (services.reduce((acc, s) => acc + (s.uptime_pct || 100), 0) / services.length).toFixed(2)
  );

  const avgLatency = Math.round(
    services.reduce((acc, s) => acc + (s.latency_ms || 0), 0) / services.length
  );

  if (metric === "uptime") {
    const uptimeColor = avgUptime >= 99.0 ? "#10b981" : avgUptime >= 95.0 ? "#f59e0b" : "#f43f5e";
    const svg = renderSvgBadge(label, `${avgUptime}%`, uptimeColor, redirectUrl);
    return res.send(svg);
  }

  if (metric === "latency") {
    const svg = renderSvgBadge(label, `${avgLatency}ms`, "#0284c7", redirectUrl);
    return res.send(svg);
  }

  const svg = renderSvgBadge(label, overallStatus.toUpperCase(), statusColor, redirectUrl);
  return res.send(svg);
}

// Helper to handle individual service badge generation
async function handleServiceBadge(serviceIdOrName: string, req: Request, res: Response) {
  const db = getDb();
  let target = decodeURIComponent(serviceIdOrName).trim();
  target = target.replace(/\.svg$/i, "").replace(/\/status$/i, "").trim();
  const metric = (req.query.metric as string) || "status";
  const customLabel = req.query.label as string | undefined;

  const svcRes = await db.execute({
    sql: "SELECT * FROM services WHERE id = ? OR LOWER(name) = LOWER(?) LIMIT 1",
    args: [target, target],
  });

  const service = (svcRes.rows.length > 0 ? svcRes.rows[0] : null) as any;
  const defaultServiceRedirect = service
    ? `${DEFAULT_REDIRECT_URL.replace(/\/$/, "")}/service/${service.id}`
    : DEFAULT_REDIRECT_URL;
  const redirectUrl = (req.query.link as string) || defaultServiceRedirect;

  if (!service) {
    const svg = renderSvgBadge(customLabel || "heimdall", "TARGET NOT FOUND", "#71717a", redirectUrl);
    return res.send(svg);
  }

  const label = customLabel || service.name;

  if (metric === "uptime") {
    const uptime = Number(service.uptime_pct || 100);
    const uptimeColor = uptime >= 99.0 ? "#10b981" : uptime >= 95.0 ? "#f59e0b" : "#f43f5e";
    const svg = renderSvgBadge(label, `${uptime.toFixed(1)}%`, uptimeColor, redirectUrl);
    return res.send(svg);
  }

  if (metric === "latency") {
    const svg = renderSvgBadge(label, `${service.latency_ms || 0}ms`, "#0284c7", redirectUrl);
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

  const svg = renderSvgBadge(label, statusText.toUpperCase(), statusColor, redirectUrl);
  return res.send(svg);
}

// GET dynamic SVG status badge for a specific project/environment group
router.get(["/project/:group/status.svg", "/project/:group.svg", "/project/:group"], async (req: Request, res: Response) => {
  try {
    await initDb();
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "max-age=0, no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return await handleProjectGroupBadge(req.params.group, req, res);
  } catch (err: any) {
    const errorSvg = renderSvgBadge("error", "badge generator failed", "#f43f5e");
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    return res.status(500).send(errorSvg);
  }
});

// GET dynamic SVG status badge for an individual service
router.get(["/service/:id/status.svg", "/service/:id.svg", "/service/:id"], async (req: Request, res: Response) => {
  try {
    await initDb();
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "max-age=0, no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return await handleServiceBadge(req.params.id, req, res);
  } catch (err: any) {
    const errorSvg = renderSvgBadge("error", "badge generator failed", "#f43f5e");
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    return res.status(500).send(errorSvg);
  }
});

// GET dynamic SVG status badge for fleet, project, or individual target
router.get(["/:id/status.svg", "/:id.svg", "/:id"], async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    let rawId = req.params.id || "";
    let id = decodeURIComponent(rawId).replace(/\.svg$/i, "").replace(/\/status$/i, "").trim();
    const metric = (req.query.metric as string) || "status";
    const customLabel = req.query.label as string | undefined;
    const redirectUrl = (req.query.link as string) || DEFAULT_REDIRECT_URL;

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "max-age=0, no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Fleet-wide aggregation badge
    if (id === "fleet") {
      const svcRes = await db.execute("SELECT status, uptime_pct FROM services WHERE is_public = 1 OR is_public IS NULL");
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
        const svg = renderSvgBadge(customLabel || "FLEET UPTIME", `${avgUptime}%`, uptimeColor, redirectUrl);
        return res.send(svg);
      }

      const svg = renderSvgBadge(customLabel || "FLEET STATUS", overallStatus.toUpperCase(), statusColor, redirectUrl);
      return res.send(svg);
    }

    // Check if ID matches a service
    const svcRes = await db.execute({
      sql: "SELECT id FROM services WHERE id = ? OR LOWER(name) = LOWER(?) LIMIT 1",
      args: [id, id],
    });

    if (svcRes.rows.length > 0) {
      return await handleServiceBadge(id, req, res);
    }

    // Check if ID matches a project group
    const grpRes = await db.execute({
      sql: "SELECT id FROM project_groups WHERE LOWER(name) = LOWER(?) OR id = ? LIMIT 1",
      args: [id, id],
    });

    if (grpRes.rows.length > 0) {
      return await handleProjectGroupBadge(id, req, res);
    }

    const svg = renderSvgBadge(customLabel || "heimdall", "TARGET NOT FOUND", "#71717a", redirectUrl);
    return res.send(svg);
  } catch (err: any) {
    const errorSvg = renderSvgBadge("error", "badge generator failed", "#f43f5e");
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    return res.status(500).send(errorSvg);
  }
});

export default router;
