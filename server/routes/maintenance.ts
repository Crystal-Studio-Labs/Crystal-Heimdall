import { Router, Request, Response } from "express";
import { getDb, initDb } from "../db.js";
import { isOperatorReq } from "./auth.js";

const router = Router();

// Helper to format ISO date to RFC 5545 iCalendar format: YYYYMMDDTHHmmssZ
function formatIcsDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// 1. GET /api/v1/maintenance - Public Listing of Active & Upcoming Windows
router.get("/", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const includePast = req.query.includePast === "true";

    const result = await db.execute("SELECT * FROM maintenance_windows ORDER BY start_time ASC");
    const now = Date.now();
    const rows = result.rows as any[];

    const parsed = rows.map((r) => {
      let services: string[] = [];
      try {
        services = r.affected_services ? JSON.parse(r.affected_services) : [];
      } catch {
        services = [];
      }

      // Dynamic status resolution based on wall-clock time
      let computedStatus = r.status;
      if (r.status !== "completed") {
        if (now >= Number(r.start_time) && now <= Number(r.end_time)) {
          computedStatus = "in_progress";
        } else if (now > Number(r.end_time)) {
          computedStatus = "completed";
        } else {
          computedStatus = "scheduled";
        }
      }

      return {
        id: r.id,
        title: r.title,
        description: r.description || "",
        startTime: Number(r.start_time),
        endTime: Number(r.end_time),
        affectedServices: services,
        status: computedStatus,
        createdAt: Number(r.created_at),
      };
    });

    const active = parsed.filter((m) => m.status === "in_progress");
    const upcoming = parsed.filter((m) => m.status === "scheduled" && m.startTime > now);
    const past = parsed.filter((m) => m.status === "completed" || m.endTime < now);

    res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=45");
    return res.json({
      active,
      upcoming,
      past: includePast ? past : past.slice(0, 5),
      totalActive: active.length,
      totalUpcoming: upcoming.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch maintenance windows", details: err.message });
  }
});

// 2. POST /api/v1/maintenance - Operator Create Window
router.post("/", async (req: Request, res: Response) => {
  try {
    if (!isOperatorReq(req)) {
      return res.status(401).json({ error: "Operator authentication required." });
    }

    await initDb();
    const db = getDb();
    const { title, description = "", startTime, endTime, affectedServices = [], status = "scheduled" } = req.body;

    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) {
      return res.status(400).json({ error: "Maintenance window title is required." });
    }

    const start = Number(startTime);
    const end = Number(endTime);
    if (!start || !end || isNaN(start) || isNaN(end) || end <= start) {
      return res.status(400).json({ error: "Valid start and end timestamps (where end > start) are required." });
    }

    const validStatus = ["scheduled", "in_progress", "completed"].includes(status) ? status : "scheduled";
    const servicesJson = JSON.stringify(Array.isArray(affectedServices) ? affectedServices : []);

    const id = `maint-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    await db.execute({
      sql: `INSERT INTO maintenance_windows (id, title, description, start_time, end_time, affected_services, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, cleanTitle, String(description).trim(), start, end, servicesJson, validStatus, now],
    });

    return res.status(201).json({
      status: "created",
      maintenance: {
        id,
        title: cleanTitle,
        description: String(description).trim(),
        startTime: start,
        endTime: end,
        affectedServices: Array.isArray(affectedServices) ? affectedServices : [],
        status: validStatus,
        createdAt: now,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to create maintenance window", details: err.message });
  }
});

