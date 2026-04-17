/**
 * DB-backed notification template resolver with file fallback.
 *
 * Resolution order for a given `(key, channel, schoolId, locale)`:
 *   1. DB row matching school + locale exactly
 *   2. DB row matching school + default locale ("en")
 *   3. DB row with null schoolId (global default) matching locale
 *   4. DB row with null schoolId matching default locale
 *   5. null — caller falls back to file-based template
 *
 * Rendering uses a tiny `{{var}}` / `{{a.b.c}}` substitution that escapes HTML
 * for string values. No new dep required, and the syntax is Handlebars-compatible
 * so templates can later be swapped to a full Handlebars engine without edits.
 */

import { db } from "@/lib/db";
import type { NotificationChannel } from "@prisma/client";

export interface ResolvedTemplate {
  subject: string | null;
  body: string;
  source: "db" | "fallback";
}

interface ResolveOpts {
  key: string;
  channel: NotificationChannel;
  schoolId?: string | null;
  locale?: string;
}

const DEFAULT_LOCALE = "en";

/**
 * Look up the most-specific active template for the given key/channel/tenant.
 * Returns the raw (unrendered) subject + body, or null if no DB row matched.
 */
export async function resolveTemplate(opts: ResolveOpts): Promise<{ subject: string | null; body: string } | null> {
  const locale = opts.locale ?? DEFAULT_LOCALE;

  const candidates = await db.notificationTemplate.findMany({
    where: {
      key: opts.key,
      channel: opts.channel,
      active: true,
      OR: [
        { schoolId: opts.schoolId ?? undefined },
        { schoolId: null },
      ],
      locale: { in: [locale, DEFAULT_LOCALE] },
    },
    select: { schoolId: true, locale: true, subject: true, body: true },
  });

  if (candidates.length === 0) return null;

  // Rank: school match beats global, then exact locale beats default.
  const scored = candidates.map((t) => ({
    t,
    score:
      (t.schoolId === (opts.schoolId ?? null) ? 2 : 0) +
      (t.locale === locale ? 1 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].t;
  return { subject: best.subject, body: best.body };
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

function lookup(path: string, data: Record<string, unknown>): unknown {
  const parts = path.split(".");
  let cur: unknown = data;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Handlebars-compatible `{{var}}` / `{{a.b}}` substitution. Supports a triple-
 * brace `{{{raw}}}` escape-hatch for values known to be HTML-safe. Missing
 * values render as empty strings.
 */
export function renderHandlebarsLike(
  source: string,
  data: Record<string, unknown>,
): string {
  // Handle {{{raw}}} first so the {{ regex below doesn't claim them.
  const withRaw = source.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, path: string) => {
    const v = lookup(path, data);
    return v == null ? "" : String(v);
  });
  return withRaw.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const v = lookup(path, data);
    if (v == null) return "";
    return escapeHtml(String(v));
  });
}

/**
 * Resolve and render a template. Returns `{ subject, body, source }`.
 * When `source === "fallback"` the caller should use their own file-based
 * template; the returned `body` is an empty string in that case.
 */
export async function resolveAndRender(
  opts: ResolveOpts & { data: Record<string, unknown> },
): Promise<ResolvedTemplate> {
  const tpl = await resolveTemplate(opts);
  if (!tpl) {
    return { subject: null, body: "", source: "fallback" };
  }
  return {
    subject: tpl.subject != null ? renderHandlebarsLike(tpl.subject, opts.data) : null,
    body: renderHandlebarsLike(tpl.body, opts.data),
    source: "db",
  };
}
