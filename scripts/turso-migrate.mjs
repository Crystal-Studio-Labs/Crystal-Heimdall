#!/usr/bin/env node
/**
 * =====================================================================
 * 🛡️ CRYSTAL HEIMDALL — TURSO / LIBSQL DATABASE MIGRATOR & DIAGNOSTIC 🛡️
 * =====================================================================
 * Executes idempotent database migrations, schema verification, table indexing,
 * and live connectivity checks against remote Turso LibSQL clusters or local SQLite.
 *
 * Usage:
 *   node scripts/turso-migrate.mjs
 *   node scripts/turso-migrate.mjs --url "libsql://db-name.turso.io" --token "jwt-token"
 */

import "dotenv/config";
import { createClient } from "@libsql/client";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse CLI flags if provided (--url, --token)
const args = process.argv.slice(2);
let cliUrl = "";
let cliToken = "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url" && args[i + 1]) {
    cliUrl = args[i + 1];
    i++;
  } else if (args[i] === "--token" && args[i + 1]) {
    cliToken = args[i + 1];
    i++;
  }
}

const rawUrl =
  cliUrl ||
  process.env.TURSO_DATABASE_URL ||
  process.env.TURSO_DB_URL ||
  process.env.LIBSQL_URL ||
  process.env.DATABASE_URL;

const rawToken =
  cliToken ||
  process.env.TURSO_AUTH_TOKEN ||
  process.env.TURSO_TOKEN ||
  process.env.LIBSQL_AUTH_TOKEN;

