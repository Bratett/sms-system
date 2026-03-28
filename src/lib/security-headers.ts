/**
 * Security headers configuration for Next.js.
 * Apply via next.config.ts headers() or in middleware.
 */

interface SecurityHeader {
  key: string;
  value: string;
}

const securityHeaders: SecurityHeader[] = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/**
 * Returns security headers array suitable for Next.js config or middleware.
 */
export function getSecurityHeaders(): SecurityHeader[] {
  return securityHeaders;
}

export { securityHeaders };
export type { SecurityHeader };
