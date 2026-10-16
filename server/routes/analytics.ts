import { Router, Request, Response } from "express";
import { getDb, initDb } from "../db.js";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const now = Date.now();
    const past24h = now - 24 * 3600 * 1000;
    const filterServiceId = req.query.service_id ? String(req.query.service_id) : null;

    // 1. Fetch all services for Uptime Kuma monitors breakdown & selector
    const srvRes = await db.execute("SELECT id, name, type, endpoint, status, latency_ms, uptime_pct, is_maintenance FROM services ORDER BY created_at ASC");
    const allServices = srvRes.rows as any[];

    // 2. Fetch telemetry points for past 24h (optionally filtered by service_id)
    let ptsSql = `
      SELECT t.*, s.name as service_name
      FROM telemetry_points t
      LEFT JOIN services s ON t.service_id = s.id
      WHERE t.recorded_at >= ?
    `;
    const ptsArgs: any[] = [past24h];

    if (filterServiceId) {
      ptsSql += " AND t.service_id = ?";
      ptsArgs.push(filterServiceId);
    }
    ptsSql += " ORDER BY t.recorded_at ASC";

    const ptsRes = await db.execute({ sql: ptsSql, args: ptsArgs });
    const points = ptsRes.rows as any[];

    // 3. Compute hourly buckets for Recharts latency curves
    const hourlyMap = new Map<string, { totalLat: number; count: number; errorCount: number; timestamp: number }>();
    const allLatencies: number[] = [];

    for (const pt of points) {
      if (pt.latency_ms > 0) allLatencies.push(pt.latency_ms);
      const d = new Date(pt.recorded_at);
      const hourKey = `${d.getHours()}:00`;

      const existing = hourlyMap.get(hourKey) || { totalLat: 0, count: 0, errorCount: 0, timestamp: pt.recorded_at };
      existing.totalLat += pt.latency_ms || 0;
      existing.count += 1;
      if (pt.status_code && pt.status_code >= 400) {
        existing.errorCount += 1;
      }
      hourlyMap.set(hourKey, existing);
    }

    const latencyTrend = Array.from(hourlyMap.entries()).map(([hour, val]) => ({
      hour,
      latency: val.count > 0 ? Math.round(val.totalLat / val.count) : 0,
      errors: val.errorCount,
    }));

    // 4. Percentiles (p50, p95, p99)
    allLatencies.sort((a, b) => a - b);
    const p50 = allLatencies.length > 0 ? allLatencies[Math.floor(allLatencies.length * 0.5)] : 0;
    const p95 = allLatencies.length > 0 ? allLatencies[Math.floor(allLatencies.length * 0.95)] : 0;
    const p99 = allLatencies.length > 0 ? allLatencies[Math.floor(allLatencies.length * 0.99)] : 0;

    // 5. Incident MTTR (Mean Time to Resolution)
    const resolvedRes = await db.execute(`
      SELECT (resolved_at - first_seen_at) as duration_ms
      FROM incidents
      WHERE status = 'resolved' AND resolved_at IS NOT NULL
      LIMIT 50
    `);

    let mttrMinutes = 12;
    if (resolvedRes.rows.length > 0) {
      const totalMs = resolvedRes.rows.reduce((acc, row: any) => acc + (Number(row.duration_ms) || 0), 0);
      mttrMinutes = Math.round(totalMs / resolvedRes.rows.length / 60000) || 1;
    }

    // 6. Uptime Kuma per-monitor breakdown table with genuine 24h, 7d, and 30d SLAs
    const past7d = now - 7 * 86400 * 1000;
    const past30d = now - 30 * 86400 * 1000;

    const slaRes = await db.execute({
      sql: `SELECT 
              service_id, 
              COUNT(*) as total_30d, 
              SUM(CASE WHEN (status_code IS NOT NULL AND status_code >= 400) OR status_code = 0 THEN 1 ELSE 0 END) as failed_30d, 
              SUM(CASE WHEN recorded_at >= ? THEN 1 ELSE 0 END) as total_7d, 
              SUM(CASE WHEN recorded_at >= ? AND ((status_code IS NOT NULL AND status_code >= 400) OR status_code = 0) THEN 1 ELSE 0 END) as failed_7d, 
              SUM(CASE WHEN recorded_at >= ? THEN 1 ELSE 0 END) as total_24h, 
              SUM(CASE WHEN recorded_at >= ? AND ((status_code IS NOT NULL AND status_code >= 400) OR status_code = 0) THEN 1 ELSE 0 END) as failed_24h, 
              ROUND(AVG(CASE WHEN recorded_at >= ? THEN latency_ms ELSE NULL END), 1) as avg_latency_24h 
            FROM telemetry_points 
            WHERE recorded_at >= ? 
            GROUP BY service_id`,
      args: [past7d, past7d, past24h, past24h, past24h, past30d],
    });

    const slaMap = new Map<string, any>();
    for (const row of slaRes.rows as any[]) {
      slaMap.set(String(row.service_id), row);
    }

    const monitorsBreakdown = allServices.map((svc) => {
      const stats = slaMap.get(svc.id);
      const total24h = Number(stats?.total_24h || 0);
      const failed24h = Number(stats?.failed_24h || 0);
      const total7d = Number(stats?.total_7d || 0);
      const failed7d = Number(stats?.failed_7d || 0);
      const total30d = Number(stats?.total_30d || 0);
      const failed30d = Number(stats?.failed_30d || 0);

      const uptime24h = total24h > 0
        ? Number(((1 - failed24h / total24h) * 100).toFixed(2))
        : Number(svc.uptime_pct || 100.0);

      const uptime7d = total7d > 0
        ? Number(((1 - failed7d / total7d) * 100).toFixed(2))
        : Number(svc.uptime_pct || 100.0);

      const uptime30d = total30d > 0
        ? Number(((1 - failed30d / total30d) * 100).toFixed(2))
        : Number(svc.uptime_pct || 100.0);

      const avgLat = Number(stats?.avg_latency_24h || svc.latency_ms || 0);

      return {
        id: svc.id,
        name: svc.name,
        type: svc.type,
        endpoint: svc.endpoint,
        status: svc.status,
        is_maintenance: svc.is_maintenance,
        uptime24h,
        uptime7d,
        uptime30d,
        currentLatency: svc.latency_ms || 0,
        avgLatency: Math.round(avgLat),
        checksCount24h: total24h,
      };
    });

    return res.json({
      selectedServiceId: filterServiceId,
      allServices: allServices.map((s) => ({ id: s.id, name: s.name, type: s.type })),
      monitorsBreakdown,
      latencyTrend,
      percentiles: { p50, p95, p99 },
      mttrMinutes,
      totalChecks24h: points.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to load analytics", details: err.message });
  }
});

export default router;
