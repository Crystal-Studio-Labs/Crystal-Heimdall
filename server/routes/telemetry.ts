import { Router, Request, Response } from "express";
import { getDb, initDb } from "../db.js";
import { checkAndRegisterAlert } from "../deduplicator.js";
import { sendTelegramAlert, sendDiscordWebhookAlert } from "../dispatcher.js";

const router = Router();

// GET all crash error issues & telemetry metrics
router.get("/errors", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { status, level, project } = req.query;

    let query = "SELECT * FROM error_issues WHERE 1=1";
    const args: any[] = [];

    if (status && status !== "all") {
      query += " AND status = ?";
      args.push(status);
    }
    if (level && level !== "all") {
      query += " AND level = ?";
      args.push(level);
    }
    if (project && project !== "all") {
      query += " AND project = ?";
      args.push(project);
    }

    query += " ORDER BY last_seen_at DESC LIMIT 100";

    const issuesRes = await db.execute({ sql: query, args });

    // Compute stats
    const totalRes = await db.execute("SELECT count(*) as count FROM error_issues");
    const unresolvedRes = await db.execute("SELECT count(*) as count FROM error_issues WHERE status = 'unresolved'");
    const fatalRes = await db.execute("SELECT count(*) as count FROM error_issues WHERE level = 'fatal' AND status = 'unresolved'");

    return res.json({
      issues: issuesRes.rows,
      stats: {
        total: Number(totalRes.rows[0]?.count || 0),
        unresolved: Number(unresolvedRes.rows[0]?.count || 0),
        fatal: Number(fatalRes.rows[0]?.count || 0),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch error issues", details: err.message });
  }
});

// POST ingest crash report (Sentry-style error sink)
router.post("/errors", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const now = Date.now();
    const {
      project = "Unknown Project",
      title,
      message = "Unspecified exception",
      error_type = "Error",
      level = "error",
      stack_trace = "",
      environment = "production",
      user_agent,
      metadata,
    } = req.body;

    const issueTitle = title || `${error_type}: ${message.slice(0, 80)}`;
    const id = `err-${Math.random().toString(36).substring(2, 9)}`;

    // Check if an unresolved issue with same project and error_type exists to deduplicate
    const existingRes = await db.execute({
      sql: "SELECT * FROM error_issues WHERE project = ? AND error_type = ? AND status = 'unresolved' LIMIT 1",
      args: [project, error_type],
    });

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0] as any;
      const newCount = (existing.events_count || 1) + 1;
      await db.execute({
        sql: `UPDATE error_issues 
              SET events_count = ?, last_seen_at = ?, message = ?, stack_trace = COALESCE(?, stack_trace)
              WHERE id = ?`,
        args: [newCount, now, message, stack_trace, existing.id],
      });

      return res.json({
        status: "updated",
        id: existing.id,
        events_count: newCount,
      });
    }

    // Insert new issue
    await db.execute({
      sql: `INSERT INTO error_issues (id, project, title, error_type, level, message, stack_trace, environment, status, events_count, first_seen_at, last_seen_at, user_agent, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unresolved', 1, ?, ?, ?, ?)`,
      args: [
        id,
        project,
        issueTitle,
        error_type,
        level,
        message,
        stack_trace,
        environment,
        now,
        now,
        user_agent || req.headers["user-agent"] || null,
        metadata ? JSON.stringify(metadata) : null,
      ],
    });

    // If level is fatal or error, record an incident and dispatch notifications
    if (level === "fatal" || level === "error") {
      const dedupe = checkAndRegisterAlert(project, issueTitle);
      if (!dedupe.isSuppressed) {
        const incId = `inc-crash-${Date.now().toString(36)}`;
        await db.execute({
          sql: `INSERT INTO incidents (id, service_id, severity, title, message, stack_trace, fingerprint, status, occurrences_count, first_seen_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)`,
          args: [
            incId,
            project,
            level === "fatal" ? "critical" : "warning",
            `Crash Exception: ${issueTitle}`,
            message,
            stack_trace,
            dedupe.fingerprint,
            now,
            now,
          ],
        });

        await sendTelegramAlert({
          serviceName: project,
          severity: level === "fatal" ? "critical" : "warning",
          title: `[SENTRY SINK] ${issueTitle}`,
          message: `${message}\nEnvironment: ${environment}`,
          timestamp: now,
        });

        await sendDiscordWebhookAlert({
          serviceName: project,
          severity: level === "fatal" ? "critical" : "warning",
          title: `[SENTRY SINK] ${issueTitle}`,
          message: `${message}\nEnvironment: ${environment}`,
          timestamp: now,
        });
      }
    }

    return res.json({ status: "created", id });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to ingest error report", details: err.message });
  }
});

