"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Get Available Electives for a Student ───────────────────────────

export async function getAvailableElectivesAction(
  studentId: string,
  academicYearId: string,
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const enrollment = await db.enrollment.findFirst({
    where: { studentId, academicYearId, status: "ACTIVE" },
    include: {
      classArm: {
        include: {
          class: { select: { programmeId: true, yearGroup: true } },
        },
      },
    },
  });

  if (!enrollment) {
    return { error: "No active enrollment found for this student." };
  }

  const programmeId = enrollment.classArm.class.programmeId;
  const yearGroup = enrollment.classArm.class.yearGroup;

  const electiveSubjects = await db.programmeSubject.findMany({
    where: {
      programmeId,
      isCore: false,
      OR: [{ yearGroup: null }, { yearGroup }],
    },
    include: {
      subject: { select: { id: true, name: true, code: true, status: true } },
    },
  });

  const existingSelections = await db.studentSubjectSelection.findMany({
    where: { studentId, academicYearId },
    select: { subjectId: true, status: true },
  });
  const selectionMap = new Map(existingSelections.map((s) => [s.subjectId, s.status]));

  const data = electiveSubjects
    .filter((es) => es.subject.status === "ACTIVE")
    .map((es) => ({
      subjectId: es.subject.id,
      subjectName: es.subject.name,
      subjectCode: es.subject.code,
      selectionStatus: selectionMap.get(es.subject.id) ?? null,
    }));

  return { data };
}

// ─── Submit Elective Selections ──────────────────────────────────────

export async function submitElectiveSelectionAction(
  studentId: string,
  subjectIds: string[],
  academicYearId: string,
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  if (subjectIds.length === 0) {
    return { error: "Please select at least one elective subject." };
  }

  await db.studentSubjectSelection.deleteMany({
    where: { studentId, academicYearId, status: "PENDING" },
  });

  const selections = await Promise.all(
    subjectIds.map((subjectId) =>
      db.studentSubjectSelection.create({
        data: { studentId, subjectId, academicYearId },
      }),
    ),
  );

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "StudentSubjectSelection",
    entityId: studentId,
    module: "academics",
    description: `Submitted ${subjectIds.length} elective selection(s)`,
    metadata: { studentId, subjectIds, academicYearId },
  });

  return { data: { submitted: selections.length } };
}

// ─── Get Elective Selections (Admin View) ────────────────────────────

export async function getElectiveSelectionsAction(filters?: {
  classArmId?: string;
  academicYearId?: string;
  status?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const where: Record<string, unknown> = {};
  if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters?.status) where.status = filters.status;

  if (filters?.classArmId) {
    const enrollments = await db.enrollment.findMany({
      where: { classArmId: filters.classArmId, academicYearId: filters.academicYearId, status: "ACTIVE" },
      select: { studentId: true },
    });
    where.studentId = { in: enrollments.map((e) => e.studentId) };
  }

  const selections = await db.studentSubjectSelection.findMany({
    where,
    include: { subject: { select: { id: true, name: true, code: true } } },
    orderBy: { selectedAt: "desc" },
  });

  const studentIds = [...new Set(selections.map((s) => s.studentId))];
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const data = selections.map((s) => {
    const student = studentMap.get(s.studentId);
    return {
      id: s.id,
      studentId: s.studentId,
      studentIdNumber: student?.studentId ?? "",
      studentName: student ? `${student.lastName} ${student.firstName}` : "Unknown",
      subjectId: s.subjectId,
      subjectName: s.subject.name,
      subjectCode: s.subject.code,
      academicYearId: s.academicYearId,
      status: s.status,
      selectedAt: s.selectedAt,
      approvedBy: s.approvedBy,
      approvedAt: s.approvedAt,
      rejectionReason: s.rejectionReason,
    };
  });

  return { data };
}

// ─── Approve / Reject ────────────────────────────────────────────────

export async function approveElectiveSelectionAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const selection = await db.studentSubjectSelection.findUnique({ where: { id } });
  if (!selection) return { error: "Selection not found." };
  if (selection.status !== "PENDING") return { error: "Only pending selections can be approved." };

  const updated = await db.studentSubjectSelection.update({
    where: { id },
    data: { status: "APPROVED", approvedBy: session.user.id, approvedAt: new Date() },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "StudentSubjectSelection",
    entityId: id,
    module: "academics",
    description: "Approved elective selection",
  });

  return { data: updated };
}

export async function rejectElectiveSelectionAction(id: string, reason: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const selection = await db.studentSubjectSelection.findUnique({ where: { id } });
  if (!selection) return { error: "Selection not found." };
  if (selection.status !== "PENDING") return { error: "Only pending selections can be rejected." };

  const updated = await db.studentSubjectSelection.update({
    where: { id },
    data: { status: "REJECTED", rejectionReason: reason },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "StudentSubjectSelection",
    entityId: id,
    module: "academics",
    description: `Rejected elective selection: ${reason}`,
  });

  return { data: updated };
}
