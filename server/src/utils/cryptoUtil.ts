import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// ENCRYPTION_KEY must be exactly 32 bytes (256 bits) for aes-256-gcm
// We'll validate this during initialization or use to prevent startup crashes.
const getEncryptionKey = (): Buffer => {
  const rawKey = process.env.ENCRYPTION_KEY || "";
  const buf = Buffer.from(rawKey, "utf8");
  if (buf.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must be exactly 32 bytes. Got ${buf.length}.`);
  }
  return buf;
};

// Diagnostic helper
export const getEncryptionKeyInfo = () => {
  const rawKey = process.env.ENCRYPTION_KEY || "";
  const buf = Buffer.from(rawKey, "utf8");
  // Short fingerprint (first 8 hex chars of SHA-256 of the key) — safe to expose, not reversible
  let fingerprint = "none";
  if (buf.length === 32) {
    fingerprint = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
  }
  return {
    exists: !!rawKey,
    length: buf.length,
    isValid: buf.length === 32,
    fingerprint,
  };
};

const IV_LENGTH = 12; // GCM typically uses a 96-bit (12 byte) IV
const ALGORITHM = "aes-256-gcm";

/**
 * Encrypts a plain text string to aes-256-gcm format.
 * output format: "iv:authTag:encryptedData" (Hex encoded)
 */
export function encryptField(text: string): string {
  if (!text) return text;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a previously encrypted aes-256-gcm string back to plain text.
 */
export function decryptField(text: string): string {
  if (!text || !text.includes(":")) return text; // If not encrypted or empty, return as is.

  try {
    const parts = text.split(":");
    if (parts.length !== 3) return text;

    const [ivHex, authTagHex, encryptedDataHex] = parts;

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedDataHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    const keyInfo = getEncryptionKeyInfo();
    console.error(`Decryption failed (key fingerprint: ${keyInfo.fingerprint}):`, err);
    return text; // Fallback to raw text if decryption fails
  }
}
