"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { getCached } from "@/lib/analytics-cache";
import { getStudentAnalyticsSchema } from "../schemas/analytics.schema";

export type StudentAnalyticsPayload = {
  computedAt: Date;
  cached: boolean;
  kpis: {
    totalActive: number;
    dayStudents: number;
    boardingStudents: number;
    freeShsCount: number;
    atRiskCount: number;
    graduatedThisYear: number;
    withdrawnThisYear: number;
  };
  enrollmentTrend: Array<{
    academicYearId: string;
    academicYearName: string;
    active: number;
    promoted: number;
    withdrawn: number;
    graduated: number;
    transferred: number;
    total: number;
  }>;
  demographics: {
    byGender: Array<{ gender: "MALE" | "FEMALE"; count: number; percentage: number }>;
    byRegion: Array<{ region: string; count: number; percentage: number }>;
    byReligion: Array<{ religion: string; count: number; percentage: number }>;
    total: number;
  };
  retention: {
    cohorts: Array<{
      yearGroup: number;
      academicYearName: string;
      startingCount: number;
      retainedCount: number;
      retentionPct: number;
    }>;
  };
  freeShs: {
    freeShsCount: number;
    payingCount: number;
    freeShsPct: number;
  };
  atRisk: {
    byLevel: Array<{ riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL"; count: number }>;
    topStudents: Array<{
      studentId: string;
      studentCode: string;
      firstName: string;
      lastName: string;
      riskScore: number;
      riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
    }>;
    hasAnyProfiles: boolean;
    computedAt: Date | null;
  };
};

async function loadKpis(
  schoolId: string,
  academicYearId: string,
  academicYearStart: Date,
  academicYearEnd: Date,
  programmeId?: string,
): Promise<StudentAnalyticsPayload["kpis"]> {
  // When a programme is selected, scope student-level counts to students
  // currently enrolled in that programme for the given academic year.
  const studentProgrammeFilter: Prisma.StudentWhereInput = programmeId
    ? {
        enrollments: {
          some: {
            academicYearId,
            classArm: { class: { programmeId } },
          },
        },
      }
    : {};

  // Scope enrollment-level counts (Free SHS) to the selected programme.
  const enrollmentProgrammeFilter: Prisma.EnrollmentWhereInput = programmeId
    ? { classArm: { class: { programmeId } } }
    : {};

  // When a programme is selected, resolve the set of student IDs enrolled in
  // that programme for the year upfront, so risk profiles (which have no
  // Prisma relation back to Student) can be scoped by studentId.
  let programmeScopedStudentIds: string[] | undefined;
  if (programmeId) {
    const enrollments = await db.enrollment.findMany({
      where: { schoolId, academicYearId, classArm: { class: { programmeId } } },
      select: { studentId: true },
    });
    programmeScopedStudentIds = enrollments.map((e) => e.studentId);
  }

  const riskProgrammeFilter: Prisma.StudentRiskProfileWhereInput =
    programmeScopedStudentIds !== undefined
      ? { studentId: { in: programmeScopedStudentIds } }
      : {};

  const [
    totalActive,
    dayStudents,
    boardingStudents,
    graduatedThisYear,
    withdrawnThisYear,
    freeShsCount,
    atRiskCount,
  ] = await Promise.all([
    db.student.count({ where: { schoolId, status: "ACTIVE", ...studentProgrammeFilter } }),
    db.student.count({ where: { schoolId, status: "ACTIVE", boardingStatus: "DAY", ...studentProgrammeFilter } }),
    db.student.count({ where: { schoolId, status: "ACTIVE", boardingStatus: "BOARDING", ...studentProgrammeFilter } }),
    db.student.count({
      where: { schoolId, status: "GRADUATED", updatedAt: { gte: academicYearStart, lte: academicYearEnd }, ...studentProgrammeFilter },
    }),
    db.student.count({
      where: { schoolId, status: "WITHDRAWN", updatedAt: { gte: academicYearStart, lte: academicYearEnd }, ...studentProgrammeFilter },
    }),
    db.enrollment.count({
      where: {
        schoolId,
        academicYearId,
        isFreeShsPlacement: true,
        status: "ACTIVE",
        ...enrollmentProgrammeFilter,
      },
    }),
    db.studentRiskProfile.count({
      where: { schoolId, academicYearId, riskLevel: { in: ["HIGH", "CRITICAL"] }, ...riskProgrammeFilter },
    }),
  ]);

  return {
    totalActive,
    dayStudents,
    boardingStudents,
    freeShsCount,
    atRiskCount,
    graduatedThisYear,
    withdrawnThisYear,
  };
}

async function loadEnrollmentTrend(
  schoolId: string,
  programmeFilter: Record<string, unknown>,
): Promise<StudentAnalyticsPayload["enrollmentTrend"]> {
  // Last 5 academic years, oldest first for chart display.
  const years = await db.academicYear.findMany({
    where: { schoolId },
    orderBy: { startDate: "desc" },
    take: 5,
    select: { id: true, name: true, startDate: true },
  });
  if (years.length === 0) return [];
  const chronologicalYears = [...years].reverse(); // chronological copy — avoids mutating shared mock reference

  const grouped = await Promise.all(
    chronologicalYears.map((y) =>
      db.enrollment.groupBy({
        by: ["status"],
        where: { schoolId, academicYearId: y.id, ...programmeFilter },
        _count: { _all: true },
      }),
    ),
  );

  return chronologicalYears.map((year, idx) => {
    const rows = grouped[idx] ?? [];
    const by = (status: string) =>
      rows.find((r) => r.status === status)?._count._all ?? 0;
    const active = by("ACTIVE");
    const promoted = by("PROMOTED");
    const withdrawn = by("WITHDRAWN");
    const graduated = by("COMPLETED");
    const transferred = by("TRANSFERRED");
    return {
      academicYearId: year.id,
      academicYearName: year.name,
      active,
      promoted,
      withdrawn,
      graduated,
      transferred,
      total: active + promoted + withdrawn + graduated + transferred,
    };
  });
}

function rollupWithOther<K extends string>(
  counts: Map<string, number>,
  total: number,
  topN: number,
  keyName: K,
): Array<Record<K, string> & { count: number; percentage: number }> {
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const head = entries.slice(0, topN);
  const tail = entries.slice(topN);
  const tailCount = tail.reduce((sum, [, c]) => sum + c, 0);
  const out = head.map(([key, count]) => ({
    [keyName]: key,
    count,
    percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
  })) as Array<Record<K, string> & { count: number; percentage: number }>;
  if (tailCount > 0) {
    out.push({
      [keyName]: "Other",
      count: tailCount,
      percentage: total > 0 ? Math.round((tailCount / total) * 1000) / 10 : 0,
    } as Record<K, string> & { count: number; percentage: number });
  }
  return out;
}

async function loadDemographics(
  schoolId: string,
  academicYearId: string,
  programmeFilter: Record<string, unknown>,
): Promise<StudentAnalyticsPayload["demographics"]> {
  const enrollments = await db.enrollment.findMany({
    where: {
      schoolId,
      academicYearId,
      status: "ACTIVE",
      ...programmeFilter,
    },
    select: {
      student: {
        select: { gender: true, region: true, religion: true },
      },
    },
  });

  const total = enrollments.length;
  const genderCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  const religionCounts = new Map<string, number>();

  for (const { student } of enrollments) {
    genderCounts.set(student.gender, (genderCounts.get(student.gender) ?? 0) + 1);
    const region = student.region ?? "Unspecified";
    regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
    const religion = student.religion ?? "Unspecified";
    religionCounts.set(religion, (religionCounts.get(religion) ?? 0) + 1);
  }

  const byGender = Array.from(genderCounts.entries()).map(([gender, count]) => ({
    gender: gender as "MALE" | "FEMALE",
    count,
    percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
  }));
  const byRegion = rollupWithOther(regionCounts, total, 10, "region");
  const byReligion = rollupWithOther(religionCounts, total, 8, "religion");

  return { byGender, byRegion, byReligion, total };
}

async function loadRetention(
  schoolId: string,
  programmeFilter: Record<string, unknown>,
): Promise<StudentAnalyticsPayload["retention"]> {
  // Load last 4 academic years (need pairs — so up to 3 cohort transitions).
  const years = await db.academicYear.findMany({
    where: { schoolId },
    orderBy: { startDate: "desc" },
    take: 4,
    select: { id: true, name: true, startDate: true },
  });
  if (years.length < 2) return { cohorts: [] };
  const chronological = [...years].reverse(); // chronological copy

  const cohorts: StudentAnalyticsPayload["retention"]["cohorts"] = [];

  for (let i = 0; i < chronological.length - 1; i++) {
    const baseYear = chronological[i]!;
    const nextYear = chronological[i + 1]!;
    const baseEnrollments = await db.enrollment.findMany({
      where: {
        schoolId,
        academicYearId: baseYear.id,
        status: "ACTIVE",
        ...programmeFilter,
      },
      select: {
        studentId: true,
        classArm: { select: { class: { select: { yearGroup: true } } } },
      },
    });
    if (baseEnrollments.length === 0) continue;

    const byYearGroup = new Map<number, string[]>();
    for (const e of baseEnrollments) {
      const yg = e.classArm.class.yearGroup;
      if (!byYearGroup.has(yg)) byYearGroup.set(yg, []);
      byYearGroup.get(yg)!.push(e.studentId);
    }

    for (const [yearGroup, studentIds] of byYearGroup) {
      const retained = await db.enrollment.findMany({
        where: {
          schoolId,
          academicYearId: nextYear.id,
          status: "ACTIVE",
          studentId: { in: studentIds },
        },
        select: { studentId: true },
      });
      const startingCount = studentIds.length;
      const retainedCount = retained.length;
      cohorts.push({
        yearGroup,
        academicYearName: baseYear.name,
        startingCount,
        retainedCount,
        retentionPct: startingCount > 0
          ? Math.round((retainedCount / startingCount) * 1000) / 10
          : 0,
      });
    }
  }

  cohorts.sort((a, b) =>
    a.academicYearName.localeCompare(b.academicYearName) || a.yearGroup - b.yearGroup,
  );

  return { cohorts };
}

async function loadFreeShs(
  schoolId: string,
  academicYearId: string,
  programmeFilter: Record<string, unknown>,
): Promise<StudentAnalyticsPayload["freeShs"]> {
  const rows = await db.enrollment.groupBy({
    by: ["isFreeShsPlacement"],
    where: {
      schoolId,
      academicYearId,
      status: "ACTIVE",
      ...programmeFilter,
    },
    _count: { _all: true },
  });
  const freeShsCount = rows.find((r) => r.isFreeShsPlacement)?._count._all ?? 0;
  const payingCount = rows.find((r) => !r.isFreeShsPlacement)?._count._all ?? 0;
  const total = freeShsCount + payingCount;
  return {
    freeShsCount,
    payingCount,
    freeShsPct: total > 0 ? Math.round((freeShsCount / total) * 1000) / 10 : 0,
  };
}

async function loadAtRisk(
  schoolId: string,
  academicYearId: string,
): Promise<StudentAnalyticsPayload["atRisk"]> {
  const [byLevelRaw, topRaw, agg] = await Promise.all([
    db.studentRiskProfile.groupBy({
      by: ["riskLevel"],
      where: { schoolId, academicYearId },
      _count: { _all: true },
    }),
    db.studentRiskProfile.findMany({
      where: { schoolId, academicYearId },
      orderBy: { riskScore: "desc" },
      take: 10,
      select: { studentId: true, riskScore: true, riskLevel: true },
    }),
    db.studentRiskProfile.aggregate({
      where: { schoolId, academicYearId },
      _max: { computedAt: true },
    }),
  ]);

  // Two-step: StudentRiskProfile has no Prisma relation to Student.
  // Batch-fetch the students referenced by the top profiles.
  const studentIds = topRaw.map((r) => r.studentId);
  const students =
    studentIds.length > 0
      ? await db.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, studentId: true, firstName: true, lastName: true },
        })
      : [];
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const byLevel = byLevelRaw.map((r) => ({
    riskLevel: r.riskLevel as "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
    count: r._count._all,
  }));
  const topStudents = topRaw.flatMap((r) => {
    const s = studentMap.get(r.studentId);
    if (!s) return [];
    return [
      {
        studentId: s.id,
        studentCode: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        riskScore: r.riskScore,
        riskLevel: r.riskLevel as "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
      },
    ];
  });
  const totalProfiles = byLevel.reduce((sum, x) => sum + x.count, 0);
  return {
    byLevel,
    topStudents,
    hasAnyProfiles: totalProfiles > 0,
    computedAt: agg._max.computedAt ?? null,
  };
}

