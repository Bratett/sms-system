"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { resolveTargetedHouseholdIds } from "../circular-targeting";
import { notifyCircularReminder } from "../circular-notifications";

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ─── Acknowledge ─────────────────────────────────────────────────

export async function acknowledgeCircularAction(input: {
  announcementId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.CIRCULAR_ACKNOWLEDGE);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const announcement = await db.announcement.findFirst({
    where: { id: input.announcementId, schoolId: ctx.schoolId },
    select: {
      id: true,
      status: true,
      requiresAcknowledgement: true,
      targetType: true,
      targetIds: true,
    },
  });
  if (!announcement) return { error: "Circular not found" };
  if (!announcement.requiresAcknowledgement) {
    return { error: "This circular doesn't require acknowledgement." };
  }
  if (announcement.status === "ARCHIVED") {
    return { error: "This circular is no longer active." };
  }

  const guardian = await db.guardian.findUnique({
    where: { userId },
    select: { userId: true, householdId: true },
  });
  if (!guardian?.householdId) return { error: "Circular not found" };

  const targeted = await resolveTargetedHouseholdIds({
    schoolId: ctx.schoolId,
    targetType: announcement.targetType as never,
    targetIds: Array.isArray(announcement.targetIds)
      ? (announcement.targetIds as string[])
      : null,
  });
  if (!targeted.includes(guardian.householdId)) {
    return { error: "Circular not found" };
  }

  try {
    await db.circularAcknowledgement.create({
      data: {
        announcementId: input.announcementId,
        householdId: guardian.householdId,
        acknowledgedByUserId: userId,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return { success: true };
    }
    throw err;
  }

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "CircularAcknowledgement",
    entityId: input.announcementId,
    module: "communication",
    description: `Parent acknowledged circular ${input.announcementId}`,
    newData: { householdId: guardian.householdId },
  });

  return { success: true };
}

// ─── Stats (admin) ────────────────────────────────────────────────

/** @no-audit Read-only admin stats view. */
export async function getAnnouncementAcknowledgementStatsAction(
  announcementId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.CIRCULAR_ACKNOWLEDGEMENT_TRACK,
  );
  if (denied) return denied;

  const announcement = await db.announcement.findFirst({
    where: { id: announcementId, schoolId: ctx.schoolId },
    select: {
      id: true,
      targetType: true,
      targetIds: true,
      lastReminderSentAt: true,
      requiresAcknowledgement: true,
    },
  });
  if (!announcement) return { error: "Circular not found" };

  const targeted = await resolveTargetedHouseholdIds({
    schoolId: ctx.schoolId,
    targetType: announcement.targetType as never,
    targetIds: Array.isArray(announcement.targetIds)
      ? (announcement.targetIds as string[])
      : null,
  });

  const acknowledgedCount = await db.circularAcknowledgement.count({
    where: { announcementId, householdId: { in: targeted } },
  });

  const now = Date.now();
  const lastMs = announcement.lastReminderSentAt?.getTime() ?? 0;
  const canSendReminder = now - lastMs >= REMINDER_COOLDOWN_MS;

  return {
    data: {
      targeted: targeted.length,
      acknowledged: acknowledgedCount,
      pending: targeted.length - acknowledgedCount,
      lastReminderSentAt: announcement.lastReminderSentAt,
      canSendReminder,
      requiresAcknowledgement: announcement.requiresAcknowledgement,
    },
  };
}

// ─── Detail rows (admin) ──────────────────────────────────────────

