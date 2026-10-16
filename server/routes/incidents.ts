import { Router, Request, Response } from "express";
import { getDb, initDb } from "../db.js";

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

    return res.json({ status: "updated", id, newStatus: status });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to triage incident", details: err.message });
  }
});

export default router;

