"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Record Event Attendance ─────────────────────────────────────────

export async function recordEventAttendanceAction(data: {
  eventId: string;
  records: Array<{
    studentId: string;
    status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "SICK";
    remarks?: string;
  }>;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ATTENDANCE_CREATE);
  if (denied) return denied;

  // Verify event exists
  const event = await db.academicEvent.findUnique({
    where: { id: data.eventId },
    select: { id: true, title: true },
  });

  if (!event) return { error: "Event not found." };

  let saved = 0;
  const errors: string[] = [];

  for (const record of data.records) {
    try {
      await db.eventAttendance.upsert({
        where: {
          eventId_studentId: {
            eventId: data.eventId,
            studentId: record.studentId,
          },
        },
        create: {
          schoolId: ctx.schoolId,
          eventId: data.eventId,
          studentId: record.studentId,
          status: record.status,
          remarks: record.remarks || null,
          recordedBy: ctx.session.user.id,
        },
        update: {
          status: record.status,
          remarks: record.remarks || null,
        },
      });
      saved++;
    } catch (err) {
      errors.push(`Failed for student ${record.studentId}`);
    }
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "EventAttendance",
    entityId: data.eventId,
    module: "attendance",
    description: `Recorded event attendance for "${event.title}" (${saved} students)`,
  });

  return { data: { saved, errors } };
}

// ─── Get Event Attendance ────────────────────────────────────────────

export async function getEventAttendanceAction(eventId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ATTENDANCE_READ);
  if (denied) return denied;

  const records = await db.eventAttendance.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
  });

  // Get student names
  const studentIds = records.map((r) => r.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const data = records.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentNumber: studentMap.get(r.studentId)?.studentId ?? "",
    studentName: studentMap.get(r.studentId)
      ? `${studentMap.get(r.studentId)!.firstName} ${studentMap.get(r.studentId)!.lastName}`
      : "Unknown",
    status: r.status,
    remarks: r.remarks,
  }));

  return { data };
}

// ─── Get Events with Attendance Summary ──────────────────────────────

export async function getEventsWithAttendanceAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const currentTerm = await db.term.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });

  const events = await db.academicEvent.findMany({
    where: {
      schoolId: ctx.schoolId,
      ...(currentTerm ? { termId: currentTerm.id } : {}),
    },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      startDate: true,
      endDate: true,
      isAllDay: true,
    },
  });

  // Get attendance counts per event
  const eventIds = events.map((e) => e.id);
  const attendanceCounts = eventIds.length > 0
    ? await db.eventAttendance.groupBy({
        by: ["eventId"],
        where: { eventId: { in: eventIds } },
        _count: { id: true },
      })
    : [];

  const countMap = new Map(attendanceCounts.map((c) => [c.eventId, c._count.id] as const));

  const data = events.map((e) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    startDate: e.startDate,
    endDate: e.endDate,
    isAllDay: e.isAllDay,
    attendanceCount: (countMap.get(e.id) as number) ?? 0,
  }));

  return { data };
}
