"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  // Get lesson periods (not breaks/assembly)
  const periods = await db.period.findMany({
    where: { schoolId: school.id, type: "LESSON", isActive: true },
    orderBy: { order: "asc" },
  });

  if (periods.length === 0) return { error: "No lesson periods configured." };

  // Get available rooms
  const rooms = await db.room.findMany({
    where: { schoolId: school.id, isActive: true },
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

  const days = [1, 2, 3, 4, 5]; // Monday to Friday
  const maxConsecutive = data.constraints?.maxConsecutivePeriodsPerTeacher ?? 3;

  // Track assignments: teacher -> set of (day, periodId)
  const teacherSchedule = new Map<string, Set<string>>();
  // Track: room -> set of (day, periodId)
  const roomSchedule = new Map<string, Set<string>>();
  // Track: classArm -> set of (day, periodId)
  const classSchedule = new Map<string, Set<string>>();

  const createdSlots: any[] = [];
  const conflicts: string[] = [];

  const slotKey = (day: number, periodId: string) => `${day}-${periodId}`;

  const isTeacherFree = (teacherId: string, day: number, periodId: string) => {
    const schedule = teacherSchedule.get(teacherId);
    return !schedule || !schedule.has(slotKey(day, periodId));
  };

  const isClassFree = (classArmId: string, day: number, periodId: string) => {
    const schedule = classSchedule.get(classArmId);
    return !schedule || !schedule.has(slotKey(day, periodId));
  };

  const markSlot = (teacherId: string, classArmId: string, roomId: string | null, day: number, periodId: string) => {
    const key = slotKey(day, periodId);
    if (!teacherSchedule.has(teacherId)) teacherSchedule.set(teacherId, new Set());
    teacherSchedule.get(teacherId)!.add(key);
    if (!classSchedule.has(classArmId)) classSchedule.set(classArmId, new Set());
    classSchedule.get(classArmId)!.add(key);
    if (roomId) {
      if (!roomSchedule.has(roomId)) roomSchedule.set(roomId, new Set());
      roomSchedule.get(roomId)!.add(key);
    }
  };

  // Group assignments by classArm
  const assignmentsByClass = new Map<string, typeof assignments>();
  for (const a of assignments) {
    if (!assignmentsByClass.has(a.classArmId)) assignmentsByClass.set(a.classArmId, []);
    assignmentsByClass.get(a.classArmId)!.push(a);
  }

  // Default frequency: distribute subjects evenly across the week
  const totalSlotsPerWeek = periods.length * days.length;

  for (const classArmId of data.classArmIds) {
    const classAssignments = assignmentsByClass.get(classArmId) ?? [];
    if (classAssignments.length === 0) {
      conflicts.push(`No assignments for class arm ${classArmId}`);
      continue;
    }

    // Determine frequency per subject
    const frequency = data.constraints?.subjectFrequencyPerWeek ?? {};
    const defaultFreq = Math.max(1, Math.floor(totalSlotsPerWeek / classAssignments.length));

    // Build a queue of (assignment, remaining slots)
    const queue: Array<{ assignment: typeof assignments[0]; remaining: number }> = [];
    for (const a of classAssignments) {
      const freq = frequency[a.subjectId] ?? defaultFreq;
      queue.push({ assignment: a, remaining: freq });
    }

    // Greedy assignment
    for (const day of days) {
      for (const period of periods) {
        if (!isClassFree(classArmId, day, period.id)) continue;

        // Find an assignment that can fill this slot
        let assigned = false;
        for (const item of queue) {
          if (item.remaining <= 0) continue;
          const teacherId = item.assignment.staffId;

          if (!isTeacherFree(teacherId, day, period.id)) continue;

          // Find a free room (optional)
          let roomId: string | null = null;
          for (const room of rooms) {
            const roomKey = slotKey(day, period.id);
            const schedule = roomSchedule.get(room.id);
            if (!schedule || !schedule.has(roomKey)) {
              roomId = room.id;
              break;
            }
          }

          // Create the slot
          markSlot(teacherId, classArmId, roomId, day, period.id);
          item.remaining--;

          createdSlots.push({
            schoolId: school.id,
            academicYearId: data.academicYearId,
            termId: data.termId,
            classArmId,
            subjectId: item.assignment.subjectId,
            teacherId,
            periodId: period.id,
            roomId,
            dayOfWeek: day,
          });

          assigned = true;
          break;
        }

        if (!assigned) {
          conflicts.push(`Could not fill slot: day ${day}, period ${period.name} for class arm ${classArmId}`);
        }
      }
    }
  }

  // Bulk create all slots
  if (createdSlots.length > 0) {
    await db.timetableSlot.createMany({ data: createdSlots });
  }

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "TimetableSlot",
    entityId: "auto-generate",
    module: "timetable",
    description: `Auto-generated ${createdSlots.length} timetable slots for ${data.classArmIds.length} class arm(s)`,
    metadata: { classArmIds: data.classArmIds, created: createdSlots.length, conflicts: conflicts.length },
  });

  return { data: { created: createdSlots.length, conflicts } };
}

// ─── Validate Timetable ──────────────────────────────────────────────

export async function validateTimetableAction(classArmId: string, termId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const deleted = await db.timetableSlot.deleteMany({
    where: { classArmId, termId },
  });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "TimetableSlot",
    entityId: classArmId,
    module: "timetable",
    description: `Cleared ${deleted.count} timetable slots`,
    metadata: { classArmId, termId, deleted: deleted.count },
  });

  return { data: { deleted: deleted.count } };
}
