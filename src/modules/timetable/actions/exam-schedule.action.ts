"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Exam Schedules ─────────────────────────────────────────────────

export async function createExamScheduleAction(data: {
  academicYearId: string;
  termId: string;
  subjectId: string;
  classId: string;
  date: Date;
  startTime: string;
  endTime: string;
  roomId?: string;
  invigilatorId?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const examSchedule = await db.examSchedule.create({
    data: {
      schoolId: school.id,
      academicYearId: data.academicYearId,
      termId: data.termId,
      subjectId: data.subjectId,
      classId: data.classId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      roomId: data.roomId || null,
      invigilatorId: data.invigilatorId || null,
      notes: data.notes || null,
    },
    include: {
      subject: { select: { name: true } },
      class: { select: { name: true } },
      room: { select: { name: true } },
      invigilator: { select: { firstName: true, lastName: true } },
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "ExamSchedule",
    entityId: examSchedule.id,
    module: "timetable",
    description: `Created exam schedule: ${examSchedule.subject.name} for ${examSchedule.class.name} on ${examSchedule.date.toISOString().split("T")[0]}`,
    newData: examSchedule,
  });

  return { data: examSchedule };
}

export async function getExamSchedulesAction(filters: {
  termId?: string;
  academicYearId?: string;
  classId?: string;
  subjectId?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const where: Record<string, unknown> = { schoolId: school.id };

  if (filters.termId) {
    where.termId = filters.termId;
  }
  if (filters.academicYearId) {
    where.academicYearId = filters.academicYearId;
  }
  if (filters.classId) {
    where.classId = filters.classId;
  }
  if (filters.subjectId) {
    where.subjectId = filters.subjectId;
  }

  const examSchedules = await db.examSchedule.findMany({
    where,
    include: {
      subject: { select: { id: true, name: true, code: true } },
      class: { select: { id: true, name: true } },
      room: { select: { id: true, name: true, building: true } },
      invigilator: { select: { id: true, firstName: true, lastName: true } },
      term: { select: { id: true, name: true } },
      academicYear: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const data = examSchedules.map((exam) => ({
    id: exam.id,
    date: exam.date,
    startTime: exam.startTime,
    endTime: exam.endTime,
    notes: exam.notes,
    subject: exam.subject,
    class: exam.class,
    room: exam.room,
    invigilator: exam.invigilator
      ? {
          id: exam.invigilator.id,
          name: `${exam.invigilator.firstName} ${exam.invigilator.lastName}`,
        }
      : null,
    term: exam.term,
    academicYear: exam.academicYear,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
  }));

  return { data };
}

export async function updateExamScheduleAction(
  id: string,
  data: {
    subjectId?: string;
    classId?: string;
    date?: Date;
    startTime?: string;
    endTime?: string;
    roomId?: string | null;
    invigilatorId?: string | null;
    notes?: string | null;
  },
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const existing = await db.examSchedule.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Exam schedule not found." };
  }

  const previousData = { ...existing };

  const updated = await db.examSchedule.update({
    where: { id },
    data: {
      subjectId: data.subjectId ?? existing.subjectId,
      classId: data.classId ?? existing.classId,
      date: data.date ?? existing.date,
      startTime: data.startTime ?? existing.startTime,
      endTime: data.endTime ?? existing.endTime,
      roomId: data.roomId !== undefined ? data.roomId : existing.roomId,
      invigilatorId: data.invigilatorId !== undefined ? data.invigilatorId : existing.invigilatorId,
      notes: data.notes !== undefined ? data.notes : existing.notes,
    },
    include: {
      subject: { select: { name: true } },
      class: { select: { name: true } },
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "ExamSchedule",
    entityId: id,
    module: "timetable",
    description: `Updated exam schedule: ${updated.subject.name} for ${updated.class.name}`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteExamScheduleAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const existing = await db.examSchedule.findUnique({
    where: { id },
    include: {
      subject: { select: { name: true } },
      class: { select: { name: true } },
    },
  });

  if (!existing) {
    return { error: "Exam schedule not found." };
  }

  await db.examSchedule.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "ExamSchedule",
    entityId: id,
    module: "timetable",
    description: `Deleted exam schedule: ${existing.subject.name} for ${existing.class.name}`,
    previousData: existing,
  });

  return { success: true };
}
