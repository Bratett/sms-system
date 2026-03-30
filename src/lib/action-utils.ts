"use server";

import { getTenantContext, isTenantError, type TenantContext } from "@/lib/tenant";
import { sanitizeSearchQuery } from "@/lib/sanitize";

/**
 * Get the action context with tenant-aware school resolution.
 * This is the primary entry point for all server actions.
 */
export async function getActionContext(): Promise<
  TenantContext | { error: string }
> {
  return getTenantContext();
}

export { isTenantError, type TenantContext };

/**
 * Sanitize search/filter strings in action inputs.
 */
export function sanitizeFilters<T extends Record<string, unknown>>(
  filters: T,
  searchFields: (keyof T)[],
): T {
  const sanitized = { ...filters };

  for (const field of searchFields) {
    const value = sanitized[field];
    if (typeof value === "string" && value.length > 0) {
      (sanitized[field] as unknown) = sanitizeSearchQuery(value);
    }
  }

  return sanitized;
}