/** @no-audit Read-only admin detail view. */
export async function getAnnouncementAcknowledgementDetailsAction(
  announcementId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.CIRCULAR_ACKNOWLEDGEMENT_TRACK,
  );
  if (denied) return denied;

  const announcement = await db.announcement.findFirst({
    where: { id: announcementId, schoolId: ctx.schoolId },
    select: { targetType: true, targetIds: true },
  });
  if (!announcement) return { error: "Circular not found" };

  const targeted = await resolveTargetedHouseholdIds({
    schoolId: ctx.schoolId,
    targetType: announcement.targetType as never,
    targetIds: Array.isArray(announcement.targetIds)
      ? (announcement.targetIds as string[])
      : null,
  });
  if (targeted.length === 0) return { data: [] };

  const [households, acks] = await Promise.all([
    db.household.findMany({
      where: { id: { in: targeted }, schoolId: ctx.schoolId },
      select: { id: true, name: true },
    }),
    db.circularAcknowledgement.findMany({
      where: { announcementId, householdId: { in: targeted } },
      select: {
        householdId: true,
        acknowledgedAt: true,
        acknowledgedBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const ackByHousehold = new Map(acks.map((a) => [a.householdId, a]));

  const rows = households.map((h) => {
    const ack = ackByHousehold.get(h.id);
    return {
      householdId: h.id,
      householdName: h.name,
      acknowledged: !!ack,
      acknowledgedAt: ack?.acknowledgedAt ?? null,
      acknowledgedBy: ack?.acknowledgedBy
        ? [ack.acknowledgedBy.firstName, ack.acknowledgedBy.lastName]
            .filter(Boolean)
            .join(" ") || "(deleted user)"
        : null,
    };
  });

  rows.sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
    return a.householdName.localeCompare(b.householdName);
  });

  return { data: rows };
}

// ─── Chase (admin) ────────────────────────────────────────────────

export async function chaseAnnouncementAcknowledgementAction(
  announcementId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(
    ctx.session,
    PERMISSIONS.CIRCULAR_ACKNOWLEDGEMENT_TRACK,
  );
  if (denied) return denied;

  const announcement = await db.announcement.findFirst({
    where: { id: announcementId, schoolId: ctx.schoolId },
    select: {
      id: true,
      title: true,
      lastReminderSentAt: true,
      targetType: true,
      targetIds: true,
      requiresAcknowledgement: true,
    },
  });
  if (!announcement) return { error: "Circular not found" };
  if (!announcement.requiresAcknowledgement) {
    return { error: "This circular doesn't require acknowledgement." };
  }

  const now = Date.now();
  const lastMs = announcement.lastReminderSentAt?.getTime() ?? 0;
  const remainingMs = REMINDER_COOLDOWN_MS - (now - lastMs);
  if (remainingMs > 0) {
    const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
    return { error: `Reminder cooldown: ${hours} hour${hours === 1 ? "" : "s"} remaining.` };
  }

  const targeted = await resolveTargetedHouseholdIds({
    schoolId: ctx.schoolId,
    targetType: announcement.targetType as never,
    targetIds: Array.isArray(announcement.targetIds)
      ? (announcement.targetIds as string[])
      : null,
  });

  const acks = await db.circularAcknowledgement.findMany({
    where: { announcementId, householdId: { in: targeted } },
    select: { householdId: true },
  });
  const acknowledgedIds = new Set(acks.map((a) => a.householdId));
  const pendingHouseholdIds = targeted.filter((id) => !acknowledgedIds.has(id));

  if (pendingHouseholdIds.length === 0) {
    return { error: "Everyone has acknowledged. No one to remind." };
  }

  const guardians = await db.guardian.findMany({
    where: {
      householdId: { in: pendingHouseholdIds },
      userId: { not: null },
    },
    select: { userId: true },
  });
  const recipientUserIds = [
    ...new Set(guardians.map((g) => g.userId).filter((u): u is string => !!u)),
  ];

  await db.announcement.update({
    where: { id: announcementId },
    data: { lastReminderSentAt: new Date() },
  });

  try {
    if (recipientUserIds.length > 0) {
      await notifyCircularReminder({
        announcementId,
        title: announcement.title,
        recipientUserIds,
      });
    }
  } catch (err) {
    console.error("notifyCircularReminder failed", { announcementId, err });
  }

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Announcement",
    entityId: announcementId,
    module: "communication",
    description: `Sent acknowledgement reminder to ${pendingHouseholdIds.length} household(s)`,
    newData: { recipientUserCount: recipientUserIds.length, pendingHouseholdCount: pendingHouseholdIds.length },
  });

  return { success: true, notifiedCount: recipientUserIds.length };
}
