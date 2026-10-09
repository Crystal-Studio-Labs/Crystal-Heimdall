import app, { initDb } from "../dist-server/app.js";

/**
 * Vercel Serverless Function Entrypoint
 * Handles API routing, cron polls, and database cold starts.
 */
export default async function handler(req, res) {
  try {
    await initDb();
  } catch (err) {
    console.error("[Vercel] DB Initialization warning:", err);
  }
  return app(req, res);
}
