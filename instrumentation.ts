import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Next.js expects a top-level export named `onRequestError`. The Sentry SDK
// renamed its hook to `captureRequestError`, so we bridge it here.
export const onRequestError = Sentry.captureRequestError;
