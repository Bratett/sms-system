/**
 * In-memory rate limiter compatible with Next.js edge runtime.
 * Uses a simple Map-based approach with automatic cleanup.
 */

interface RateLimitOptions {
  interval: number; // Window duration in milliseconds
  uniqueTokenPerInterval: number; // Max unique tokens tracked per interval
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

function rateLimit(options: RateLimitOptions) {
  const { interval, uniqueTokenPerInterval } = options;
  const tokenMap = new Map<string, TokenBucket>();

  // Periodic cleanup to prevent memory leaks
  const cleanup = () => {
    const now = Date.now();
    for (const [key, bucket] of tokenMap) {
      if (bucket.expiresAt <= now) {
        tokenMap.delete(key);
      }
    }
  };

  // Run cleanup every interval
  if (typeof setInterval !== "undefined") {
    const timer = setInterval(cleanup, interval);
    // Allow the process to exit without waiting for this timer
    if (typeof timer === "object" && "unref" in timer) {
      timer.unref();
    }
  }

  return {
    /**
     * Check if the token is within the rate limit.
     * @param limit - Maximum number of requests allowed in the interval
     * @param token - Unique identifier for the requester (e.g., IP address)
     * @throws {RateLimitError} when the limit is exceeded
     */
    async check(limit: number, token: string): Promise<RateLimitResult> {
      const now = Date.now();

      // Enforce max unique tokens to prevent memory exhaustion
      if (tokenMap.size >= uniqueTokenPerInterval && !tokenMap.has(token)) {
        // Evict expired entries first
        cleanup();
        if (tokenMap.size >= uniqueTokenPerInterval) {
          throw new RateLimitError(interval);
        }
      }

      const existing = tokenMap.get(token);

      // If no existing bucket or the window has expired, start fresh
      if (!existing || existing.expiresAt <= now) {
        const expiresAt = now + interval;
        tokenMap.set(token, { count: 1, expiresAt });
        return { limit, remaining: limit - 1, reset: expiresAt };
      }

      // Increment the count within the current window
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

/** Auth route rate limiter: 5 requests per minute (brute-force protection) */
export const authLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

export { rateLimit };
export type { RateLimitOptions, RateLimitResult };
