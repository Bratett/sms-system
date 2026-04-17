"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { NOTIFICATION_EVENTS, EVENT_CHANNELS } from "@/lib/notifications/events";
import type { NotificationChannel } from "@prisma/client";

/**
 * User-facing notification preference actions. Lives under the portal
 * module because parents, staff and students all use the same endpoints
 * from their respective settings pages.
 *
 * Preferences are keyed on (userId, eventKey). Missing rows mean "use the
 * system default from EVENT_CHANNELS" — so a silent empty table is a valid
 * state, not a bug.
 */

const CHANNELS = ["IN_APP", "SMS", "EMAIL", "WHATSAPP", "PUSH"] as const;

const setPrefSchema = z.object({
  eventKey: z.string().min(1).max(100),
  channels: z.array(z.enum(CHANNELS)).default([]),
});

export async function getMyNotificationPreferencesAction() {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const rows = await db.notificationPreference.findMany({
    where: { userId: ctx.session.user.id },
    orderBy: { eventKey: "asc" },
  });

  const byEvent = new Map(rows.map((r) => [r.eventKey, r.channels]));

  // Produce a full matrix: every known event + its current effective channels.
  // Effective = user override ? user override : EVENT_CHANNELS default.
  const catalogue = Object.entries(NOTIFICATION_EVENTS).map(([, key]) => {
    const defaults = (EVENT_CHANNELS[key] ?? ["in_app"]).map((c) =>
      channelKeyToEnum(c),
    );
    const override = byEvent.get(key);
    return {
      eventKey: key,
      displayName: humanise(key),
      defaultChannels: defaults,
      effectiveChannels: override ?? defaults,
      hasOverride: override !== undefined,
    };
  });

  return { data: catalogue };
}

export async function setNotificationPreferenceAction(
  input: z.input<typeof setPrefSchema>,
) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const parsed = setPrefSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.notificationPreference.findUnique({
    where: {
      userId_eventKey: {
        userId: ctx.session.user.id,
        eventKey: parsed.data.eventKey,
      },
    },
  });

  const row = await db.notificationPreference.upsert({
    where: {
      userId_eventKey: {
        userId: ctx.session.user.id,
        eventKey: parsed.data.eventKey,
      },
    },
    create: {
      userId: ctx.session.user.id,
      eventKey: parsed.data.eventKey,
      channels: parsed.data.channels as NotificationChannel[],
    },
    update: {
      channels: parsed.data.channels as NotificationChannel[],
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: existing ? "UPDATE" : "CREATE",
    entity: "NotificationPreference",
    entityId: row.id,
    module: "portal",
    description: `${existing ? "Updated" : "Set"} notification preference for ${parsed.data.eventKey}`,
    newData: { channels: parsed.data.channels },
  });

  revalidatePath("/parent/settings/notifications");
  revalidatePath("/student/settings/notifications");
  revalidatePath("/staff/settings/notifications");
  return { success: true };
}

/** Revert to system defaults for a single event. */
export async function clearNotificationPreferenceAction(eventKey: string) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  let deleted = false;
  await db.notificationPreference
    .delete({
      where: {
        userId_eventKey: { userId: ctx.session.user.id, eventKey },
      },
    })
    .then(() => {
      deleted = true;
    })
    .catch(() => {
      // Already at default — no-op.
    });

  if (deleted) {
    await audit({
      userId: ctx.session.user.id,
      action: "DELETE",
      entity: "NotificationPreference",
      module: "portal",
      description: `Reset notification preference for ${eventKey} to default`,
    });
  }

  revalidatePath("/parent/settings/notifications");
  revalidatePath("/student/settings/notifications");
  revalidatePath("/staff/settings/notifications");
  return { success: true };
}

function channelKeyToEnum(c: string): NotificationChannel {
  switch (c) {
    case "in_app":
      return "IN_APP";
    case "sms":
      return "SMS";
    case "email":
      return "EMAIL";
    case "whatsapp":
      return "WHATSAPP";
    case "push":
      return "PUSH";
    default:
      return "IN_APP";
  }
}

function humanise(key: string): string {
  return key
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(" ");
}
