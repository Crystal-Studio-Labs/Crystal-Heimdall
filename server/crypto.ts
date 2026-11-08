import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const PREFIX = "enc:v1:";

/**
 * Derives a deterministic 256-bit (32 byte) key from ENCRYPTION_KEY or JWT_SECRET
 */
function getDerivedKey(): Buffer {
  const seed = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "crystal_heimdall_super_secret_jwt_key_2026";
  return crypto.createHash("sha256").update(seed).digest();
}

/**
 * Encrypts a plaintext string (e.g. Base32 TOTP secret) at rest using AES-256-GCM
 * Format: enc:v1:<iv-hex>:<authTag-hex>:<ciphertext-hex>
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getDerivedKey(), iv);
  
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM encrypted secret string.
 * Gracefully returns the original string if it is legacy plaintext (self-healing migration support).
 */
export function decryptSecret(cipherString: string): string {
  if (!cipherString) return "";
  if (!cipherString.startsWith(PREFIX)) {
    // Legacy plaintext: return as-is for self-healing migration
    return cipherString;
  }

  try {
    const parts = cipherString.slice(PREFIX.length).split(":");
    if (parts.length !== 3) {
      throw new Error("Malformed encrypted secret format");
    }

    const [ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");
    const encryptedData = Buffer.from(dataHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, getDerivedKey(), iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err: any) {
    console.error("Failed to decrypt secret at rest:", err.message);
    // If decryption fails, throw to prevent using corrupted or tampered credentials
    throw new Error(`Decryption error: ${err.message}`);
  }
}
