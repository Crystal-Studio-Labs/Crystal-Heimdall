import { getDb, initDb } from "./db.js";
import { checkAndRegisterAlert } from "./deduplicator.js";
import { sendTelegramAlert, sendDiscordWebhookAlert } from "./dispatcher.js";

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
    // If target is in maintenance mode, skip alerting
    if (svc.is_maintenance === 1) {
      result.details.push({
        serviceId: svc.id,
        name: svc.name,
        status: "maintenance",
        latencyMs: svc.latency_ms || 0,
      });
      continue;
    }

    if (svc.type === "http-poll" && svc.endpoint) {
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
      } catch (err: any) {
        latencyMs = Math.round(performance.now() - startTime);
        isHealthy = false;
        errorMessage = err.name === "AbortError" ? "Request Timeout (>7000ms)" : err.message;
      }

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
                `Target ${svc.endpoint} failed ${nextFailures} checks: ${errorMessage}`,
                dedupe.fingerprint,
                now,
                now,
              ],
            });

            await sendTelegramAlert({
              serviceName: svc.name,
              severity: "critical",
              title,
              message: `Target ${svc.endpoint} is unreachable (${errorMessage}).`,
              timestamp: now,
            });

            await sendDiscordWebhookAlert({
              serviceName: svc.name,
              severity: "critical",
              title,
              message: `Target ${svc.endpoint} is unreachable (${errorMessage}).`,
              timestamp: now,
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
    } else if (svc.type === "deadman-cron") {
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

  return result;
}
