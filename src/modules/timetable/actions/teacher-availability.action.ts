"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Get Teacher Availability ────────────────────────────────────────

export async function getTeacherAvailabilityAction(teacherId: string, termId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const availability = await db.teacherAvailability.findMany({
    where: { teacherId, termId },
    orderBy: [{ dayOfWeek: "asc" }, { periodId: "asc" }],
  });

  return {
    data: availability.map((a) => ({
      id: a.id,
      dayOfWeek: a.dayOfWeek,
      periodId: a.periodId,
      isAvailable: a.isAvailable,
      reason: a.reason,
    })),
  };
}

// ─── Set Teacher Availability (Bulk) ─────────────────────────────────

export async function setTeacherAvailabilityAction(data: {
  teacherId: string;
  termId: string;
  entries: Array<{
    dayOfWeek: number;
    periodId: string;
    isAvailable: boolean;
    reason?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  let updated = 0;
  for (const entry of data.entries) {
    await db.teacherAvailability.upsert({
      where: {
        teacherId_dayOfWeek_periodId_termId: {
          teacherId: data.teacherId,
          dayOfWeek: entry.dayOfWeek,
          periodId: entry.periodId,
          termId: data.termId,
        },
      },
      create: {
        schoolId: school.id,
        teacherId: data.teacherId,
        dayOfWeek: entry.dayOfWeek,
        periodId: entry.periodId,
        termId: data.termId,
        isAvailable: entry.isAvailable,
        reason: entry.reason || null,
      },
      update: {
        isAvailable: entry.isAvailable,
        reason: entry.reason || null,
      },
    });
    updated++;
  }

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "TeacherAvailability",
    entityId: data.teacherId,
    module: "timetable",
    description: `Updated ${updated} availability entries for teacher`,
  });

  return { data: { updated } };
}

// ─── Get Teacher Preferences ─────────────────────────────────────────

export async function getTeacherPreferenceAction(teacherId: string, termId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const pref = await db.teacherPreference.findUnique({
    where: {
      teacherId_termId: { teacherId, termId },
    },
  });

  if (!pref) return { data: null };

  return {
    data: {
      id: pref.id,
      maxPeriodsPerDay: pref.maxPeriodsPerDay,
      maxConsecutivePeriods: pref.maxConsecutivePeriods,
      preferredPeriodIds: pref.preferredPeriodIds as string[] | null,
      avoidPeriodIds: pref.avoidPeriodIds as string[] | null,
      notes: pref.notes,
    },
  };
}

// ─── Save Teacher Preferences ────────────────────────────────────────

export async function saveTeacherPreferenceAction(data: {
  teacherId: string;
  termId: string;
  maxPeriodsPerDay?: number;
  maxConsecutivePeriods?: number;
  preferredPeriodIds?: string[];
  avoidPeriodIds?: string[];
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  await db.teacherPreference.upsert({
    where: {
      teacherId_termId: {
        teacherId: data.teacherId,
        termId: data.termId,
      },
    },
    create: {
      schoolId: school.id,
      teacherId: data.teacherId,
      termId: data.termId,
      maxPeriodsPerDay: data.maxPeriodsPerDay ?? null,
      maxConsecutivePeriods: data.maxConsecutivePeriods ?? null,
      preferredPeriodIds: data.preferredPeriodIds ?? undefined,
      avoidPeriodIds: data.avoidPeriodIds ?? undefined,
      notes: data.notes ?? null,
    },
    update: {
      maxPeriodsPerDay: data.maxPeriodsPerDay ?? null,
      maxConsecutivePeriods: data.maxConsecutivePeriods ?? null,
      preferredPeriodIds: data.preferredPeriodIds ?? undefined,
      avoidPeriodIds: data.avoidPeriodIds ?? undefined,
      notes: data.notes ?? null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "TeacherPreference",
    entityId: data.teacherId,
    module: "timetable",
    description: "Updated teacher scheduling preferences",
  });

  return { success: true };
}
