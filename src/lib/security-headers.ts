/**
 * Security headers configuration for Next.js.
 * Apply via next.config.ts headers() or in middleware.
 */

interface SecurityHeader {
  key: string;
  value: string;
}

const isDev = process.env.NODE_ENV === "development";

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
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires inline scripts/styles in development
      `script-src 'self'${isDev ? " 'unsafe-eval' 'unsafe-inline'" : " 'unsafe-inline'"}`,
      `style-src 'self' 'unsafe-inline'`,
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self'${isDev ? " ws: wss:" : ""} https://api.paystack.co https://*.r2.cloudflarestorage.com`,
      "frame-src 'self' https://checkout.paystack.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
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