/**
 * @no-audit Read-only analytics aggregation. No side effects.
 */
export async function getStudentAnalyticsAction(input: {
  academicYearId?: string;
  programmeId?: string;
}): Promise<{ data: StudentAnalyticsPayload } | { error: string }> {
  const parsed = getStudentAnalyticsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_ANALYTICS_READ);
  if (denied) return denied;

  const year = parsed.data.academicYearId
    ? await db.academicYear.findFirst({ where: { id: parsed.data.academicYearId, schoolId: ctx.schoolId } })
    : await db.academicYear.findFirst({ where: { schoolId: ctx.schoolId, isCurrent: true } });
  if (!year) return { error: "No current academic year set" };

  const cacheKey = `analytics:${ctx.schoolId}:${year.id}:${parsed.data.programmeId ?? "all"}`;
  // programmeFilter (enrollment-side shape) is kept for future loaders such as
  // loadEnrollmentTrend and loadDemographics which receive it directly.
  const programmeFilter: Record<string, unknown> = parsed.data.programmeId
    ? { classArm: { class: { programmeId: parsed.data.programmeId } } }
    : {};
  let wasCacheMiss = false;
  const payload = await getCached<StudentAnalyticsPayload>(cacheKey, async () => {
    wasCacheMiss = true;
    const [kpis, enrollmentTrend, demographics, retention, freeShs, atRisk] = await Promise.all([
      loadKpis(ctx.schoolId, year.id, year.startDate, year.endDate, parsed.data.programmeId),
      loadEnrollmentTrend(ctx.schoolId, programmeFilter),
      loadDemographics(ctx.schoolId, year.id, programmeFilter),
      loadRetention(ctx.schoolId, programmeFilter),
      loadFreeShs(ctx.schoolId, year.id, programmeFilter),
      loadAtRisk(ctx.schoolId, year.id),
    ]);
    return {
      computedAt: new Date(),
      cached: false,
      kpis,
      enrollmentTrend,
      demographics,
      retention,
      freeShs,
      atRisk,
    };
  });

  return { data: { ...payload, cached: !wasCacheMiss } };
}
