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

// POST triage update
router.post("/:id/ack", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;
    const { status = "acknowledged" } = req.body;
    const now = Date.now();
    const resolvedAt = status === "resolved" ? now : null;

    await db.execute({
      sql: "UPDATE incidents SET status = ?, resolved_at = ? WHERE id = ?",
      args: [status, resolvedAt, id],
    });

    return res.json({ status: "updated", id, newStatus: status });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to triage incident", details: err.message });
  }
});

export default router;