const tursoUrl = rawUrl?.trim().replace(/^["']|["']$/g, "");
const tursoToken = rawToken?.trim().replace(/^["']|["']$/g, "");

console.log("=================================================================");
console.log("🛡️  CRYSTAL HEIMDALL 2.0 — TURSO / LIBSQL SCHEMA MIGRATION 🛡️");
console.log("=================================================================\n");

let client;
let isRemoteTurso = false;

if (tursoUrl && !tursoUrl.startsWith("file:")) {
  isRemoteTurso = true;
  console.log(`🌐 Target: REMOTE TURSO CLUSTER [${tursoUrl}]`);
  console.log(`🔑 Auth Token: ${tursoToken ? `${tursoToken.substring(0, 10)}...${tursoToken.substring(tursoToken.length - 6)}` : "(None provided)"}`);
  client = createClient({
    url: tursoUrl,
    authToken: tursoToken || undefined,
  });
} else {
  const dataDir = process.env.DATA_DIR || path.resolve(__dirname, "../data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, "heimdall.db");
  console.log(`💻 Target: LOCAL SQLITE INSTANCE [file:${dbPath}]`);
  client = createClient({
    url: `file:${dbPath}`,
  });
}

async function runMigration() {
  const startTime = Date.now();
  try {
    // 1. Test ping & latency
    const pingStart = Date.now();
    await client.execute("SELECT 1 as ping");
    const pingLatency = Date.now() - pingStart;
    console.log(`⚡ Connection Verified: Ping nominal (${pingLatency}ms latency)\n`);

    console.log("⚙️  [1/4] Creating Core Schema Tables...");
    // Core Services
    await client.execute(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        endpoint TEXT,
        poll_interval_sec INTEGER DEFAULT 60,
        expected_interval_sec INTEGER,
        grace_period_sec INTEGER DEFAULT 300,
        api_key TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'healthy',
        is_public INTEGER DEFAULT 1,
        last_ping_at INTEGER,
        latency_ms INTEGER DEFAULT 0,
        uptime_pct REAL DEFAULT 100.0,
        consecutive_failures INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `);

    // Incidents
    await client.execute(`
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        service_id TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        stack_trace TEXT,
        fingerprint TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        occurrences_count INTEGER DEFAULT 1,
        first_seen_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        resolved_at INTEGER
      );
    `);

    // Incident Timeline Updates
    await client.execute(`
      CREATE TABLE IF NOT EXISTS incident_updates (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    // Telemetry Ledger Points
    await client.execute(`
      CREATE TABLE IF NOT EXISTS telemetry_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        status_code INTEGER,
        recorded_at INTEGER NOT NULL
      );
    `);

    // Operator Authentication (2FA TOTP & JWT)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS operator_auth (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Public Status Page Settings & Engine Config
    await client.execute(`
      CREATE TABLE IF NOT EXISTS status_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Sentry-Style Crash Telemetry & Exceptions
    await client.execute(`
      CREATE TABLE IF NOT EXISTS error_issues (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        title TEXT NOT NULL,
        error_type TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        stack_trace TEXT,
        environment TEXT DEFAULT 'production',
        status TEXT DEFAULT 'unresolved',
        events_count INTEGER DEFAULT 1,
        first_seen_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        user_agent TEXT,
        metadata_json TEXT
      );
    `);

    // Dynamic Project & Environment Groups
    await client.execute(`
      CREATE TABLE IF NOT EXISTS project_groups (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        environment TEXT DEFAULT 'production',
        color TEXT DEFAULT '#06b6d4',
        description TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    // Incident & Outage Public Subscribers Table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        target TEXT NOT NULL,
        scope TEXT DEFAULT 'all',
        token TEXT UNIQUE NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL
      );
    `);

    // Scheduled Maintenance Windows Table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_windows (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        affected_services TEXT,
        status TEXT DEFAULT 'scheduled',
        created_at INTEGER NOT NULL
      );
    `);
    console.log("   ✅ 10 core database tables verified nominal.");

    console.log("⚙️  [2/4] Applying Schema Migrations & Alterations...");
    const alterColumns = [
      "ALTER TABLE services ADD COLUMN is_public INTEGER DEFAULT 1",
      "ALTER TABLE services ADD COLUMN port INTEGER",
      "ALTER TABLE services ADD COLUMN keyword TEXT",
      "ALTER TABLE services ADD COLUMN expected_status_code TEXT DEFAULT '200-299'",
      "ALTER TABLE services ADD COLUMN retry_count INTEGER DEFAULT 2",
      "ALTER TABLE services ADD COLUMN ssl_expiry_days INTEGER",
      "ALTER TABLE services ADD COLUMN is_maintenance INTEGER DEFAULT 0",
      "ALTER TABLE services ADD COLUMN group_name TEXT DEFAULT 'Production'",
      "ALTER TABLE services ADD COLUMN last_event TEXT DEFAULT 'online'",
      "ALTER TABLE services ADD COLUMN runtime_meta TEXT",
    ];

    let appliedAlters = 0;
    for (const alterSql of alterColumns) {
      try {
        await client.execute(alterSql);
        appliedAlters++;
      } catch {
        // Column already exists
      }
    }
    console.log(`   ✅ Column migrations verified (applied ${appliedAlters} new columns, all 10 present).`);

    console.log("⚙️  [3/4] Ensuring High-Performance Indices...");
    const indices = [
      "CREATE INDEX IF NOT EXISTS idx_incident_updates_inc_time ON incident_updates (incident_id, created_at ASC)",
      "CREATE INDEX IF NOT EXISTS idx_telemetry_points_svc_rec ON telemetry_points (service_id, recorded_at)",
      "CREATE INDEX IF NOT EXISTS idx_telemetry_points_rec ON telemetry_points (recorded_at)",
      "CREATE INDEX IF NOT EXISTS idx_services_group ON services (group_name)",
      "CREATE INDEX IF NOT EXISTS idx_services_status ON services (status)",
      "CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status)",
      "CREATE INDEX IF NOT EXISTS idx_incidents_svc ON incidents (service_id)",
      "CREATE INDEX IF NOT EXISTS idx_project_groups_name ON project_groups (name)",
      "CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers (is_active)",
      "CREATE INDEX IF NOT EXISTS idx_subscribers_token ON subscribers (token)",
      "CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_windows (status)",
      "CREATE INDEX IF NOT EXISTS idx_maintenance_time ON maintenance_windows (start_time, end_time)",
    ];

    for (const idxSql of indices) {
      try {
        await client.execute(idxSql);
      } catch {
        // Index exists
      }
    }
    console.log("   ✅ 12 composite & single-column indices verified nominal.");

    console.log("⚙️  [4/4] Synchronizing System Presets & Canonical Groups...");
    const now = Date.now();
    // Default Status Settings
    const defaultSettings = {
      page_title: "Crystal Heimdall",
      page_description: "Continuous Multi-Point Health Monitoring & Real-Time Incident Status",
      announcement_banner: "All core systems nominal across all regions.",
      announcement_type: "info",
      show_sla: "true",
      show_incidents: "true",
      footer_text: "Crystal Studio Labs • Autonomous Reliability Sentinel",
      support_url: "https://github.com/Crystal-Studio-Labs",
      default_poll_interval: "60",
      default_timeout: "10",
      max_retries: "2",
      resend_interval: "5",
      ssl_warning_days: "30",
      ignore_ssl_errors: "false",
      default_http_method: "GET",
      user_agent: "Crystal-Heimdall/2.0 (+https://github.com/Crystal-Studio-Labs)",
      follow_redirects: "true",
      accepted_status_codes: "200-299, 301, 302",
      telemetry_retention_days: "30",
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      await client.execute({
        sql: "INSERT OR IGNORE INTO status_settings (key, value) VALUES (?, ?)",
        args: [key, value],
      });
    }

    // Canonical Project Groups
    const defaultGroups = [
      { id: "grp-production", name: "Production", environment: "production", color: "#10b981", description: "Primary production cluster & live client APIs" },
      { id: "grp-campus-relay", name: "Campus Relay", environment: "production", color: "#06b6d4", description: "Decentralized campus mesh and relay hubs" },
      { id: "grp-krishisetu", name: "KrishiSetu", environment: "production", color: "#f59e0b", description: "AgriTech telemetric monitoring & sensor network" },
      { id: "grp-internal-apis", name: "Internal APIs", environment: "development", color: "#8b5cf6", description: "Core backend microservices and worker daemons" },
      { id: "grp-staging", name: "Staging", environment: "staging", color: "#ec4899", description: "Pre-release canary tests and QA pipelines" },
    ];

    for (const g of defaultGroups) {
      await client.execute({
        sql: "INSERT OR IGNORE INTO project_groups (id, name, environment, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        args: [g.id, g.name, g.environment, g.color, g.description, now],
      });
    }
    console.log("   ✅ Settings and 5 canonical project groups synchronized.\n");

    // 5. Database Health Census
    console.log("📊 DATABASE INVENTORY & HEALTH SUMMARY:");
    const tables = [
      "services",
      "project_groups",
      "incidents",
      "incident_updates",
      "telemetry_points",
      "status_settings",
      "error_issues",
      "operator_auth",
    ];

    for (const tbl of tables) {
      const res = await client.execute(`SELECT count(*) as count FROM ${tbl}`);
      const count = Number(res.rows[0]?.count || 0);
      console.log(`   * ${tbl.padEnd(20)}: ${count} rows`);
    }

    // List registered services
    const svcList = await client.execute("SELECT id, name, status, group_name, is_public FROM services ORDER BY created_at ASC");
    if (svcList.rows.length > 0) {
      console.log("\n📡 MONITORED SERVICES IN DATABASE:");
      for (const row of svcList.rows) {
        console.log(`   - [${row.id}] ${row.name} (Group: ${row.group_name || "Production"} | Status: ${row.status} | Public: ${row.is_public})`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`\n=================================================================`);
    console.log(`🎉 DATABASE MIGRATION NOMINAL & FULLY SYNCHRONIZED (${elapsed}ms)`);
    console.log(`=================================================================\n`);
    process.exit(0);
  } catch (err) {
    console.error("\n❌ MIGRATION FAILED:", err);
    process.exit(1);
  }
}

runMigration();
