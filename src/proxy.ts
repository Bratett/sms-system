import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getSecurityHeaders } from "@/lib/security-headers";
import { apiLimiter, authLimiter, RateLimitError } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const proxyLog = logger.child({ component: "proxy" });

function newRequestId(): string {
  // 16 hex chars — good enough for correlating a single request across logs.
  // Avoid crypto.randomUUID to keep the proxy runtime-agnostic (edge).
  return (
    Math.random().toString(16).slice(2, 10) +
    Math.random().toString(16).slice(2, 10)
  );
}

export default auth((req) => {
  const { nextUrl } = req;
  const startTime = Date.now();
  const requestId = req.headers.get("x-request-id") ?? newRequestId();

  // --- Rate limiting for auth API routes ---
  // Exclude /api/auth/session from rate limiting — it is polled frequently by
  // NextAuth's SessionProvider and must not be throttled.
  if (
    nextUrl.pathname.startsWith("/api/auth") &&
    !nextUrl.pathname.endsWith("/session")
  ) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "anonymous";

    // Rate limit check is async, but we need to handle it within this sync callback.
    // We use a synchronous-compatible pattern by returning a promise-based response.
    return authLimiter
      .check(10, ip)
      .then(() => {
        const response = NextResponse.next();
        applySecurityHeaders(response);
        logRequest(req.method, nextUrl.pathname, 200, startTime, requestId, response);
        return response;
      })
      .catch((error: unknown) => {
        if (error instanceof RateLimitError) {
          const response = new NextResponse(
            JSON.stringify({ error: "Too many requests. Please try again later." }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": String(Math.ceil(error.retryAfter / 1000)),
              },
            },
          );
          logRequest(req.method, nextUrl.pathname, 429, startTime, requestId, response);
          return response;
        }
        // For unexpected errors, let the request through
        const response = NextResponse.next();
        applySecurityHeaders(response);
        return response;
      });
  }

  // --- Rate limiting for API routes ---
  if (nextUrl.pathname.startsWith("/api/") && !nextUrl.pathname.startsWith("/api/auth")) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "anonymous";

    return apiLimiter
      .check(60, ip)
      .then(() => {
        const response = NextResponse.next();
        applySecurityHeaders(response);
        logRequest(req.method, nextUrl.pathname, 200, startTime, requestId, response);
        return response;
      })
      .catch((error: unknown) => {
        if (error instanceof RateLimitError) {
          const response = new NextResponse(
            JSON.stringify({ error: "Too many requests" }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": String(Math.ceil(error.retryAfter / 1000)),
              },
            },
          );
          logRequest(req.method, nextUrl.pathname, 429, startTime, requestId, response);
          return response;
        }
        const response = NextResponse.next();
        applySecurityHeaders(response);
        return response;
      });
  }

  // --- Auth redirect logic ---
  const isLoggedIn = !!req.auth;
  const isAuthPage =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/forgot-password") ||
    nextUrl.pathname.startsWith("/reset-password");
  const isDashboardPage =
    nextUrl.pathname.startsWith("/dashboard") || nextUrl.pathname.startsWith("/admin");
  const isPortalPage =
    nextUrl.pathname.startsWith("/parent") || nextUrl.pathname.startsWith("/student");

  if (isAuthPage && isLoggedIn) {
    const response = NextResponse.redirect(new URL("/dashboard", nextUrl));
    applySecurityHeaders(response);
    logRequest(req.method, nextUrl.pathname, 302, startTime, requestId, response);
    return response;
  }

  if ((isDashboardPage || isPortalPage) && !isLoggedIn) {
    const response = NextResponse.redirect(new URL("/login", nextUrl));
    applySecurityHeaders(response);
    logRequest(req.method, nextUrl.pathname, 302, startTime, requestId, response);
    return response;
  }

  const response = NextResponse.next();
  applySecurityHeaders(response);
  logRequest(req.method, nextUrl.pathname, 200, startTime, requestId, response);
  return response;
});

/**
 * Apply security headers to a response.
 */
function applySecurityHeaders(response: NextResponse): void {
  for (const header of getSecurityHeaders()) {
    response.headers.set(header.key, header.value);
  }
}

/**
 * Emit one structured log line per request and attach x-request-id to the
 * response so clients and downstream services can correlate.
 */
function logRequest(method: string, path: string, status: number, startTime: number, requestId?: string, response?: NextResponse): void {
  const duration = Date.now() - startTime;
  if (response && requestId) {
    response.headers.set("x-request-id", requestId);
  }
  proxyLog.info("request", { method, path, status, duration, requestId });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|icons|sw\\.js|manifest\\.json).*)",
  ],
};
