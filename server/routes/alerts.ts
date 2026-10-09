import { Router, Request, Response } from "express";
import { getDb, initDb } from "../db.js";
import { checkAndRegisterAlert } from "../deduplicator.js";
import { sendTelegramAlert, sendDiscordWebhookAlert } from "../dispatcher.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();

    // Authenticate via Bearer token
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: Missing Bearer API key." });
    }

    const svcRes = await db.execute({
      sql: "SELECT * FROM services WHERE api_key = ?",
      args: [token],
    });

    if (svcRes.rows.length === 0) {
      return res.status(403).json({ error: "Unauthorized: Invalid project API key." });
    }

    const service = svcRes.rows[0] as any;
    const { severity = "warning", title = "Unhandled Exception", message, stack_trace, stack } = req.body;
    const cleanTitle = String(title).slice(0, 150);
    const stackTrace = stack_trace || stack;
    const now = Date.now();

    // Deduplication check
    const dedupe = checkAndRegisterAlert(service.id, cleanTitle);

    if (dedupe.isSuppressed) {
      await db.execute({
        sql: `UPDATE incidents 
              SET occurrences_count = occurrences_count + 1, last_seen_at = ?
              WHERE fingerprint = ? AND status != 'resolved'`,
        args: [now, dedupe.fingerprint],
      });

      return res.json({
        status: "suppressed_duplicate",
        message: "Alert aggregated into active incident.",
        occurrences: dedupe.occurrenceCount,
      });
    }

    // Insert new incident
    const incId = `inc-${Date.now().toString(36)}`;
    await db.execute({
      sql: `INSERT INTO incidents (id, service_id, severity, title, message, stack_trace, fingerprint, status, occurrences_count, first_seen_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)`,
      args: [
        incId,
        service.id,
        severity,
        cleanTitle,
        message ? String(message) : null,
        stackTrace ? String(stackTrace) : null,
        dedupe.fingerprint,
        now,
        now,
      ],
    });

    // Update service status
    const newStatus = severity === "critical" ? "critical" : "warning";
    await db.execute({
      sql: "UPDATE services SET status = ?, last_ping_at = ? WHERE id = ?",
      args: [newStatus, now, service.id],
    });

    // Dispatch to Discord & Telegram
    const [telegramResult, discordResult] = await Promise.all([
      sendTelegramAlert({
        serviceName: service.name,
        severity,
        title: cleanTitle,
        message,
        timestamp: now,
      }),
      sendDiscordWebhookAlert({
        serviceName: service.name,
        severity,
        title: cleanTitle,
        message,
        timestamp: now,
      }),
    ]);

    return res.json({
      status: "dispatched",
      incidentId: incId,
      telegram: telegramResult,
      discord: discordResult,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to process alert", details: err.message });
  }
});

export default router;
