"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  computeStudentRiskProfiles,
  generatePerformanceNarrative,
  detectAttendanceAnomalies,
} from "@/lib/ai/analytics-engine";

export async function computeRiskProfilesAction(data: {
  academicYearId: string;
  termId: string;
  classArmId?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ANALYTICS_READ);
  if (denied) return denied;

  const assessments = await computeStudentRiskProfiles(
    ctx.schoolId,
    data.academicYearId,
    data.termId,
    data.classArmId,
  );

  // Save risk profiles to database
  for (const assessment of assessments) {
    await db.studentRiskProfile.upsert({
      where: {
        studentId_academicYearId_termId: {
          studentId: assessment.studentId,
          academicYearId: data.academicYearId,
          termId: data.termId,
        },
      },
      create: {
        studentId: assessment.studentId,
        schoolId: ctx.schoolId,
        academicYearId: data.academicYearId,
        termId: data.termId,
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        factors: assessment.factors as unknown as import("@prisma/client").Prisma.InputJsonValue,
        recommendations: assessment.recommendations as unknown as import("@prisma/client").Prisma.InputJsonValue,
        performanceTrend: assessment.performanceTrend,
        predictedAverage: assessment.predictedAverage,
      },
      update: {
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        factors: assessment.factors as unknown as import("@prisma/client").Prisma.InputJsonValue,
        recommendations: assessment.recommendations as unknown as import("@prisma/client").Prisma.InputJsonValue,
        performanceTrend: assessment.performanceTrend,
        predictedAverage: assessment.predictedAverage,
      },
    });
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "StudentRiskProfile",
    module: "ai",
    description: `Computed risk profiles for ${assessments.length} students`,
  });

  const summary = {
    total: assessments.length,
    critical: assessments.filter((a) => a.riskLevel === "CRITICAL").length,
    high: assessments.filter((a) => a.riskLevel === "HIGH").length,
    moderate: assessments.filter((a) => a.riskLevel === "MODERATE").length,
    low: assessments.filter((a) => a.riskLevel === "LOW").length,
  };

  return { data: { assessments, summary } };
}

export async function getRiskProfilesAction(filters: {
  academicYearId: string;
  termId: string;
  classArmId?: string;
  riskLevel?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ANALYTICS_READ);
  if (denied) return denied;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;

  const where: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    academicYearId: filters.academicYearId,
    termId: filters.termId,
  };

  if (filters.riskLevel) where.riskLevel = filters.riskLevel;

  const [profiles, total] = await Promise.all([
    db.studentRiskProfile.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { riskScore: "desc" },
    }),
    db.studentRiskProfile.count({ where }),
  ]);

  // Enrich with student names
  const studentIds = profiles.map((p) => p.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const enriched = profiles.map((p) => ({
    ...p,
    student: studentMap.get(p.studentId) ?? null,
  }));

  return { data: enriched, total, page, pageSize };
}

export async function getClassPerformanceNarrativeAction(data: {
  classArmId: string;
  termId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ANALYTICS_READ);
  if (denied) return denied;

  // Get class info
  const classArm = await db.classArm.findUnique({
    where: { id: data.classArmId },
    include: { class: { select: { name: true } } },
  });
  if (!classArm) return { error: "Class arm not found" };

  const term = await db.term.findUnique({
    where: { id: data.termId },
    select: { name: true },
  });
  if (!term) return { error: "Term not found" };

  // Get results for this class arm
  const results = await db.terminalResult.findMany({
    where: { classArmId: data.classArmId, termId: data.termId },
    include: { subjectResults: { include: { subject: { select: { name: true } } } } },
  });

  if (results.length === 0) return { error: "No results found for this class and term" };

  const scores = results.map((r) => r.averageScore ?? 0);
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const passRate = (scores.filter((s) => s >= 50).length / scores.length) * 100;

  // Get subject averages
  const subjectScores = new Map<string, { name: string; scores: number[] }>();
  for (const result of results) {
    for (const sr of result.subjectResults) {
      if (sr.totalScore == null) continue;
      const existing = subjectScores.get(sr.subjectId) ?? { name: sr.subject.name, scores: [] };
      existing.scores.push(sr.totalScore);
      subjectScores.set(sr.subjectId, existing);
    }
  }

  const subjectAverages = [...subjectScores.values()].map((s) => ({
    name: s.name,
    average: s.scores.reduce((a, b) => a + b, 0) / s.scores.length,
  }));

  const topSubject = subjectAverages.sort((a, b) => b.average - a.average)[0] ?? null;
  const weakestSubject = subjectAverages.sort((a, b) => a.average - b.average)[0] ?? null;

  // Get risk profiles
  const riskProfiles = await db.studentRiskProfile.findMany({
    where: { termId: data.termId, studentId: { in: results.map((r) => r.studentId) } },
  });

  const narrative = generatePerformanceNarrative({
    className: `${classArm.class.name} ${classArm.name}`,
    termName: term.name,
    totalStudents: results.length,
    averageScore,
    passRate,
    topSubject,
    weakestSubject,
    criticalCount: riskProfiles.filter((r) => r.riskLevel === "CRITICAL").length,
    highRiskCount: riskProfiles.filter((r) => r.riskLevel === "HIGH").length,
  });

  return { data: { narrative, averageScore, passRate, topSubject, weakestSubject } };
}

export async function getAttendanceAnomaliesAction(termId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ANALYTICS_READ);
  if (denied) return denied;

  const anomalies = await detectAttendanceAnomalies(ctx.schoolId, termId);

  // Enrich with student names
  const studentIds = [...new Set(anomalies.map((a) => a.studentId))];
  const students = await db.student.findMany({
    where: { id: { in: studentIds }, schoolId: ctx.schoolId },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const enriched = anomalies.map((a) => ({
    ...a,
    student: studentMap.get(a.studentId) ?? null,
  }));

  return { data: enriched };
}

export async function getAiDashboardAction(data: {
  academicYearId: string;
  termId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ANALYTICS_READ);
  if (denied) return denied;

  const [riskProfiles, totalStudents] = await Promise.all([
    db.studentRiskProfile.findMany({
      where: {
        schoolId: ctx.schoolId,
        academicYearId: data.academicYearId,
        termId: data.termId,
      },
    }),
    db.student.count({ where: { schoolId: ctx.schoolId, status: "ACTIVE" } }),
  ]);

  const riskDistribution = {
    critical: riskProfiles.filter((r) => r.riskLevel === "CRITICAL").length,
    high: riskProfiles.filter((r) => r.riskLevel === "HIGH").length,
    moderate: riskProfiles.filter((r) => r.riskLevel === "MODERATE").length,
    low: riskProfiles.filter((r) => r.riskLevel === "LOW").length,
  };

  const avgRiskScore = riskProfiles.length > 0
    ? riskProfiles.reduce((sum, r) => sum + r.riskScore, 0) / riskProfiles.length
    : 0;

  const trendDistribution = {
    improving: riskProfiles.filter((r) => r.performanceTrend === "IMPROVING").length,
    stable: riskProfiles.filter((r) => r.performanceTrend === "STABLE").length,
    declining: riskProfiles.filter((r) => r.performanceTrend === "DECLINING").length,
  };

  return {
    data: {
      totalStudents,
      profilesComputed: riskProfiles.length,
      riskDistribution,
      avgRiskScore: Math.round(avgRiskScore * 10) / 10,
      trendDistribution,
      needsAttention: riskDistribution.critical + riskDistribution.high,
    },
  };
}
