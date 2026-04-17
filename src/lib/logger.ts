/**
 * Structured JSON logger.
 *
 * Drop-in replacement for `console.*` in workers and server code. Emits one JSON
 * line per log entry to stdout/stderr so log aggregators (Cloud Run, Datadog,
 * Loki) can parse without a format-specific agent.
 *
 * The API shape matches pino's (`info`, `warn`, `error`, `debug`, `child`) so
 * migrating to pino later is a dep swap without touching call sites.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentLevel(): Level {
  const env = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (env === "debug" || env === "info" || env === "warn" || env === "error") {
    return env;
  }
  return "info";
}

function shouldLog(level: Level): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel()];
}

function serialize(level: Level, msg: string, extras: Record<string, unknown>): string {
  const base = {
    level,
    time: new Date().toISOString(),
    msg,
    pid: process.pid,
    env: process.env.NODE_ENV ?? "development",
    ...extras,
  };
  try {
    return JSON.stringify(base);
  } catch {
    return JSON.stringify({ level, time: base.time, msg, serializationError: true });
  }
}

function emit(level: Level, msg: string, extras: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const line = serialize(level, msg, extras);
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

function make(bindings: Record<string, unknown> = {}): Logger {
  return {
    debug(msg, data) {
      emit("debug", msg, { ...bindings, ...(data ?? {}) });
    },
    info(msg, data) {
      emit("info", msg, { ...bindings, ...(data ?? {}) });
    },
    warn(msg, data) {
      emit("warn", msg, { ...bindings, ...(data ?? {}) });
    },
    error(msg, data) {
      const out = { ...bindings, ...(data ?? {}) };
      // Normalise Error instances into serializable fields.
      if (out.error instanceof Error) {
        const e = out.error;
        out.error = { name: e.name, message: e.message, stack: e.stack };
      }
      emit("error", msg, out);
    },
    child(extra) {
      return make({ ...bindings, ...extra });
    },
  };
}

export const logger: Logger = make();
