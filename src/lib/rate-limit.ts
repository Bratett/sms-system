/**
 * Rate limiter with Redis backend and in-memory fallback.
 *
 * - Redis mode: sliding-window counter, shared across instances, survives restarts.
 * - Fallback mode: in-memory Map (per-instance, same as before).
 *
 * The proxy may run in edge runtime where ioredis is unavailable.
 * We dynamically import ioredis and fall back gracefully.
 */

interface RateLimitOptions {
  interval: number; // Window duration in milliseconds
  uniqueTokenPerInterval: number; // Max unique tokens tracked per interval (in-memory only)
}

interface RateLimitResult {
  limit: number;
  remaining: number;
  reset: number; // Timestamp (ms) when the current window expires
}

interface TokenBucket {
  count: number;
  expiresAt: number;
}

export class RateLimitError extends Error {
  public retryAfter: number;

  constructor(retryAfterMs: number) {
    super(`Rate limit exceeded. Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.`);
    this.name = "RateLimitError";
    this.retryAfter = retryAfterMs;
  }
}

// Redis connection singleton (lazy, nullable)
let redisClient: import("ioredis").default | null = null;
let redisInitialized = false;

async function getRedis(): Promise<import("ioredis").default | null> {
  if (redisInitialized) return redisClient;
  redisInitialized = true;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    const IORedis = (await import("ioredis")).default;
    redisClient = new IORedis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });
    await redisClient.connect();
    return redisClient;
  } catch {
    console.warn("[rate-limit] Redis unavailable, using in-memory fallback");
    redisClient = null;
    return null;
  }
}

/**
 * Redis sliding-window rate limit check.
 * Uses a sorted set with timestamps as scores.
 */
async function redisCheck(
  redis: import("ioredis").default,
  key: string,
  limit: number,
  windowMs: number,
  token: string,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `rl:${key}:${token}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, 0, windowStart); // Remove expired entries
  pipeline.zadd(redisKey, now.toString(), `${now}-${Math.random()}`); // Add current request
  pipeline.zcard(redisKey); // Count requests in window
  pipeline.pexpire(redisKey, windowMs); // Set TTL

  const results = await pipeline.exec();
  const count = (results?.[2]?.[1] as number) ?? 0;
  const reset = now + windowMs;

  if (count > limit) {
    // Remove the entry we just added (request is rejected)
    await redis.zremrangebyscore(redisKey, now, now);
    throw new RateLimitError(windowMs - (now - windowStart));
  }

  return { limit, remaining: limit - count, reset };
}

function rateLimit(options: RateLimitOptions) {
  const { interval, uniqueTokenPerInterval } = options;
  const tokenMap = new Map<string, TokenBucket>();

  // Periodic cleanup for in-memory fallback
  const cleanup = () => {
    const now = Date.now();
    for (const [key, bucket] of tokenMap) {
      if (bucket.expiresAt <= now) {
        tokenMap.delete(key);
      }
    }
  };

  if (typeof setInterval !== "undefined") {
    const timer = setInterval(cleanup, interval);
    if (typeof timer === "object" && "unref" in timer) {
      timer.unref();
    }
  }

  return {
    async check(limit: number, token: string): Promise<RateLimitResult> {
      // Try Redis first
      try {
        const redis = await getRedis();
        if (redis) {
          return await redisCheck(redis, "api", limit, interval, token);
        }
      } catch (error) {
        if (error instanceof RateLimitError) throw error;
        // Redis error — fall through to in-memory
      }

      // In-memory fallback
      const now = Date.now();

      if (tokenMap.size >= uniqueTokenPerInterval && !tokenMap.has(token)) {
        cleanup();
        if (tokenMap.size >= uniqueTokenPerInterval) {
          throw new RateLimitError(interval);
        }
      }

      const existing = tokenMap.get(token);

      if (!existing || existing.expiresAt <= now) {
        const expiresAt = now + interval;
        tokenMap.set(token, { count: 1, expiresAt });
        return { limit, remaining: limit - 1, reset: expiresAt };
      }

      existing.count += 1;

      if (existing.count > limit) {
        const retryAfter = existing.expiresAt - now;
        throw new RateLimitError(retryAfter);
      }

      return {
        limit,
        remaining: limit - existing.count,
        reset: existing.expiresAt,
      };
    },
  };
}

/** General API rate limiter: 60 requests per minute */
export const apiLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

/** Auth route rate limiter: 10 requests per minute (brute-force protection) */
export const authLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

export { rateLimit };
export type { RateLimitOptions, RateLimitResult };
