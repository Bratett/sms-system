import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["bcryptjs"],
};

const composed = withSerwist(withNextIntl(nextConfig));

// Sentry is wrapped last so it can instrument the final build output. If no
// DSN is configured, Sentry's runtime init files are no-ops (see
// sentry.{client,server,edge}.config.ts).
//
// Note: `withSentryConfig` injects `experimental.clientTraceMetadata =
// ['baggage', 'sentry-trace']` so Sentry can correlate browser pageloads with
// server traces. Next.js reports it under "Experiments (use with caution)" —
// that line is informational, not a warning on our code, and will go away
// automatically when the flag graduates to stable.
export default withSentryConfig(composed, {
  // Only upload source maps when an auth token is present (CI production builds).
  silent: !process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  tunnelRoute: "/monitoring",
  // `disableLogger: true` was deprecated by Sentry. Its replacement
  // (`webpack.treeshake.removeDebugLogging`) is not supported under Turbopack,
  // which we build with, so we intentionally omit it. Sentry's internal debug
  // logger is lightweight in production builds.
});
