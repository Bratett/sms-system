import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: Number(process.env.SENTRY_REPLAYS_ON_ERROR_RATE ?? 0),
    // PII scrub: never send user input or request bodies
    sendDefaultPii: false,
  });
}
