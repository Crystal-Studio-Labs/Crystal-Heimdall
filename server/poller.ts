import { getDb, initDb } from "./db.js";
import { checkAndRegisterAlert } from "./deduplicator.js";
import { sendTelegramAlert, sendDiscordWebhookAlert } from "./dispatcher.js";
import { checkTcpPort, checkSslExpiry, parseTargetAddress } from "./probers.js";
import { notifySubscribers } from "./routes/subscribers.js";
import { isTargetInMaintenance } from "./routes/maintenance.js";
import { broadcastStatusUpdate } from "./routes/status.js";

export interface PollResult {
  polledCount: number;
  healthyCount: number;
  failedCount: number;
  details: Array<{
    serviceId: string;
    name: string;
    status: string;
    latencyMs: number;
    statusCode?: number;
    error?: string;
  }>;
}

/**
 * Common handler to record telemetry, update target status, and trigger alert/incidents on failure.
 */
async function handleTargetEvaluation(
  db: any,
  svc: any,
  isHealthy: boolean,
  latencyMs: number,
  statusCode: number,
  errorMessage: string,
  now: number,
  result: PollResult
) {
  // Record telemetry point
  await db.execute({
    sql: "INSERT INTO telemetry_points (service_id, latency_ms, status_code, recorded_at) VALUES (?, ?, ?, ?)",
    args: [svc.id, latencyMs, statusCode || null, now],
  });

  if (isHealthy) {
    result.healthyCount++;
    await db.execute({
      sql: `UPDATE services 
            SET status = 'healthy', latency_ms = ?, last_ping_at = ?, consecutive_failures = 0
            WHERE id = ?`,
      args: [latencyMs, now, svc.id],
    });

    // Auto-resolve any active incident for this service if recovered
    await db.execute({
      sql: `UPDATE incidents 
            SET status = 'resolved', resolved_at = ? 
            WHERE service_id = ? AND status = 'active'`,
      args: [now, svc.id],
    });

    result.details.push({
      serviceId: svc.id,
      name: svc.name,
      status: "healthy",
      latencyMs,
      statusCode,
    });
  } else {
    result.failedCount++;
    const retryThreshold = svc.retry_count || 2;
    const nextFailures = (svc.consecutive_failures || 0) + 1;
    const newStatus = nextFailures >= retryThreshold ? "critical" : "warning";

    await db.execute({
      sql: `UPDATE services 
            SET status = ?, latency_ms = ?, last_ping_at = ?, consecutive_failures = ?
            WHERE id = ?`,
      args: [newStatus, latencyMs, now, nextFailures, svc.id],
    });

    if (nextFailures >= retryThreshold) {
      const title = `Synthetic Poll Failure: ${errorMessage}`;
      const dedupe = checkAndRegisterAlert(svc.id, title);

      if (!dedupe.isSuppressed) {
        const incId = `inc-${Date.now().toString(36)}`;
        await db.execute({
          sql: `INSERT INTO incidents (id, service_id, severity, title, message, fingerprint, status, occurrences_count, first_seen_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)`,
          args: [
            incId,
            svc.id,
            "critical",
            title,
            `Target ${svc.name} (${svc.endpoint || `port ${svc.port}`}) failed ${nextFailures} checks: ${errorMessage}`,
            dedupe.fingerprint,
            now,
            now,
          ],
        });

        await db.execute({
          sql: "INSERT INTO incident_updates (id, incident_id, status, message, created_at) VALUES (?, ?, 'investigating', ?, ?)",
          args: [
            `upd-${Date.now().toString(36)}-init`,
            incId,
            `Synthetic check threshold breach: ${errorMessage}. Automated investigation initiated.`,
            now,
          ],
        });

        await sendTelegramAlert({
          serviceName: svc.name,
          severity: "critical",
          title,
          message: `Target ${svc.name} (${svc.endpoint || `port ${svc.port}`}) is unreachable (${errorMessage}).`,
          timestamp: now,
        });

        await sendDiscordWebhookAlert({
          serviceName: svc.name,
          severity: "critical",
          title,
          message: `Target ${svc.name} (${svc.endpoint || `port ${svc.port}`}) is unreachable (${errorMessage}).`,
          timestamp: now,
        });

        await notifySubscribers({
          id: incId,
          serviceName: svc.name,
          severity: "critical",
          title,
          message: `Target ${svc.name} (${svc.endpoint || `port ${svc.port}`}) is unreachable (${errorMessage}).`,
          status: "active",
        });
      }
    }

    result.details.push({
      serviceId: svc.id,
      name: svc.name,
      status: newStatus,
      latencyMs,
      statusCode,
      error: errorMessage,
    });
  }
}

