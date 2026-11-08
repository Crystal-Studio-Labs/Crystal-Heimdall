import "web-push";
import app, { initDb } from "../dist-server/app.js";

let dbInitialized = false;
let dbError = null;

async function ensureDb() {
  if (dbInitialized) return;
  try {
    await initDb();
    dbInitialized = true;
    dbError = null;
  } catch (err) {
    dbError = err;
    console.error("[Vercel] DB Initialization warning:", err);
  }
}

/**
 * Vercel Serverless Function Entrypoint
 * Handles API routing, cron polls, and database cold starts with recovery.
 */
export default async function handler(req, res) {
  try {
    await ensureDb();

    // Fast diagnostic endpoint to verify serverless runtime health
    const url = req.url || "";
    if (url === "/api/health/debug" || url === "/api/v1/health/debug") {
      return res.status(200).json({
        status: "ok",
        sentinel: "Crystal Heimdall",
        organization: "Crystal Studio Labs",
        dbInitialized,
        dbError: dbError ? { message: dbError.message, stack: dbError.stack } : null,
        env: {
          NODE_ENV: process.env.NODE_ENV,
          VERCEL: process.env.VERCEL,
          VERCEL_ENV: process.env.VERCEL_ENV,
          HAS_TURSO: Boolean(process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL),
        },
        timestamp: new Date().toISOString(),
      });
    }

    return app(req, res);
  } catch (err) {
    console.error("[Vercel Handler Crash]", err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: "SERVERLESS_FUNCTION_CRASH",
        message: err?.message || String(err),
        stack: err?.stack,
      });
    }
  }
}
