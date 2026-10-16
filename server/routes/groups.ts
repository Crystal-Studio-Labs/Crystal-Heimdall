import { Router, Request, Response } from "express";
import { getDb, initDb } from "../db.js";

const router = Router();

// GET all project and environment groups with active service telemetry metrics
router.get("/", async (_req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();

    const groupsRes = await db.execute("SELECT * FROM project_groups ORDER BY created_at ASC");
    const servicesRes = await db.execute("SELECT id, name, status, uptime_pct, latency_ms, group_name FROM services");

    const groups = groupsRes.rows as any[];
    const services = servicesRes.rows as any[];

    const enrichedGroups = groups.map((g) => {
      const gName = String(g.name || "").trim().toLowerCase();
      const gServices = services.filter((s) => {
        const sGroup = String(s.group_name || "").trim().toLowerCase();
        if (sGroup === gName) return true;
        if (!sGroup && gName === "production") return true;
        return false;
      });

      const healthyCount = gServices.filter((s) => s.status === "healthy").length;
      const warningCount = gServices.filter((s) => s.status === "warning").length;
      const criticalCount = gServices.filter((s) => s.status === "critical").length;
      const maintenanceCount = gServices.filter((s) => s.status === "maintenance").length;

      const avgUptime =
        gServices.length > 0
          ? Number((gServices.reduce((acc, s) => acc + (s.uptime_pct || 100), 0) / gServices.length).toFixed(2))
          : 100.0;

      const avgLatency =
        gServices.length > 0
          ? Math.round(gServices.reduce((acc, s) => acc + (s.latency_ms || 0), 0) / gServices.length)
          : 0;

      let status = "healthy";
      if (criticalCount > 0) status = "critical";
      else if (warningCount > 0) status = "warning";
      else if (maintenanceCount > 0 && maintenanceCount === gServices.length) status = "maintenance";

      return {
        id: g.id,
        name: g.name,
        environment: g.environment || "production",
        color: g.color || "#06b6d4",
        description: g.description || "",
        created_at: g.created_at,
        service_count: gServices.length,
        healthy_count: healthyCount,
        warning_count: warningCount,
        critical_count: criticalCount,
        maintenance_count: maintenanceCount,
        avg_uptime: avgUptime,
        avg_latency: avgLatency,
        status,
      };
    });

    res.json({
      status: "success",
      groups: enrichedGroups,
      total_groups: enrichedGroups.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch project groups" });
  }
});

// POST create a new dynamic project/environment group
router.post("/", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();

    const { name, environment = "production", color = "#06b6d4", description = "" } = req.body;

    const trimmedName = String(name || "").trim();
    if (!trimmedName) {
      return res.status(400).json({ error: "Group name is required." });
    }

    if (trimmedName.length > 60) {
      return res.status(400).json({ error: "Group name cannot exceed 60 characters." });
    }

    // Check uniqueness (case-insensitive)
    const existing = await db.execute({
      sql: "SELECT id FROM project_groups WHERE LOWER(name) = LOWER(?) LIMIT 1",
      args: [trimmedName],
    });

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: `A project group named '${trimmedName}' already exists.` });
    }

    const id = `grp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    await db.execute({
      sql: "INSERT INTO project_groups (id, name, environment, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [id, trimmedName, String(environment).toLowerCase(), String(color).trim(), String(description).trim(), now],
    });

    res.status(201).json({
      status: "success",
      group: {
        id,
        name: trimmedName,
        environment: String(environment).toLowerCase(),
        color: String(color).trim(),
        description: String(description).trim(),
        created_at: now,
        service_count: 0,
        avg_uptime: 100.0,
        status: "healthy",
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create project group" });
  }
});

// PUT update an existing project group (cascades name rename to all member services)
router.put("/:id", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;
    const { name, environment, color, description } = req.body;

    const existingRes = await db.execute({
      sql: "SELECT * FROM project_groups WHERE id = ? LIMIT 1",
      args: [id],
    });

    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Project group not found." });
    }

    const current = existingRes.rows[0] as any;
    const newName = name !== undefined ? String(name).trim() : current.name;
    const newEnv = environment !== undefined ? String(environment).toLowerCase().trim() : current.environment;
    const newColor = color !== undefined ? String(color).trim() : current.color;
    const newDesc = description !== undefined ? String(description).trim() : current.description;

    if (!newName) {
      return res.status(400).json({ error: "Group name cannot be blank." });
    }

    // If name is changing, check uniqueness against other groups
    if (newName.toLowerCase() !== current.name.toLowerCase()) {
      const dupCheck = await db.execute({
        sql: "SELECT id FROM project_groups WHERE LOWER(name) = LOWER(?) AND id != ? LIMIT 1",
        args: [newName, id],
      });
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: `A project group named '${newName}' already exists.` });
      }

      // Cascade rename across all services tagged with the old group name
      await db.execute({
        sql: "UPDATE services SET group_name = ? WHERE LOWER(group_name) = LOWER(?)",
        args: [newName, current.name],
      });
    }

    await db.execute({
      sql: "UPDATE project_groups SET name = ?, environment = ?, color = ?, description = ? WHERE id = ?",
      args: [newName, newEnv, newColor, newDesc, id],
    });

    res.json({
      status: "success",
      group: {
        id,
        name: newName,
        environment: newEnv,
        color: newColor,
        description: newDesc,
        created_at: current.created_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update project group" });
  }
});

// DELETE a project group and reassign member services to 'Production'
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await initDb();
    const db = getDb();
    const { id } = req.params;

    const existingRes = await db.execute({
      sql: "SELECT * FROM project_groups WHERE id = ? LIMIT 1",
      args: [id],
    });

    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Project group not found." });
    }

    const current = existingRes.rows[0] as any;

    // Prevent deleting "Production" if it is the root system default
    if (current.name.toLowerCase() === "production") {
      const totalGroups = await db.execute("SELECT count(*) as count FROM project_groups");
      if (Number(totalGroups.rows[0]?.count || 0) <= 1) {
        return res.status(400).json({ error: "Cannot delete the sole default 'Production' group." });
      }
    }

    // Reassign all associated services to 'Production'
    await db.execute({
      sql: "UPDATE services SET group_name = 'Production' WHERE LOWER(group_name) = LOWER(?)",
      args: [current.name],
    });

    // Delete group
    await db.execute({
      sql: "DELETE FROM project_groups WHERE id = ?",
      args: [id],
    });

    res.json({
      status: "success",
      message: `Project group '${current.name}' deleted. Associated services reassigned to 'Production'.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete project group" });
  }
});

export default router;
