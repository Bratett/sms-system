"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { solveTimetable, type SolverConstraints } from "@/modules/timetable/lib/constraint-solver";

// ─── Auto Generate Timetable ─────────────────────────────────────────

interface TimetableConstraints {
  maxConsecutivePeriodsPerTeacher?: number;
  subjectFrequencyPerWeek?: Record<string, number>; // subjectId -> times per week
}

export async function autoGenerateTimetableAction(data: {
  academicYearId: string;
  termId: string;
  classArmIds: string[];
  constraints?: TimetableConstraints;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TIMETABLE_GENERATE);
  if (denied) return denied;

  // Get lesson periods (not breaks/assembly)
  const periods = await db.period.findMany({
    where: { schoolId: ctx.schoolId, type: "LESSON", isActive: true },
    orderBy: { order: "asc" },
  });

  if (periods.length === 0) return { error: "No lesson periods configured." };

  // Get available rooms
  const rooms = await db.room.findMany({
    where: { schoolId: ctx.schoolId, isActive: true },
  });

  // Get teacher-subject assignments for the given term/year
  const assignments = await db.teacherSubjectAssignment.findMany({
    where: {
      academicYearId: data.academicYearId,
      classArmId: { in: data.classArmIds },
      OR: [{ termId: data.termId }, { termId: null }],
    },
    include: {
      subject: { select: { id: true, name: true } },
    },
  });

  if (assignments.length === 0) {
    return { error: "No teacher-subject assignments found. Assign teachers to subjects first." };
  }

  // Get operating days from school config (default Mon-Fri)
  const operatingDaysSetting = await db.systemSetting.findFirst({
    where: { key: "school.operatingDays" },
  });
  const days: number[] = operatingDaysSetting
    ? JSON.parse(operatingDaysSetting.value)
    : [1, 2, 3, 4, 5];

  // Get teacher availability for the term
  const teacherIds = [...new Set(assignments.map((a) => a.staffId))];
  const availability = await db.teacherAvailability.findMany({
    where: {
      teacherId: { in: teacherIds },
      termId: data.termId,
    },
  });

  // Get teacher preferences
  const preferences = await db.teacherPreference.findMany({
    where: {
      teacherId: { in: teacherIds },
      termId: data.termId,
    },
  });

  const maxConsecutive = data.constraints?.maxConsecutivePeriodsPerTeacher ?? 3;

  // Build solver constraints
  const solverConstraints: SolverConstraints = {
    maxConsecutivePeriodsPerTeacher: maxConsecutive,
    subjectFrequencyPerWeek: data.constraints?.subjectFrequencyPerWeek ?? {},
    teacherAvailability: availability.map((a) => ({
      teacherId: a.teacherId,
      dayOfWeek: a.dayOfWeek,
      periodId: a.periodId,
      isAvailable: a.isAvailable,
    })),
    teacherPreferences: preferences.map((p) => ({
      teacherId: p.teacherId,
      maxPeriodsPerDay: p.maxPeriodsPerDay,
      maxConsecutivePeriods: p.maxConsecutivePeriods,
    })),
  };

  // Run solver
  const result = solveTimetable({
    classArmIds: data.classArmIds,
    assignments: assignments.map((a) => ({
      staffId: a.staffId,
      subjectId: a.subjectId,
      classArmId: a.classArmId,
      subjectName: a.subject.name,
    })),
    periods: periods.map((p) => ({ id: p.id, name: p.name, order: p.order })),
    rooms: rooms.map((r) => ({ id: r.id, name: r.name, features: r.features })),
    days,
    constraints: solverConstraints,
    schoolId: ctx.schoolId,
    academicYearId: data.academicYearId,
    termId: data.termId,
  });

  // Bulk create all slots
  if (result.slots.length > 0) {
    const createData = result.slots.map((s) => ({
      schoolId: ctx.schoolId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      classArmId: s.classArmId,
      subjectId: s.subjectId,
      teacherId: s.teacherId,
      periodId: s.periodId,
      roomId: s.roomId,
      dayOfWeek: s.dayOfWeek,
    }));
    await db.timetableSlot.createMany({ data: createData });
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "TimetableSlot",
    entityId: "auto-generate",
    module: "timetable",
    description: `Auto-generated ${result.slots.length} timetable slots for ${data.classArmIds.length} class arm(s) using constraint solver`,
    metadata: { classArmIds: data.classArmIds, created: result.slots.length, conflicts: result.conflicts.length },
  });

  return { data: { created: result.slots.length, conflicts: result.conflicts } };
}

// ─── Validate Timetable ──────────────────────────────────────────────

export async function validateTimetableAction(classArmId: string, termId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const slots = await db.timetableSlot.findMany({
    where: { classArmId, termId },
    include: {
      subject: { select: { name: true } },
      period: { select: { name: true, startTime: true, endTime: true } },
    },
  });

  const conflicts: string[] = [];

  // Check for teacher double-booking
  const teacherSlots = new Map<string, typeof slots>();
  for (const slot of slots) {
    const key = `${slot.teacherId}-${slot.dayOfWeek}-${slot.periodId}`;
    if (!teacherSlots.has(key)) teacherSlots.set(key, []);
    teacherSlots.get(key)!.push(slot);
  }
  for (const [key, slots] of teacherSlots) {
    if (slots.length > 1) {
      conflicts.push(`Teacher double-booked: ${key}`);
    }
  }

  return { data: { totalSlots: slots.length, conflicts } };
}

// ─── Clear Timetable ─────────────────────────────────────────────────

export async function clearTimetableAction(classArmId: string, termId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const deleted = await db.timetableSlot.deleteMany({
    where: { classArmId, termId },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "TimetableSlot",
    entityId: classArmId,
    module: "timetable",
    description: `Cleared ${deleted.count} timetable slots`,
    metadata: { classArmId, termId, deleted: deleted.count },
  });

  return { data: { deleted: deleted.count } };
}
