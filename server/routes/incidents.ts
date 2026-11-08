import { Router, Request, Response } from "express";
import { getDb, initDb } from "../db.js";
import { broadcastStatusUpdate } from "./status.js";

const router = Router();

// GET all incidents joined with service names
router.get("/", async (_req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const result = await db.execute(`
      SELECT i.*, s.name as service_name
      FROM incidents i
      LEFT JOIN services s ON i.service_id = s.id
      ORDER BY i.last_seen_at DESC
      LIMIT 100
    `);

    return res.json({ incidents: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch incidents", details: err.message });
  }
});

// GET single incident by ID with chronological updates ledger
router.get("/:id", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;
    const result = await db.execute({
      sql: `
        SELECT i.*, s.name as service_name, s.type as service_type, s.endpoint as service_endpoint
        FROM incidents i
        LEFT JOIN services s ON i.service_id = s.id
        WHERE i.id = ?
        LIMIT 1
      `,
      args: [id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Incident not found" });
    }

    const updatesRes = await db.execute({
      sql: "SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC",
      args: [id],
    });

    return res.json({
      incident: {
        ...result.rows[0],
        updates: updatesRes.rows,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch incident", details: err.message });
  }
});

// GET /:id/postmortem - Generate automated Markdown Root Cause Analysis (RCA) postmortem
router.get("/:id/postmortem", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;

    const result = await db.execute({
      sql: `
        SELECT i.*, s.name as service_name, s.type as service_type, s.endpoint as service_endpoint
        FROM incidents i
        LEFT JOIN services s ON i.service_id = s.id
        WHERE i.id = ?
        LIMIT 1
      `,
      args: [id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Incident not found" });
    }

    const incident = result.rows[0] as any;
    const updatesRes = await db.execute({
      sql: "SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC",
      args: [id],
    });
    const updates = updatesRes.rows as any[];

    // Calculate duration & MTTR
    const startTime = Number(incident.first_seen_at) || Date.now();
    const endTime = incident.resolved_at ? Number(incident.resolved_at) : Number(incident.last_seen_at) || Date.now();
    const durationMs = Math.max(0, endTime - startTime);
    const durationMinutes = Math.round(durationMs / 60000);
    const mttrString =
      durationMinutes < 1
        ? `${Math.round(durationMs / 1000)} seconds`
        : durationMinutes < 60
        ? `${durationMinutes} minutes`
        : `${(durationMinutes / 60).toFixed(1)} hours`;

    // Construct Markdown report
    const timelineRows = updates.length > 0
      ? updates.map((u) => `| ${new Date(Number(u.created_at)).toISOString()} | \`[${String(u.status).toUpperCase()}]\` | ${u.message} |`).join("\n")
      : `| ${new Date(startTime).toISOString()} | \`[FIRST_SEEN]\` | Automated telemetry alarm tripped. |`;

    const markdown = `# INCIDENT POSTMORTEM REPORT: ${incident.title}

| Metric | Value |
| :--- | :--- |
| **Incident ID** | \`${incident.id}\` |
| **Affected Service** | \`${incident.service_name || "Unknown Service"}\` (\`${incident.service_type || "fleet"}\`) |
| **Severity Level** | **${String(incident.severity).toUpperCase()}** |
| **Lifecycle State** | **${String(incident.status).toUpperCase()}** |
| **First Detected (UTC)** | \`${new Date(startTime).toISOString()}\` |
| **Resolved At (UTC)** | \`${incident.resolved_at ? new Date(Number(incident.resolved_at)).toISOString() : "ACTIVE / IN-PROGRESS"}\` |
| **Duration (MTTR)** | **${mttrString}** |
| **Observability Sentinel** | Crystal Heimdall 2.0 // Crystal Studio Labs |

---

## 1. Executive Summary
On ${new Date(startTime).toUTCString()}, Crystal Heimdall automated telemetry sentinels detected a service disruption affecting **${incident.service_name || "Platform Fleet"}**.
The anomaly was triaged as **${String(incident.severity).toUpperCase()}** severity. The overall outage lifecycle spanned **${mttrString}**.

## 2. Chronological Timeline of Events
| Timestamp (UTC) | State | Event / Remediation Action |
| :--- | :--- | :--- |
${timelineRows}

## 3. Root Cause Analysis (RCA)
- **Observed Failure Condition**: ${incident.message || "Endpoint probe failed to return expected HTTP 2xx status or missed dead-man heartbeat schedule."}
- **Detection Mechanism**: Automated prober heartbeat probe cycle.
- **Impact Assessment**: Disruption confined to service \`${incident.service_name || incident.service_id}\`. Downstream resilience mechanisms contained cascading failure.

## 4. Preventative & Corrective Action Items
- [x] Automated circuit breaker tripped and logged to incident ledger.
- [ ] Review heartbeat probe timeouts and alert sensitivity thresholds.
- [ ] Add synthetic regression test canary to target CI/CD deployment pipeline.
- [ ] Update disaster recovery runbook and operator escalation matrices.

---
*Generated by Crystal Heimdall 2.0 Automated Incident Postmortem Engine*  
*Organization: Crystal Studio Labs (https://github.com/Crystal-Studio-Labs)*
`;

    if (req.query.format === "raw" || req.query.download === "1") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="postmortem-${incident.id}.md"`);
      return res.send(markdown);
    }

    return res.json({
      incidentId: incident.id,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      durationMs,
      durationMinutes,
      mttr: mttrString,
      postmortemMarkdown: markdown,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to generate postmortem report", details: err.message });
  }
});

// POST append an incident timeline update note
router.post("/:id/updates", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;
    const { status = "investigating", message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Update message is required" });
    }

    // Verify incident exists
    const incRes = await db.execute({
      sql: "SELECT * FROM incidents WHERE id = ?",
      args: [id],
    });
    if (incRes.rows.length === 0) {
      return res.status(404).json({ error: "Incident not found" });
    }

    const now = Date.now();
    const updateId = `upd-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const cleanStatus = ["investigating", "identified", "monitoring", "resolved"].includes(status)
      ? status
      : "investigating";

    await db.execute({
      sql: "INSERT INTO incident_updates (id, incident_id, status, message, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [updateId, id, cleanStatus, message.trim(), now],
    });

    // Update master incident status
    const masterStatus = cleanStatus === "resolved" ? "resolved" : "active";
    const resolvedAt: number | null = cleanStatus === "resolved" ? now : null;

    await db.execute({
      sql: "UPDATE incidents SET status = ?, resolved_at = ?, last_seen_at = ? WHERE id = ?",
      args: [masterStatus, resolvedAt, now, id],
    });

    return res.status(201).json({
      status: "created",
      update: {
        id: updateId,
        incident_id: id,
        status: cleanStatus,
        message: message.trim(),
        created_at: now,
      },
      incident_status: masterStatus,
    });
    broadcastStatusUpdate({ event: "incident_updated", incidentId: id, status: masterStatus });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to record incident update", details: err.message });
  }
});

// POST triage update with automated timeline note
router.post("/:id/ack", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;
    const { status = "acknowledged" } = req.body;
    const now = Date.now();
    const resolvedAt = status === "resolved" ? now : null;

    await db.execute({
      sql: "UPDATE incidents SET status = ?, resolved_at = ?, last_seen_at = ? WHERE id = ?",
      args: [status, resolvedAt, now, id],
    });

    // Record automated timeline event
    const updateId = `upd-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const updateMsg =
      status === "resolved"
        ? "Incident marked as resolved by operator."
        : status === "acknowledged"
        ? "Incident acknowledged by on-call operator; triage initiated."
        : `Incident status updated to ${status}.`;
    const updateStatus = status === "resolved" ? "resolved" : "identified";

    await db.execute({
      sql: "INSERT INTO incident_updates (id, incident_id, status, message, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [updateId, id, updateStatus, updateMsg, now],
    });

    broadcastStatusUpdate({ event: "incident_triaged", incidentId: id, newStatus: status });

    return res.json({ status: "updated", id, newStatus: status });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to triage incident", details: err.message });
  }
});

export default router;