// PATCH triage issue (resolve / unresolve / ignore)
router.patch("/errors/:id", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["resolved", "unresolved", "ignored"].includes(status)) {
      return res.status(400).json({ error: "Valid status ('resolved' | 'unresolved' | 'ignored') required" });
    }

    await db.execute({
      sql: "UPDATE error_issues SET status = ? WHERE id = ?",
      args: [status, id],
    });

    return res.json({ status: "updated", id, newStatus: status });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update issue status", details: err.message });
  }
});

// DELETE error issue
router.delete("/errors/:id", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;

    await db.execute({
      sql: "DELETE FROM error_issues WHERE id = ?",
      args: [id],
    });

    return res.json({ status: "deleted", id });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete issue", details: err.message });
  }
});

// POST simulate test crash
router.post("/errors/simulate", async (_req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const now = Date.now();

    const sampleCrashes = [
      {
        project: "Crystal Studio Labs Client",
        error_type: "UnhandledRejection",
        level: "fatal",
        message: "DOMException: The play() request was interrupted by a new load request.",
        stack_trace: `UnhandledRejection: Audio playback buffer underrun
    at HTMLAudioElement.play (client/src/player.ts:142:18)
    at Object.triggerAlarm (client/src/alerts.ts:89:12)
    at DispatchLoop.step (client/src/scheduler.ts:24:9)`,
      },
      {
        project: "Crystal Gateway Worker",
        error_type: "RedisConnectionTimeout",
        level: "error",
        message: "Socket closed unexpectedly while awaiting PING reply from redis://10.0.4.12:6379",
        stack_trace: `RedisConnectionTimeout: Socket timed out after 4000ms
    at Socket.<anonymous> (ioredis/built/connectors/StandaloneConnector.js:68:24)
    at Socket.emit (node:events:518:28)
    at TCP.onStreamRead (node:internal/stream_base_commons:217:20)`,
      },
      {
        project: "Billing Engine",
        error_type: "StripeWebhookSignatureVerificationError",
        level: "fatal",
        message: "No signatures found matching the expected signature for payload timestamp 1760081200",
        stack_trace: `StripeWebhookSignatureVerificationError: Invalid webhook signature header
    at Webhook.verifySignature (stripe/lib/Webhooks.js:61:15)
    at Router.handle (server/routes/webhooks.ts:33:20)`,
      },
    ];

    const pick = sampleCrashes[Math.floor(Math.random() * sampleCrashes.length)];
    const id = `sim-${Date.now().toString(36)}`;
    const title = `${pick.error_type}: ${pick.message}`;

    await db.execute({
      sql: `INSERT INTO error_issues (id, project, title, error_type, level, message, stack_trace, environment, status, events_count, first_seen_at, last_seen_at, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'production', 'unresolved', 1, ?, ?, ?)`,
      args: [
        id,
        pick.project,
        title,
        pick.error_type,
        pick.level,
        pick.message,
        pick.stack_trace,
        now,
        now,
        JSON.stringify({ simulated: true, simulatedAt: new Date(now).toISOString() }),
      ],
    });

    return res.json({
      status: "simulated",
      issue: {
        id,
        project: pick.project,
        title,
        level: pick.level,
        message: pick.message,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to simulate crash", details: err.message });
  }
});

export default router;
