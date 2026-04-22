type CacheEntry<T> = { value: T; expiresAt: number };

const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Returns the cached value for `key` if fresh, otherwise runs `loader`,
 * caches the result for `ttlMs` milliseconds, and returns it. Loader errors
 * are NOT cached — the next call retries.
 *
 * Intended for read-only aggregate queries with bounded staleness tolerance
 * (e.g., the Student Analytics dashboard). In-process cache; not shared
 * across Node instances.
 */
export async function getCached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > now) return entry.value;
  const value = await loader();
  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/**
 * Removes all cache entries whose key starts with `prefix`. Used to
 * force-refresh a subset (e.g., all entries for a specific school).
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** Test-only utility. Not exported from the public module index. */
export function __resetCacheForTests(): void {
  cache.clear();
}
