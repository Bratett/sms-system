import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getSecurityHeaders } from "@/lib/security-headers";
import { apiLimiter, authLimiter, RateLimitError } from "@/lib/rate-limit";

export default auth((req) => {
  const { nextUrl } = req;
  const startTime = Date.now();

  // --- Rate limiting for auth API routes ---
  if (nextUrl.pathname.startsWith("/api/auth")) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "anonymous";

    // Rate limit check is async, but we need to handle it within this sync callback.
    // We use a synchronous-compatible pattern by returning a promise-based response.
    return authLimiter
      .check(5, ip)
      .then(() => {
        const response = NextResponse.next();
        applySecurityHeaders(response);
        logRequest(req.method, nextUrl.pathname, 200, startTime);
        return response;
      })
      .catch((error: unknown) => {
        if (error instanceof RateLimitError) {
          logRequest(req.method, nextUrl.pathname, 429, startTime);
          return new NextResponse(
            JSON.stringify({ error: "Too many requests. Please try again later." }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": String(Math.ceil(error.retryAfter / 1000)),
              },
            },
          );
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
        logRequest(req.method, nextUrl.pathname, 200, startTime);
        return response;
      })
      .catch((error: unknown) => {
        if (error instanceof RateLimitError) {
          logRequest(req.method, nextUrl.pathname, 429, startTime);
          return new NextResponse(
            JSON.stringify({ error: "Too many requests" }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": String(Math.ceil(error.retryAfter / 1000)),
              },
            },
          );
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
    logRequest(req.method, nextUrl.pathname, 302, startTime);
    return response;
  }

  if ((isDashboardPage || isPortalPage) && !isLoggedIn) {
    const response = NextResponse.redirect(new URL("/login", nextUrl));
    applySecurityHeaders(response);
    logRequest(req.method, nextUrl.pathname, 302, startTime);
    return response;
  }

  const response = NextResponse.next();
  applySecurityHeaders(response);
  logRequest(req.method, nextUrl.pathname, 200, startTime);
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
 * Log the request method, path, status, and duration.
 */
function logRequest(method: string, path: string, status: number, startTime: number): void {
  const duration = Date.now() - startTime;
  console.log(`[middleware] ${method} ${path} ${status} ${duration}ms`);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|icons|sw\\.js|manifest\\.json).*)",
  ],
};
