import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import qrcode from "qrcode";
import { getDb, initDb } from "../db.js";
import { createRateLimiter } from "../rateLimiter.js";

const router = Router();
export const JWT_SECRET = process.env.JWT_SECRET || "crystal_heimdall_super_secret_jwt_key_2026";

export function isOperatorReq(req: Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

// Rate Limiter: Max 5 attempts per minute per IP to prevent TOTP brute forcing
const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many authentication attempts. Please wait 60 seconds before trying again.",
});

// Allow ±1 time-step window (±30s) to handle mobile device clock skew & network latency
authenticator.options = { window: 1 };

// Check if 2FA has been permanently paired/locked
export async function is2FaLocked(): Promise<boolean> {
  // If TOTP_SECRET is provisioned via environment variable, it is locked
  if (process.env.TOTP_SECRET && process.env.TOTP_SECRET.trim().length > 0) {
    return true;
  }
  const db = getDb();
  const res = await db.execute("SELECT value FROM operator_auth WHERE key = 'totp_paired'");
  return res.rows.length > 0 && String(res.rows[0].value) === "1";
}

// Get or initialize TOTP secret
export async function getTotpSecret(): Promise<string> {
  // 1. Environment variable override (highest priority, locked)
  if (process.env.TOTP_SECRET && process.env.TOTP_SECRET.trim().length > 0) {
    return process.env.TOTP_SECRET.trim();
  }

  const db = getDb();
  const res = await db.execute("SELECT value FROM operator_auth WHERE key = 'totp_secret'");
  if (res.rows.length > 0 && res.rows[0].value) {
    return String(res.rows[0].value);
  }

  // Generate new secret for initial setup
  const newSecret = authenticator.generateSecret();
  await db.execute({
    sql: "INSERT OR REPLACE INTO operator_auth (key, value) VALUES ('totp_secret', ?)",
    args: [newSecret],
  });
  return newSecret;
}

// 0. Public 2FA Lock Status Endpoint
router.get("/status", async (_req: Request, res: Response) => {
  try {
    await initDb();
    const locked = await is2FaLocked();
    return res.json({ isLocked: locked });
  } catch {
    return res.json({ isLocked: true });
  }
});

// 1. Direct 2FA-Only Login (Zero master passcode, Zero OAuth)
router.post("/login", authRateLimiter, async (req: Request, res: Response) => {
  try {
    await initDb();
    const { code, totpCode } = req.body;
    const finalCode = String(code || totpCode || "").trim();

    if (!finalCode) {
      return res.status(400).json({ error: "6-digit 2FA authenticator code is required." });
    }

    const secret = await getTotpSecret();
    const isValid = authenticator.check(finalCode, secret);

    // ZERO bypass allowed. 000000 is strictly rejected.
    if (!isValid) {
      return res.status(401).json({ error: "Invalid 6-digit code. Check your authenticator app." });
    }

    // Permanently seal and lock 2FA upon first successful verification
    const db = getDb();
    await db.execute({
      sql: "INSERT OR REPLACE INTO operator_auth (key, value) VALUES ('totp_paired', '1')",
      args: [],
    });

    // Issue session JWT (valid for 30 days — minimum 7 days guaranteed)
    const sessionToken = jwt.sign({ operator: "Operator", authenticated: true }, JWT_SECRET, {
      expiresIn: "30d",
    });

    return res.json({
      success: true,
      token: sessionToken,
      operator: "Operator",
      expiresInDays: 30,
      sessionExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      message: "2FA Verified. Operator session authorized for 30 days.",
      isLocked: true,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "2FA authentication failed", details: err.message });
  }
});

// 2. Direct verify-2fa endpoint
router.post("/verify-2fa", authRateLimiter, async (req: Request, res: Response) => {
  try {
    await initDb();
    const { code, totpCode } = req.body;
    const finalCode = String(code || totpCode || "").trim();

    if (!finalCode) {
      return res.status(400).json({ error: "Missing 6-digit TOTP code." });
    }

    const secret = await getTotpSecret();
    const isValid = authenticator.check(finalCode, secret);

    if (!isValid) {
      return res.status(401).json({ error: "Invalid 6-digit code. Check your authenticator app." });
    }

    // Permanently seal and lock 2FA
    const db = getDb();
    await db.execute({
      sql: "INSERT OR REPLACE INTO operator_auth (key, value) VALUES ('totp_paired', '1')",
      args: [],
    });

    const sessionToken = jwt.sign({ operator: "Operator", authenticated: true }, JWT_SECRET, {
      expiresIn: "30d",
    });

    return res.json({
      success: true,
      token: sessionToken,
      operator: "Operator",
      expiresInDays: 30,
      sessionExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      message: "2FA Verified. Operator session authorized for 30 days.",
      isLocked: true,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "2FA verification failed", details: err.message });
  }
});

// 3. Setup 2FA QR Code (ONE-TIME ONLY: Sealed once paired or deployed)
router.get("/setup-2fa", async (req: Request, res: Response) => {
  try {
    await initDb();
    const locked = await is2FaLocked();

    // Check if operator is already authenticated with valid JWT
    const authHeader = req.headers.authorization;
    let isAuthenticated = false;
    if (authHeader) {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, "");
        jwt.verify(token, JWT_SECRET);
        isAuthenticated = true;
      } catch {
        isAuthenticated = false;
      }
    }

    // If 2FA has been paired/locked, deny unauthenticated visitors
    if (locked && !isAuthenticated) {
      return res.status(403).json({
        error: "2FA is permanently initialized and locked. Pairing setup is disabled on deployed instances.",
        isLocked: true,
      });
    }

    const secret = await getTotpSecret();
    const otpauth = authenticator.keyuri("Operator", "CrystalStudioLabs-Heimdall", secret);
    const qrDataUrl = await qrcode.toDataURL(otpauth);

    return res.json({
      isLocked: locked,
      secret,
      qrDataUrl,
      otpauth,
      instructions: "Scan this QR code in Google Authenticator, Ente Auth, or 1Password to generate your 6-digit codes.",
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to generate QR code", details: err.message });
  }
});

// 4. Session check
router.get("/me", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ authenticated: false });

  const token = authHeader.replace(/^Bearer\s+/i, "");
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const expiresAt = decoded.exp ? decoded.exp * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000;
    const daysRemaining = decoded.exp ? Math.max(0, Math.ceil((decoded.exp * 1000 - Date.now()) / (1000 * 60 * 60 * 24))) : 30;
    return res.json({ 
      authenticated: true, 
      operator: decoded.operator || "Operator",
      exp: decoded.exp,
      expiresAt: new Date(expiresAt).toISOString(),
      daysRemaining
    });
  } catch {
    return res.status(401).json({ authenticated: false });
  }
});

export default router;
