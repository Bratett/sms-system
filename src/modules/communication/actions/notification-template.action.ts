"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { renderHandlebarsLike } from "@/lib/notifications/templates";
import type { NotificationChannel } from "@prisma/client";

/**
 * Admin CRUD for school-scoped overrides of NotificationTemplate rows.
 *
 * Global (schoolId=null) templates are seeded with the shipped defaults and
 * cannot be edited from this UI — only school-scoped overrides are mutable.
 * The resolver in `src/lib/notifications/templates.ts` prefers school rows
 * over global rows, so an override completely replaces the default for that
 * tenant without the admin having to delete anything.
 */

const CHANNELS = ["IN_APP", "SMS", "EMAIL", "WHATSAPP", "PUSH"] as const;

const upsertSchema = z.object({
  key: z.string().min(1).max(100),
  channel: z.enum(CHANNELS),
  locale: z.string().min(2).max(10).default("en"),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(10_000),
  variables: z.array(z.string()).optional(),
  active: z.boolean().default(true),
});

export async function listNotificationTemplatesAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SCHOOL_SETTINGS_READ);
  if (denied) return denied;

  // Surface both the school's overrides and the global defaults so the admin
  // can see which keys have an override and which are inheriting the default.
  const templates = await db.notificationTemplate.findMany({
    where: { OR: [{ schoolId: ctx.schoolId }, { schoolId: null }] },
    orderBy: [{ key: "asc" }, { channel: "asc" }, { locale: "asc" }],
  });

  return {
    data: templates.map((t) => ({
      id: t.id,
      scope: (t.schoolId === ctx.schoolId ? "school" : "global") as "school" | "global",
      schoolId: t.schoolId,
      key: t.key,
      channel: t.channel,
      locale: t.locale,
      subject: t.subject,
      body: t.body,
      variables: (t.variables as string[] | null) ?? [],
      active: t.active,
      updatedAt: t.updatedAt,
    })),
  };
}

export async function upsertNotificationTemplateAction(
  input: z.input<typeof upsertSchema>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SCHOOL_SETTINGS_UPDATE);
  if (denied) return denied;

  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const existing = await db.notificationTemplate.findUnique({
    where: {
      schoolId_key_channel_locale: {
        schoolId: ctx.schoolId,
        key: data.key,
        channel: data.channel as NotificationChannel,
        locale: data.locale,
      },
    },
  });

  const row = await db.notificationTemplate.upsert({
    where: {
      schoolId_key_channel_locale: {
        schoolId: ctx.schoolId,
        key: data.key,
        channel: data.channel as NotificationChannel,
        locale: data.locale,
      },
    },
    create: {
      schoolId: ctx.schoolId,
      key: data.key,
      channel: data.channel as NotificationChannel,
      locale: data.locale,
      subject: data.subject ?? null,
      body: data.body,
      variables: data.variables ?? undefined,
      active: data.active,
    },
    update: {
      subject: data.subject ?? null,
      body: data.body,
      variables: data.variables ?? undefined,
      active: data.active,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: existing ? "UPDATE" : "CREATE",
    entity: "NotificationTemplate",
    entityId: row.id,
    module: "communication",
    description: `${existing ? "Updated" : "Created"} ${data.channel} template '${data.key}' (${data.locale})`,
    previousData: existing ?? undefined,
    newData: row,
  });

  revalidatePath("/communication/templates");
  return { data: row };
}

export async function deleteNotificationTemplateAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SCHOOL_SETTINGS_UPDATE);
  if (denied) return denied;

  const existing = await db.notificationTemplate.findUnique({ where: { id } });
  if (!existing) return { error: "Template not found." };

  // Only school-scoped overrides are deletable. Global defaults stay.
  if (existing.schoolId !== ctx.schoolId) {
    return { error: "Global templates are read-only. Create a school override instead." };
  }

  await db.notificationTemplate.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "DELETE",
    entity: "NotificationTemplate",
    entityId: id,
    module: "communication",
    description: `Deleted override for ${existing.channel} template '${existing.key}' (${existing.locale})`,
    previousData: existing,
  });

  revalidatePath("/communication/templates");
  return { success: true };
}

const previewSchema = z.object({
  subject: z.string().nullable().optional(),
  body: z.string().min(1),
  data: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Render a template body + optional subject with sample data — used by the
 * admin UI preview pane so the author can see exactly what a notification
 * will look like before saving.
 */
export async function previewNotificationTemplateAction(
  input: z.input<typeof previewSchema>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SCHOOL_SETTINGS_READ);
  if (denied) return denied;

  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  return {
    data: {
      subject: parsed.data.subject
        ? renderHandlebarsLike(parsed.data.subject, parsed.data.data)
        : null,
      body: renderHandlebarsLike(parsed.data.body, parsed.data.data),
    },
  };
}