// 3. PATCH /api/v1/maintenance/:id - Operator Update Window
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    if (!isOperatorReq(req)) {
      return res.status(401).json({ error: "Operator authentication required." });
    }

    await initDb();
    const db = getDb();
    const { id } = req.params;
    const { title, description, startTime, endTime, affectedServices, status } = req.body;

    const curRes = await db.execute({
      sql: "SELECT * FROM maintenance_windows WHERE id = ? LIMIT 1",
      args: [id],
    });

    if (curRes.rows.length === 0) {
      return res.status(404).json({ error: "Maintenance window not found." });
    }

    const current = curRes.rows[0] as any;
    const newTitle = title !== undefined ? String(title).trim() : current.title;
    const newDesc = description !== undefined ? String(description).trim() : current.description;
    const newStart = startTime !== undefined ? Number(startTime) : Number(current.start_time);
    const newEnd = endTime !== undefined ? Number(endTime) : Number(current.end_time);
    const newStatus = status !== undefined && ["scheduled", "in_progress", "completed"].includes(status)
      ? status
      : current.status;
    const newServices = affectedServices !== undefined
      ? JSON.stringify(Array.isArray(affectedServices) ? affectedServices : [])
      : current.affected_services;

    await db.execute({
      sql: `UPDATE maintenance_windows 
            SET title = ?, description = ?, start_time = ?, end_time = ?, affected_services = ?, status = ?
            WHERE id = ?`,
      args: [newTitle, newDesc, newStart, newEnd, newServices, newStatus, id],
    });

    return res.json({
      status: "updated",
      maintenance: {
        id,
        title: newTitle,
        description: newDesc,
        startTime: newStart,
        endTime: newEnd,
        affectedServices: JSON.parse(newServices || "[]"),
        status: newStatus,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update maintenance window", details: err.message });
  }
});

// 4. DELETE /api/v1/maintenance/:id - Operator Delete Window
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    if (!isOperatorReq(req)) {
      return res.status(401).json({ error: "Operator authentication required." });
    }

    await initDb();
    const db = getDb();
    const { id } = req.params;

    const delRes = await db.execute({
      sql: "DELETE FROM maintenance_windows WHERE id = ?",
      args: [id],
    });

    if (delRes.rowsAffected === 0) {
      return res.status(404).json({ error: "Maintenance window not found." });
    }

    return res.json({
      status: "deleted",
      message: "Maintenance window successfully removed.",
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete maintenance window", details: err.message });
  }
});

// 5. GET /api/v1/maintenance/:id/ics - Export RFC 5545 iCalendar (.ics) File
router.get("/:id/ics", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;

    const resWin = await db.execute({
      sql: "SELECT * FROM maintenance_windows WHERE id = ? LIMIT 1",
      args: [id],
    });

    if (resWin.rows.length === 0) {
      return res.status(404).send("Maintenance window not found.");
    }

    const win = resWin.rows[0] as any;
    const startIcs = formatIcsDate(Number(win.start_time));
    const endIcs = formatIcsDate(Number(win.end_time));
    const stampIcs = formatIcsDate(Number(win.created_at || Date.now()));
    const summary = (win.title || "Scheduled Maintenance").replace(/\r?\n/g, " ");
    const description = (win.description || "Scheduled infrastructure maintenance by Crystal Studio Labs.")
      .replace(/\r?\n/g, "\\n");

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Crystal Studio Labs//Crystal Heimdall 2.0//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${win.id}@crystal-heimdall.crystal-studio-labs`,
      `DTSTAMP:${stampIcs}`,
      `DTSTART:${startIcs}`,
      `DTEND:${endIcs}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      "ORGANIZER;CN=Crystal Studio Labs Sentinel:mailto:alerts@crystalstudiolabs.org",
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="maintenance-${win.id}.ics"`);
    return res.send(icsContent);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to generate iCalendar file", details: err.message });
  }
});

// Helper for Background Poller: Checks if a target is covered by active maintenance window
export async function isTargetInMaintenance(targetId: string, targetName?: string): Promise<boolean> {
  try {
    const db = getDb();
    const now = Date.now();
    const res = await db.execute({
      sql: `SELECT affected_services FROM maintenance_windows 
            WHERE (status = 'in_progress' OR (status = 'scheduled' AND start_time <= ? AND end_time >= ?))`,
      args: [now, now],
    });

    if (res.rows.length === 0) return false;

    for (const row of res.rows as any[]) {
      try {
        const services: string[] = row.affected_services ? JSON.parse(row.affected_services) : [];
        if (services.length === 0) return true; // All services covered
        if (services.includes(targetId)) return true;
        if (targetName && services.includes(targetName)) return true;
      } catch {
        // Continue
      }
    }
    return false;
  } catch {
    return false;
  }
}

export default router;
