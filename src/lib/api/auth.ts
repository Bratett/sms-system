import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

export interface ApiContext {
  apiKeyId: string;
  schoolId: string;
  permissions: string[];
}

/**
 * Authenticate an API request using Bearer token (API key).
 * API keys are stored as bcrypt hashes. The prefix is used for lookup.
 * Format: sk_live_XXXXXXXXXXXX (prefix: sk_live_XXXX)
 */
export async function authenticateApiRequest(
  request: NextRequest,
): Promise<ApiContext | { error: string; status: number }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header", status: 401 };
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey || apiKey.length < 20) {
    return { error: "Invalid API key format", status: 401 };
  }

  // Extract prefix for lookup (first 12 characters)
  const prefix = apiKey.slice(0, 12);

  const keyRecord = await db.apiKey.findFirst({
    where: { prefix, isActive: true },
  });

  if (!keyRecord) {
    return { error: "Invalid API key", status: 401 };
  }

  // Verify full key against hash
  const isValid = await bcrypt.compare(apiKey, keyRecord.keyHash);
  if (!isValid) {
    return { error: "Invalid API key", status: 401 };
  }

  // Check expiration
  if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
    return { error: "API key has expired", status: 401 };
  }

  // Update last used timestamp (fire and forget)
  db.apiKey.update({
    where: { id: keyRecord.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return {
    apiKeyId: keyRecord.id,
    schoolId: keyRecord.schoolId,
    permissions: keyRecord.permissions,
  };
}

/**
 * Check if the API context has the required permission.
 */
export function hasApiPermission(ctx: ApiContext, permission: string): boolean {
  return ctx.permissions.includes("*") || ctx.permissions.includes(permission);
}
