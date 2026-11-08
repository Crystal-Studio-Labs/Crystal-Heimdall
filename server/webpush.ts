import * as webpush from "web-push";
import { getDb, initDb } from "./db.js";
import { encryptSecret, decryptSecret } from "./crypto.js";

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface StoredPushSubscription {
  endpoint: string;
  keys: PushSubscriptionKeys;
  expirationTime?: number | null;
}

export interface IncidentPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  timestamp?: number;
  severity?: "info" | "warning" | "critical";
  incidentId?: string;
}

let isVapidConfigured = false;
let currentPublicKey: string | null = null;

/**
 * Retrieves or generates VAPID keys for W3C Web Push.
 * If not set in environment variables, keys are securely generated and persisted in operator_auth.
 */
export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string; subject: string }> {
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:alerts@crystalstudiolabs.org";

  // 1. Environment variable override
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const pub = process.env.VAPID_PUBLIC_KEY.trim();
    const priv = process.env.VAPID_PRIVATE_KEY.trim();
    if (!isVapidConfigured) {
      webpush.setVapidDetails(subject, pub, priv);
      isVapidConfigured = true;
      currentPublicKey = pub;
    }
    return { publicKey: pub, privateKey: priv, subject };
  }

  // 2. Database lookup
  await initDb();
  const db = getDb();
  const pubRes = await db.execute("SELECT value FROM operator_auth WHERE key = 'vapid_public_key'");
  const privRes = await db.execute("SELECT value FROM operator_auth WHERE key = 'vapid_private_key'");

  if (pubRes.rows.length > 0 && privRes.rows.length > 0 && pubRes.rows[0].value && privRes.rows[0].value) {
    const pub = String(pubRes.rows[0].value);
    const encryptedPriv = String(privRes.rows[0].value);
    const priv = decryptSecret(encryptedPriv);

    if (!isVapidConfigured) {
      webpush.setVapidDetails(subject, pub, priv);
      isVapidConfigured = true;
      currentPublicKey = pub;
    }
    return { publicKey: pub, privateKey: priv, subject };
  }

  // 3. Auto-generate fresh VAPID keypair on first run
  console.log("⚡ Generating persistent VAPID keypair for closed-browser Web Push notifications...");
  const keys = webpush.generateVAPIDKeys();
  const encryptedPriv = encryptSecret(keys.privateKey);

  await db.execute({
    sql: "INSERT OR REPLACE INTO operator_auth (key, value) VALUES ('vapid_public_key', ?)",
    args: [keys.publicKey],
  });
  await db.execute({
    sql: "INSERT OR REPLACE INTO operator_auth (key, value) VALUES ('vapid_private_key', ?)",
    args: [encryptedPriv],
  });

  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  isVapidConfigured = true;
  currentPublicKey = keys.publicKey;

  return { publicKey: keys.publicKey, privateKey: keys.privateKey, subject };
}

/**
 * Returns the public VAPID key for client browser registration
 */
export async function getVapidPublicKey(): Promise<string> {
  if (currentPublicKey) return currentPublicKey;
  const keys = await getVapidKeys();
  return keys.publicKey;
}

/**
 * Dispatches a native Web Push Notification to a subscriber even if their browser/PWA is completely closed.
 */
export async function sendWebPushNotification(
  subscription: StoredPushSubscription,
  payload: IncidentPushPayload
): Promise<{ success: boolean; statusCode?: number; error?: string; expired?: boolean }> {
  try {
    await getVapidKeys();

    const formattedPayload = JSON.stringify({
      title: payload.title || "CRYSTAL HEIMDALL // OUTAGE ALERT",
      body: payload.body || "A monitored system dropped offline. Tap to triage.",
      icon: payload.icon || "/icon-192.png",
      badge: payload.badge || "/icon-192.png",
      tag: payload.tag || "heimdall-outage-alert",
      url: payload.url || "/dashboard",
      timestamp: payload.timestamp || Date.now(),
      severity: payload.severity || "critical",
      incidentId: payload.incidentId,
    });

    const res = await webpush.sendNotification(subscription as any, formattedPayload, {
      TTL: 60 * 60 * 24, // 24 hours
      urgency: "high",
    });

    return { success: true, statusCode: res.statusCode };
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    const isExpired = statusCode === 410 || statusCode === 404;

    console.warn(`[WEB PUSH DISPATCH FAILED] Status ${statusCode}:`, err.message);

    return {
      success: false,
      statusCode,
      error: err.message,
      expired: isExpired,
    };
  }
}
