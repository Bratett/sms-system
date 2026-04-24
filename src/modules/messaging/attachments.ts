import { randomUUID } from "node:crypto";

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
] as const;

export type ValidateResult = { ok: true } | { ok: false; error: string };

/**
 * Pure validator for attachment metadata. Caller MUST re-verify by HEAD'ing
 * R2 after upload to catch MIME/size mismatches from client-side lies.
 */
export function validateAttachment(input: {
  mimeType: string;
  size: number;
}): ValidateResult {
  if (!ALLOWED_MIME_TYPES.includes(input.mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    return {
      ok: false,
      error: `File type "${input.mimeType}" is not allowed. Accepted: ${ALLOWED_MIME_TYPES.join(", ")}`,
    };
  }
  if (input.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return { ok: false, error: "File is too large. Maximum size is 5 MB." };
  }
  if (input.size <= 0) {
    return { ok: false, error: "File is empty." };
  }
  return { ok: true };
}

/**
 * Deterministic R2 key generation. Sanitises filename and prefixes with a
 * random UUID to avoid collisions. Scoped by schoolId so a leaked key cannot
 * target another tenant's bucket space.
 */
export function buildAttachmentKey(input: {
  schoolId: string;
  threadId: string;
  filename: string;
}): string {
  const safeName = sanitiseFilename(input.filename);
  const uuid = randomUUID();
  return `messages/${input.schoolId}/${input.threadId}/${uuid}-${safeName}`;
}

function sanitiseFilename(name: string): string {
  const lastSegment = name.split(/[\\/]/).pop() ?? "file";
  return lastSegment
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .toLowerCase();
}
