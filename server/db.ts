import { createClient, Client } from "@libsql/client";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let clientInstance: Client | null = null;
let isInitialized = false;

export function getDb(): Client {
  if (!clientInstance) {
    const rawUrl =
      process.env.TURSO_DATABASE_URL ||
      process.env.TURSO_DB_URL ||
      process.env.LIBSQL_URL ||
      process.env.DATABASE_URL;
    const rawToken =
      process.env.TURSO_AUTH_TOKEN ||
      process.env.TURSO_TOKEN ||
      process.env.LIBSQL_AUTH_TOKEN;

    const tursoUrl = rawUrl?.trim().replace(/^["']|["']$/g, "");
    const tursoToken = rawToken?.trim().replace(/^["']|["']$/g, "");

    if (tursoUrl) {
      clientInstance = createClient({
        url: tursoUrl,
        authToken: tursoToken || undefined,
      });
    } else {
      const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
      const defaultDataDir = isServerless ? "/tmp/heimdall-data" : path.resolve(__dirname, "../../data");
      const dataDir = process.env.DATA_DIR || defaultDataDir;
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const dbPath = path.join(dataDir, "heimdall.db");
      clientInstance = createClient({
        url: `file:${dbPath}`,
      });
    }
  }

  return clientInstance;
}

export async function initDb(): Promise<void> {
  if (isInitialized) return;
  const db = getDb();

  // Create tables
  await db.execute(`
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

  await db.execute(`
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS incident_updates (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_incident_updates_inc_time ON incident_updates (incident_id, created_at ASC);
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS telemetry_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      status_code INTEGER,
      recorded_at INTEGER NOT NULL
    );
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_telemetry_points_svc_rec ON telemetry_points (service_id, recorded_at);
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_telemetry_points_rec ON telemetry_points (recorded_at);
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS operator_auth (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS status_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Sentry-Style Crash Telemetry & Exception Table
  await db.execute(`
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

  // Project & Environment Groups Table (User-Managed Dynamic Groups)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS project_groups (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      environment TEXT DEFAULT 'production',
      color TEXT DEFAULT '#06b6d4',
      description TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // Migrations: Ensure additional columns exist on services for Uptime Kuma/Robot features
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

  for (const alterSql of alterColumns) {
    try {
      await db.execute(alterSql);
    } catch {
      // Column already exists
    }
  }

  // Seed mock error issues for Sentry crash tracker if empty
  const errorCountRes = await db.execute("SELECT count(*) as count FROM error_issues");
  if (Number(errorCountRes.rows[0]?.count || 0) === 0) {
    const now = Date.now();
    await db.execute({
      sql: `INSERT INTO error_issues (id, project, title, error_type, level, message, stack_trace, environment, status, events_count, first_seen_at, last_seen_at, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'production', 'unresolved', 14, ?, ?, ?)`,
      args: [
        "err-jwt-expire",
        "Crystal Auth Gateway",
        "JWTVerificationError: Signing key rotation timed out",
        "JWTVerificationError",
        "fatal",
        "Asymmetric key retrieval timed out after 3000ms while authenticating operator session",
        `JWTVerificationError: Signing key rotation timed out
    at JWKSClient.getSigningKey (auth-gateway/src/jwks.ts:88:17)
    at async verifyToken (auth-gateway/src/middleware.ts:42:21)
    at async Router.handle (express/lib/router.js:144:5)`,
        now - 3600000,
        now - 120000,
        JSON.stringify({ release: "v2.4.1", route: "/api/v1/auth/session", runtime: "Node.js v24" }),
      ],
    });

    await db.execute({
      sql: `INSERT INTO error_issues (id, project, title, error_type, level, message, stack_trace, environment, status, events_count, first_seen_at, last_seen_at, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'production', 'unresolved', 6, ?, ?, ?)`,
      args: [
        "err-db-timeout",
        "Crystal Studio Labs API",
        "DatabasePoolExhaustion: Connection pool saturation",
        "DatabasePoolExhaustion",
        "error",
        "Active connection pool reached 50/50 ceiling during burst telemetry ingest",
        `DatabasePoolExhaustion: Connection pool saturation
    at Pool.acquire (db/pool.ts:114:13)
    at async queryRunner (db/runner.ts:52:9)
    at async handleIngest (routes/telemetry.ts:28:15)`,
        now - 7200000,
        now - 600000,
        JSON.stringify({ poolSize: 50, activeQueries: 50, endpoint: "/telemetry/push" }),
      ],
    });
  }

  // Seed default demo services if empty
  const countRes = await db.execute("SELECT count(*) as count FROM services");
  const count = Number(countRes.rows[0]?.count || 0);

  if (count === 0) {
    const now = Date.now();
    await db.execute({
      sql: `INSERT INTO services (id, name, type, endpoint, poll_interval_sec, grace_period_sec, api_key, status, is_public, last_ping_at, latency_ms, uptime_pct, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      args: [
        "srv-auth",
        "Crystal Auth Gateway",
        "http-poll",
        "https://httpbin.org/status/200",
        60,
        300,
        "key_live_heimdall_auth_8f92a",
        "healthy",
        now - 12000,
        32,
        99.98,
        now - 86400000,
      ],
    });

    await db.execute({
      sql: `INSERT INTO services (id, name, type, endpoint, poll_interval_sec, grace_period_sec, api_key, status, is_public, last_ping_at, latency_ms, uptime_pct, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      args: [
        "srv-api",
        "Crystal Studio Labs API",
        "http-poll",
        "https://httpbin.org/delay/1",
        60,
        300,
        "key_live_heimdall_gw_1b44c",
        "healthy",
        now - 25000,
        140,
        99.45,
        now - 86400000,
      ],
    });

    await db.execute({
      sql: `INSERT INTO services (id, name, type, expected_interval_sec, grace_period_sec, api_key, status, is_public, last_ping_at, latency_ms, uptime_pct, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      args: [
        "srv-cron-backup",
        "Internal Nightly Backup Cron",
        "deadman-cron",
        86400,
        3600,
        "key_live_heimdall_cron_db_93a1",
        "healthy",
        now - 14400000,
        0,
        100.0,
        now - 86400000,
      ],
    });

    // Seed mock telemetry points for analytics charts
    for (let h = 24; h >= 0; h--) {
      const recTime = now - h * 3600 * 1000;
      const baseLat = 35 + Math.floor(Math.random() * 25);
      await db.execute({
        sql: "INSERT INTO telemetry_points (service_id, latency_ms, status_code, recorded_at) VALUES (?, ?, ?, ?)",
        args: ["srv-auth", baseLat, 200, recTime],
      });
      await db.execute({
        sql: "INSERT INTO telemetry_points (service_id, latency_ms, status_code, recorded_at) VALUES (?, ?, ?, ?)",
        args: ["srv-api", baseLat + 40 + Math.floor(Math.random() * 60), 200, recTime],
      });
    }
  }

  // Seed default status settings if not set
  const defaultSettings: Record<string, string> = {
    page_title: "Crystal Heimdall",
    page_description: "Continuous Multi-Point Health Monitoring & Real-Time Incident Status",
    announcement_banner: "All core systems nominal across all regions.",
    announcement_type: "info",
    show_sla: "true",
    show_incidents: "true",
    footer_text: "Crystal Studio Labs • Autonomous Reliability Sentinel",
    support_url: "https://github.com/Crystal-Studio-Labs",
    // Uptime Kuma Advanced Engine Settings
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
    await db.execute({
      sql: "INSERT OR IGNORE INTO status_settings (key, value) VALUES (?, ?)",
      args: [key, value],
    });
  }

  // Ensure page title is updated to Crystal Heimdall
  await db.execute({
    sql: "UPDATE status_settings SET value = 'Crystal Heimdall' WHERE key = 'page_title'",
    args: [],
  });

  // Backfill initial investigating updates for any incidents missing timeline records
  try {
    const unlinkedIncidents = await db.execute(`
      SELECT i.id, i.title, i.first_seen_at 
      FROM incidents i 
      WHERE i.id NOT IN (SELECT DISTINCT incident_id FROM incident_updates)
    `);
    for (const row of unlinkedIncidents.rows as any[]) {
      await db.execute({
        sql: "INSERT INTO incident_updates (id, incident_id, status, message, created_at) VALUES (?, ?, 'investigating', ?, ?)",
        args: [
          `upd-${Math.random().toString(36).substring(2, 9)}`,
          row.id,
          `Initial anomaly recorded: ${row.title || "Disruption logged to sentinel ledger."}`,
          row.first_seen_at || Date.now(),
        ],
      });
    }
  } catch {
    // Ignore migration error if table empty
  }

  // Backfill and seed project_groups from existing services & defaults
  try {
    const existingDistinctGroups = await db.execute("SELECT DISTINCT group_name FROM services WHERE group_name IS NOT NULL");
    const now = Date.now();
    for (const row of existingDistinctGroups.rows as any[]) {
      const gName = String(row.group_name || "").trim();
      if (gName) {
        const slug = "grp-" + gName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        await db.execute({
          sql: "INSERT OR IGNORE INTO project_groups (id, name, environment, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          args: [
            slug,
            gName,
            gName.toLowerCase().includes("stag") ? "staging" : gName.toLowerCase().includes("dev") ? "development" : "production",
            gName === "Production" ? "#10b981" : gName === "Campus Relay" ? "#06b6d4" : gName === "KrishiSetu" ? "#f59e0b" : "#8b5cf6",
            `Project group for ${gName}`,
            now,
          ],
        });
      }
    }

    const defaults = [
      { id: "grp-production", name: "Production", environment: "production", color: "#10b981", description: "Primary production cluster & live client APIs" },
      { id: "grp-campus-relay", name: "Campus Relay", environment: "production", color: "#06b6d4", description: "Decentralized campus mesh and relay hubs" },
      { id: "grp-krishisetu", name: "KrishiSetu", environment: "production", color: "#f59e0b", description: "AgriTech telemetric monitoring & sensor network" },
      { id: "grp-internal-apis", name: "Internal APIs", environment: "development", color: "#8b5cf6", description: "Core backend microservices and worker daemons" },
      { id: "grp-staging", name: "Staging", environment: "staging", color: "#ec4899", description: "Pre-release canary tests and QA pipelines" },
    ];
    for (const def of defaults) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO project_groups (id, name, environment, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        args: [def.id, def.name, def.environment, def.color, def.description, now],
      });
    }
  } catch {
    // Ignore migration error
  }

  isInitialized = true;
}

