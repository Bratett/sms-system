"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Suggest Awards Based on Results ─────────────────────────────────

export async function suggestAwardsAction(
  classArmId: string,
  termId: string,
  academicYearId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.AWARDS_READ);
  if (denied) return denied;

  const results = await db.terminalResult.findMany({
    where: { classArmId, termId, academicYearId },
    include: {
      subjectResults: {
        include: { subject: { select: { id: true, name: true } } },
      },
    },
    orderBy: { averageScore: "desc" },
  });

  if (results.length === 0) return { data: [] };

  const suggestions: Array<{
    type: string;
    title: string;
    studentId: string;
    studentName?: string;
    subjectId?: string;
    subjectName?: string;
    score: number;
  }> = [];

  // Get student names
  const studentIds = results.map((r) => r.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // Best Student (highest average)
  const best = results[0];
  const bestStudent = studentMap.get(best.studentId);
  suggestions.push({
    type: "BEST_STUDENT",
    title: "Best Student",
    studentId: best.studentId,
    studentName: bestStudent ? `${bestStudent.lastName} ${bestStudent.firstName}` : undefined,
    score: best.averageScore ?? 0,
  });

  // Best in each Subject
  const subjectBest = new Map<string, { studentId: string; score: number; subjectName: string }>();
  for (const result of results) {
    for (const sr of result.subjectResults) {
      const current = subjectBest.get(sr.subjectId);
      if (!current || (sr.totalScore ?? 0) > current.score) {
        subjectBest.set(sr.subjectId, {
          studentId: result.studentId,
          score: sr.totalScore ?? 0,
          subjectName: sr.subject.name,
        });
      }
    }
  }
  for (const [subjectId, data] of subjectBest) {
    const student = studentMap.get(data.studentId);
    suggestions.push({
      type: "BEST_IN_SUBJECT",
      title: `Best in ${data.subjectName}`,
      studentId: data.studentId,
      studentName: student ? `${student.lastName} ${student.firstName}` : undefined,
      subjectId,
      subjectName: data.subjectName,
      score: data.score,
    });
  }

  // Most Improved (compare with previous term)
  const prevTermResults = await db.terminalResult.findMany({
    where: {
      classArmId,
      academicYearId,
      termId: { not: termId },
    },
    select: { studentId: true, averageScore: true, termId: true },
    orderBy: { termId: "desc" },
  });

  if (prevTermResults.length > 0) {
    const prevScores = new Map<string, number>();
    for (const pr of prevTermResults) {
      if (!prevScores.has(pr.studentId)) {
        prevScores.set(pr.studentId, pr.averageScore ?? 0);
      }
    }

    let maxImprovement = 0;
    let mostImprovedId = "";
    for (const result of results) {
      const prev = prevScores.get(result.studentId);
      if (prev !== undefined) {
        const improvement = (result.averageScore ?? 0) - prev;
        if (improvement > maxImprovement) {
          maxImprovement = improvement;
          mostImprovedId = result.studentId;
        }
      }
    }

    if (mostImprovedId && maxImprovement > 0) {
      const student = studentMap.get(mostImprovedId);
      suggestions.push({
        type: "MOST_IMPROVED",
        title: "Most Improved Student",
        studentId: mostImprovedId,
        studentName: student ? `${student.lastName} ${student.firstName}` : undefined,
        score: maxImprovement,
      });
    }
  }

  return { data: suggestions };
}

// ─── Award CRUD ──────────────────────────────────────────────────────

export async function createAwardAction(data: {
  studentId: string;
  academicYearId: string;
  termId?: string;
  type: string;
  title: string;
  description?: string;
  subjectId?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.AWARDS_CREATE);
  if (denied) return denied;

  const award = await db.academicAward.create({
    data: {
      studentId: data.studentId,
      schoolId: ctx.schoolId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      type: data.type as any,
      title: data.title,
      description: data.description,
      subjectId: data.subjectId,
      awardedBy: ctx.session.user.id!,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "AcademicAward",
    entityId: award.id,
    module: "academics",
    description: `Awarded: ${data.title} to student ${data.studentId}`,
  });

  return { data: award };
}

export async function deleteAwardAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.AWARDS_CREATE);
  if (denied) return denied;

  await db.academicAward.delete({ where: { id } });
  return { data: { deleted: true } };
}

export async function getStudentAwardsAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.AWARDS_READ);
  if (denied) return denied;

  const awards = await db.academicAward.findMany({
    where: { studentId },
    include: { subject: { select: { name: true } } },
    orderBy: { awardedAt: "desc" },
  });

  return { data: awards };
}

export async function getAwardsAction(filters?: {
  academicYearId?: string;
  termId?: string;
  type?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.AWARDS_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters?.termId) where.termId = filters.termId;
  if (filters?.type) where.type = filters.type;

  const awards = await db.academicAward.findMany({
    where,
    include: { subject: { select: { name: true } } },
    orderBy: { awardedAt: "desc" },
  });

  const studentIds = [...new Set(awards.map((a) => a.studentId))];
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const data = awards.map((a) => {
    const student = studentMap.get(a.studentId);
    return {
      ...a,
      studentIdNumber: student?.studentId ?? "",
      studentName: student ? `${student.lastName} ${student.firstName}` : "Unknown",
      subjectName: a.subject?.name ?? null,
    };
  });

  return { data };
}
