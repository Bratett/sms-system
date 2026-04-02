"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Homework CRUD ───────────────────────────────────────────────────

export async function createHomeworkAction(data: {
  subjectId: string;
  classArmId: string;
  termId: string;
  academicYearId: string;
  title: string;
  description?: string;
  dueDate: Date;
  maxScore?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOMEWORK_CREATE);
  if (denied) return denied;

  const homework = await db.homework.create({
    data: {
      schoolId: ctx.schoolId,
      subjectId: data.subjectId,
      classArmId: data.classArmId,
      termId: data.termId,
      academicYearId: data.academicYearId,
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      maxScore: data.maxScore,
      assignedBy: ctx.session.user.id!,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "Homework",
    entityId: homework.id,
    module: "academics",
    description: `Created homework: ${data.title}`,
  });

  return { data: homework };
}

export async function updateHomeworkAction(
  id: string,
  data: {
    title?: string;
    description?: string;
    dueDate?: Date;
    maxScore?: number;
    status?: string;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOMEWORK_CREATE);
  if (denied) return denied;

  const existing = await db.homework.findUnique({ where: { id } });
  if (!existing) return { error: "Homework not found." };

  const updated = await db.homework.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
      ...(data.maxScore !== undefined && { maxScore: data.maxScore }),
      ...(data.status !== undefined && { status: data.status as any }),
    },
  });

  return { data: updated };
}

export async function deleteHomeworkAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOMEWORK_CREATE);
  if (denied) return denied;

  await db.homework.delete({ where: { id } });
  return { data: { deleted: true } };
}

export async function getHomeworkListAction(
  classArmId: string,
  termId: string,
  subjectId?: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOMEWORK_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { classArmId, termId };
  if (subjectId) where.subjectId = subjectId;

  const homeworks = await db.homework.findMany({
    where,
    include: {
      subject: { select: { name: true, code: true } },
      submissions: { select: { id: true, status: true } },
    },
    orderBy: { dueDate: "desc" },
  });

  const data = homeworks.map((h) => ({
    id: h.id,
    title: h.title,
    description: h.description,
    subjectName: h.subject.name,
    subjectCode: h.subject.code,
    dueDate: h.dueDate,
    maxScore: h.maxScore,
    status: h.status,
    submissionCount: h.submissions.length,
    gradedCount: h.submissions.filter((s) => s.status === "GRADED").length,
    createdAt: h.createdAt,
  }));

  return { data };
}

// ─── Student Submissions ─────────────────────────────────────────────

export async function submitHomeworkAction(
  homeworkId: string,
  studentId: string,
  content?: string,
  fileUrl?: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOMEWORK_READ);
  if (denied) return denied;

  const homework = await db.homework.findUnique({ where: { id: homeworkId } });
  if (!homework) return { error: "Homework not found." };
  if (homework.status !== "ACTIVE") return { error: "This homework is no longer accepting submissions." };

  const existing = await db.homeworkSubmission.findFirst({
    where: { homeworkId, studentId },
  });

  if (existing) {
    const updated = await db.homeworkSubmission.update({
      where: { id: existing.id },
      data: { content, fileUrl, submittedAt: new Date(), status: "SUBMITTED" },
    });
    return { data: updated };
  }

  const submission = await db.homeworkSubmission.create({
    data: { schoolId: ctx.schoolId, homeworkId, studentId, content, fileUrl },
  });

  return { data: submission };
}

export async function gradeHomeworkAction(
  submissionId: string,
  score: number,
  feedback?: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOMEWORK_GRADE);
  if (denied) return denied;

  const submission = await db.homeworkSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) return { error: "Submission not found." };

  const updated = await db.homeworkSubmission.update({
    where: { id: submissionId },
    data: {
      score,
      feedback,
      gradedBy: ctx.session.user.id,
      gradedAt: new Date(),
      status: "GRADED",
    },
  });

  return { data: updated };
}

export async function getHomeworkSubmissionsAction(homeworkId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOMEWORK_READ);
  if (denied) return denied;

  const submissions = await db.homeworkSubmission.findMany({
    where: { homeworkId },
    orderBy: { submittedAt: "desc" },
  });

  const studentIds = submissions.map((s) => s.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const data = submissions.map((s) => {
    const student = studentMap.get(s.studentId);
    return {
      ...s,
      studentIdNumber: student?.studentId ?? "",
      studentName: student ? `${student.lastName} ${student.firstName}` : "Unknown",
    };
  });

  return { data };
}
