"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

// ─── Get Student Performance Trends ──────────────────────────────────

export async function getStudentPerformanceTrendsAction(
  studentId: string,
  academicYearId?: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { studentId };
  if (academicYearId) {
    where.academicYearId = academicYearId;
  }

  const results = await db.terminalResult.findMany({
    where,
    orderBy: [{ academicYearId: "asc" }, { termId: "asc" }],
    include: {
      subjectResults: {
        include: {
          subject: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (results.length === 0) {
    return { data: [] };
  }

  const termIds = [...new Set(results.map((r) => r.termId))];
  const terms = await db.term.findMany({
    where: { id: { in: termIds } },
    include: { academicYear: { select: { name: true } } },
  });
  const termMap = new Map(terms.map((t) => [t.id, t]));

  const data = results.map((r) => {
    const term = termMap.get(r.termId);
    return {
      termId: r.termId,
      termName: term?.name ?? "",
      termNumber: term?.termNumber ?? 0,
      academicYear: term?.academicYear?.name ?? "",
      academicYearId: r.academicYearId,
      averageScore: r.averageScore,
      totalScore: r.totalScore,
      position: r.classPosition,
      overallGrade: r.overallGrade,
      subjectScores: r.subjectResults.map((sr) => ({
        subjectId: sr.subjectId,
        subjectName: sr.subject.name,
        totalScore: sr.totalScore,
        grade: sr.grade,
        position: sr.position,
      })),
    };
  });

  return { data };
}

// ─── Get Class Performance Trends ────────────────────────────────────

export async function getClassPerformanceTrendsAction(
  classArmId: string,
  academicYearId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_READ);
  if (denied) return denied;

  const terms = await db.term.findMany({
    where: { academicYearId },
    orderBy: { termNumber: "asc" },
  });

  const trends = [];

  for (const term of terms) {
    const results = await db.terminalResult.findMany({
      where: { classArmId, termId: term.id, academicYearId },
      select: { averageScore: true },
    });

    const averages = results
      .map((r) => r.averageScore ?? 0)
      .filter((a) => a > 0);

    const classAverage = averages.length > 0
      ? Math.round((averages.reduce((s, a) => s + a, 0) / averages.length) * 100) / 100
      : 0;

    trends.push({
      termId: term.id,
      termName: term.name,
      termNumber: term.termNumber,
      studentCount: results.length,
      classAverage,
      highest: averages.length > 0 ? Math.max(...averages) : 0,
      lowest: averages.length > 0 ? Math.min(...averages) : 0,
    });
  }

  return { data: trends };
}
