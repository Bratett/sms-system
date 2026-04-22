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
  void programmeFilter; // will be used by upcoming loaders — suppresses lint warning

  let wasCacheMiss = false;
  const payload = await getCached<StudentAnalyticsPayload>(cacheKey, async () => {
    wasCacheMiss = true;
    const kpis = await loadKpis(
      ctx.schoolId,
      year.id,
      year.startDate,
      year.endDate,
      parsed.data.programmeId,
    );
    return {
      computedAt: new Date(),
      cached: false,
      kpis,
      enrollmentTrend: [],
      demographics: { byGender: [], byRegion: [], byReligion: [], total: 0 },
      retention: { cohorts: [] },
      freeShs: { freeShsCount: 0, payingCount: 0, freeShsPct: 0 },
      atRisk: { byLevel: [], topStudents: [], hasAnyProfiles: false, computedAt: null },
    };
  });

  return { data: { ...payload, cached: !wasCacheMiss } };
}
