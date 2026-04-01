import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM field-level encryption for sensitive PII fields
 * (Ghana Card, SSNIT, TIN numbers).
 *
 * Encrypted format: "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */

const ALGORITHM = "aes-256-gcm";
const ENCODING = "hex";
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const key = process.env.FIELD_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY environment variable is required for field encryption. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
  }
  return buf;
}

export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", ENCODING);
  encrypted += cipher.final(ENCODING);

  const authTag = cipher.getAuthTag().toString(ENCODING);
  return `${PREFIX}${iv.toString(ENCODING)}:${authTag}:${encrypted}`;
}

export function decryptField(ciphertext: string): string {
  if (!isEncrypted(ciphertext)) {
    // Return as-is if not encrypted (migration-safe: handles pre-encryption data)
    return ciphertext;
  }

  const key = getKey();
  const parts = ciphertext.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted field value.");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, ENCODING);
  const authTag = Buffer.from(authTagHex, ENCODING);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, ENCODING, "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Encrypt a field value if non-null and non-empty, otherwise return null.
 */
export function encryptOptional(value: string | null | undefined): string | null {
  if (!value) return null;
  return encryptField(value);
}

/**
 * Decrypt a field value if non-null and non-empty, otherwise return null.
 */
export function decryptOptional(value: string | null | undefined): string | null {
  if (!value) return null;
  return decryptField(value);
}