export async function runPollCycle(): Promise<PollResult> {
  await initDb();
  const db = getDb();
  const now = Date.now();

  const servicesRes = await db.execute("SELECT * FROM services");
  const services = servicesRes.rows as any[];

  const result: PollResult = {
    polledCount: 0,
    healthyCount: 0,
    failedCount: 0,
    details: [],
  };

  for (const svc of services) {
    // 1. If target is in maintenance mode or within an active scheduled window, skip alerting
    const inScheduledMaint = await isTargetInMaintenance(svc.id, svc.name);
    if (svc.is_maintenance === 1 || inScheduledMaint) {
      if (svc.status !== "maintenance") {
        await db.execute({
          sql: "UPDATE services SET status = 'maintenance' WHERE id = ?",
          args: [svc.id],
        });
      }
      result.details.push({
        serviceId: svc.id,
        name: svc.name,
        status: "maintenance",
        latencyMs: svc.latency_ms || 0,
      });
      continue;
    }

    // 2. TCP Socket Port Check (e.g. Postgres, Redis, Game/Custom Servers)
    if (svc.type === "port-check" || (svc.endpoint && svc.endpoint.startsWith("tcp://"))) {
      result.polledCount++;
      const target = parseTargetAddress(svc.endpoint || "", svc.port);
      const portRes = await checkTcpPort(target.host, target.port, 5000);
      const isHealthy = portRes.isHealthy;
      const latencyMs = portRes.latencyMs;
      const statusCode = isHealthy ? 200 : 0;
      const errorMessage = portRes.errorMessage || (isHealthy ? "" : "TCP connection failed");

      await handleTargetEvaluation(db, svc, isHealthy, latencyMs, statusCode, errorMessage, now, result);
    }
    // 3. HTTP / HTTPS Synthetic Poll
    else if (svc.type === "http-poll" && svc.endpoint) {
      result.polledCount++;
      const startTime = performance.now();
      let isHealthy = false;
      let statusCode = 0;
      let latencyMs = 0;
      let errorMessage = "";

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const res = await fetch(svc.endpoint, {
          method: "GET",
          signal: controller.signal,
          headers: { "User-Agent": "Crystal-Heimdall-Sentinel/2.0" },
        });
        clearTimeout(timeoutId);

        latencyMs = Math.round(performance.now() - startTime);
        statusCode = res.status;

        // Status code check
        const expectedCodes = svc.expected_status_code || "200-299";
        if (expectedCodes === "200-299") {
          isHealthy = res.ok;
        } else {
          const allowed = expectedCodes.split(",").map((c: string) => c.trim());
          isHealthy = allowed.includes(String(statusCode));
        }

        // Keyword check
        if (isHealthy && svc.keyword) {
          const bodyText = await res.text();
          if (!bodyText.includes(svc.keyword)) {
            isHealthy = false;
            errorMessage = `Keyword '${svc.keyword}' not found in body`;
          }
        }

        if (!isHealthy && !errorMessage) {
          errorMessage = `HTTP Status ${statusCode} ${res.statusText}`;
        }

        // If HTTPS, check SSL certificate validity and expiry days
        if (isHealthy && svc.endpoint.startsWith("https://")) {
          try {
            const parsed = parseTargetAddress(svc.endpoint);
            const sslRes = await checkSslExpiry(parsed.host, parsed.port, 4000);
            if (sslRes.daysRemaining !== null) {
              await db.execute({
                sql: "UPDATE services SET ssl_expiry_days = ? WHERE id = ?",
                args: [sslRes.daysRemaining, svc.id],
              });
            }
          } catch (_sslErr) {
            // Non-fatal SSL inspection
          }
        }
      } catch (err: any) {
        latencyMs = Math.round(performance.now() - startTime);
        isHealthy = false;
        errorMessage = err.name === "AbortError" ? "Request Timeout (>7000ms)" : err.message;
      }

      await handleTargetEvaluation(db, svc, isHealthy, latencyMs, statusCode, errorMessage, now, result);
    }
    // 4. Dead-Man's Switch (Cron job heartbeats)
    else if (svc.type === "deadman-cron") {
      const expectedSec = svc.expected_interval_sec || 86400;
      const graceSec = svc.grace_period_sec || 300;
      const deadlineMs = (svc.last_ping_at || svc.created_at) + (expectedSec + graceSec) * 1000;

      if (now > deadlineMs) {
        await db.execute({
          sql: "UPDATE services SET status = 'critical' WHERE id = ?",
          args: [svc.id],
        });

        const title = `Dead-Man's Switch: Missed Heartbeat`;
        const dedupe = checkAndRegisterAlert(svc.id, title);

        if (!dedupe.isSuppressed) {
          const incId = `inc-cron-${Date.now().toString(36)}`;
          await db.execute({
            sql: `INSERT INTO incidents (id, service_id, severity, title, message, fingerprint, status, occurrences_count, first_seen_at, last_seen_at)
                  VALUES (?, ?, 'critical', ?, ?, ?, 'active', 1, ?, ?)`,
            args: [
              incId,
              svc.id,
              title,
              `Cron task ${svc.name} missed expected ping interval of ${expectedSec}s.`,
              dedupe.fingerprint,
              now,
              now,
            ],
          });

          await db.execute({
            sql: "INSERT INTO incident_updates (id, incident_id, status, message, created_at) VALUES (?, ?, 'investigating', ?, ?)",
            args: [
              `upd-${Date.now().toString(36)}-init`,
              incId,
              `Dead-man missed heartbeat: expected ping interval of ${expectedSec}s expired.`,
              now,
            ],
          });

          await sendTelegramAlert({
            serviceName: svc.name,
            severity: "critical",
            title,
            message: `Scheduled worker failed to check in on time.`,
            timestamp: now,
          });

          await sendDiscordWebhookAlert({
            serviceName: svc.name,
            severity: "critical",
            title,
            message: `Scheduled worker failed to check in on time.`,
            timestamp: now,
          });
        }
      }
    }
  }

  // Trigger real-time status push to all active SSE subscribers
  broadcastStatusUpdate({ event: "poll_completed", summary: result });

  return result;
}
