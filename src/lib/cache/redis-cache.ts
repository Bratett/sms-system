import { getRedisConnection } from "@/lib/queue";

/**
 * Redis-based caching layer for frequently accessed data.
 * Reduces database load for hot paths like school config,
 * academic year, term, and dashboard stats.
 */

const PREFIX = "sms:cache:";

type CacheOptions = {
  /** TTL in seconds. Default: 300 (5 minutes) */
  ttl?: number;
};

/**
 * Get a cached value, or compute and cache it if not found.
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  options?: CacheOptions,
): Promise<T> {
  const redis = getRedisConnection();
  const ttl = options?.ttl ?? 300;
  const fullKey = PREFIX + key;

  try {
    const cached = await redis.get(fullKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Redis unavailable, fall through to compute
  }

  const result = await fn();

  try {
    await redis.set(fullKey, JSON.stringify(result), "EX", ttl);
  } catch {
    // Redis unavailable, result still returned from compute
  }

  return result;
}

/**
 * Invalidate a specific cache key.
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    const redis = getRedisConnection();
    await redis.del(PREFIX + key);
  } catch {
    // Redis unavailable
  }
}

/**
 * Invalidate all cache keys matching a pattern.
 * Example: invalidateCachePattern("school:*") clears all school-related caches.
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    const redis = getRedisConnection();
    const keys = await redis.keys(PREFIX + pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Redis unavailable
  }
}

// ─── Pre-defined Cache Keys ────────────────────────────────────────

export const CACHE_KEYS = {
  /** School configuration - rarely changes */
  school: () => "school:config",

  /** Current academic year */
  currentAcademicYear: (schoolId: string) => `school:${schoolId}:academic-year:current`,

  /** Current term */
  currentTerm: (schoolId: string) => `school:${schoolId}:term:current`,

  /** Grading scale */
  gradingScale: (schoolId: string) => `school:${schoolId}:grading-scale:default`,

  /** Dashboard stats (short TTL) */
  dashboardStats: (schoolId: string) => `school:${schoolId}:dashboard`,

  /** Student count */
  studentCount: (schoolId: string) => `school:${schoolId}:students:count`,

  /** Permissions for a role */
  rolePermissions: (roleId: string) => `role:${roleId}:permissions`,

  /** Fee structures for a term */
  feeStructures: (termId: string) => `term:${termId}:fee-structures`,
} as const;
