"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Create Version Snapshot ─────────────────────────────────────────

export async function createTimetableVersionAction(data: {
  termId: string;
  academicYearId: string;
  name: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TIMETABLE_VERSION_CREATE);
  if (denied) return denied;

  // Get all current slots for this term
  const slots = await db.timetableSlot.findMany({
    where: {
      schoolId: ctx.schoolId,
      termId: data.termId,
      academicYearId: data.academicYearId,
    },
    select: {
      classArmId: true,
      subjectId: true,
      teacherId: true,
      periodId: true,
      roomId: true,
      dayOfWeek: true,
    },
  });

  if (slots.length === 0) {
    return { error: "No timetable slots found for this term. Nothing to snapshot." };
  }

  const version = await db.timetableVersion.create({
    data: {
      schoolId: ctx.schoolId,
      termId: data.termId,
      academicYearId: data.academicYearId,
      name: data.name,
      slots: slots as unknown as object,
      createdBy: ctx.session.user.id,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "TimetableVersion",
    entityId: version.id,
    module: "timetable",
    description: `Created timetable snapshot "${data.name}" with ${slots.length} slots`,
  });

  return { data: { id: version.id, slotCount: slots.length } };
}

// ─── List Versions ───────────────────────────────────────────────────

export async function getTimetableVersionsAction(termId?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TIMETABLE_VERSION_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (termId) where.termId = termId;

  const versions = await db.timetableVersion.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // Get creator names
  const creatorIds = [...new Set(versions.map((v) => v.createdBy))];
  const users = await db.user.findMany({
    where: { id: { in: creatorIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = versions.map((v) => ({
    id: v.id,
    name: v.name,
    status: v.status,
    slotCount: Array.isArray(v.slots) ? (v.slots as unknown[]).length : 0,
    createdBy: userMap.get(v.createdBy) ?? "Unknown",
    publishedAt: v.publishedAt,
    createdAt: v.createdAt,
  }));

  return { data };
}

// ─── Publish Version ─────────────────────────────────────────────────

export async function publishTimetableVersionAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TIMETABLE_VERSION_PUBLISH);
  if (denied) return denied;

  const version = await db.timetableVersion.findUnique({ where: { id } });
  if (!version) return { error: "Version not found." };
  if (version.status === "PUBLISHED") return { error: "Version is already published." };

  // Archive any currently published version for the same term
  await db.timetableVersion.updateMany({
    where: {
      schoolId: version.schoolId,
      termId: version.termId,
      status: "PUBLISHED",
    },
    data: { status: "ARCHIVED" },
  });

  await db.timetableVersion.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "PUBLISH",
    entity: "TimetableVersion",
    entityId: id,
    module: "timetable",
    description: `Published timetable version "${version.name}"`,
  });

  return { success: true };
}

// ─── Restore Version ─────────────────────────────────────────────────

export async function restoreTimetableVersionAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TIMETABLE_VERSION_RESTORE);
  if (denied) return denied;

  const version = await db.timetableVersion.findUnique({ where: { id } });
  if (!version) return { error: "Version not found." };

  const slots = version.slots as unknown as Array<{
    classArmId: string;
    subjectId: string;
    teacherId: string;
    periodId: string;
    roomId: string | null;
    dayOfWeek: number;
  }>;

  if (!Array.isArray(slots) || slots.length === 0) {
    return { error: "Version has no slot data to restore." };
  }

  // Clear current timetable for this term
  await db.timetableSlot.deleteMany({
    where: {
      schoolId: version.schoolId,
      termId: version.termId,
      academicYearId: version.academicYearId,
    },
  });

  // Recreate slots from snapshot
  const createData = slots.map((s) => ({
    schoolId: version.schoolId,
    academicYearId: version.academicYearId,
    termId: version.termId,
    classArmId: s.classArmId,
    subjectId: s.subjectId,
    teacherId: s.teacherId,
    periodId: s.periodId,
    roomId: s.roomId,
    dayOfWeek: s.dayOfWeek,
  }));

  await db.timetableSlot.createMany({ data: createData });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "TimetableVersion",
    entityId: id,
    module: "timetable",
    description: `Restored timetable from version "${version.name}" (${slots.length} slots)`,
  });

  return { data: { restored: slots.length } };
}
