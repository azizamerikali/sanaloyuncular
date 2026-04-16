import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// Ensure ENCRYPTION_KEY is exactly 32 bytes (256 bits) for aes-256-gcm
// Must be set via environment variable - no fallback allowed.
const rawKey = process.env.ENCRYPTION_KEY as string;
const ENCRYPTION_KEY_BUF = Buffer.from(rawKey, "utf8");
if (ENCRYPTION_KEY_BUF.length !== 32) {
  throw new Error(
    `ENCRYPTION_KEY must be exactly 32 bytes for AES-256-GCM. Got ${ENCRYPTION_KEY_BUF.length} bytes. ` +
    `Generate a valid key with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  );
}
const ENCRYPTION_KEY = ENCRYPTION_KEY_BUF;
const IV_LENGTH = 12; // GCM typically uses a 96-bit (12 byte) IV
const ALGORITHM = "aes-256-gcm";

/**
 * Encrypts a plain text string to aes-256-gcm format.
 * output format: "iv:authTag:encryptedData" (Hex encoded)
 */
export function encryptField(text: string): string {
  if (!text) return text;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
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
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedDataHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err);
    return text; // Fallback to raw text if decryption fails
  }
}
