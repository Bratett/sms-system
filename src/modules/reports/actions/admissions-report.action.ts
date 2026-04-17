"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

export async function getAdmissionsReportAction(filters?: {
  academicYearId?: string;
  status?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORTS_ENROLLMENT_READ);
  if (denied) return denied;

  // Determine academic year
  let academicYearId = filters?.academicYearId;
  if (!academicYearId) {
    const current = await db.academicYear.findFirst({
      where: { schoolId: ctx.schoolId, isCurrent: true },
    });
    academicYearId = current?.id;
  }

  if (!academicYearId) {
    return { error: "No academic year found." };
  }

  const where: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    academicYearId,
  };
  if (filters?.status) {
    where.status = filters.status;
  }

  // Total applications
  const totalApplications = await db.admissionApplication.count({ where });

  // By status
  const byStatusRaw = await db.admissionApplication.groupBy({
    by: ["status"],
    where: { schoolId: ctx.schoolId, academicYearId },
    _count: { _all: true },
  });

  const statusLabels = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "SHORTLISTED",
    "ACCEPTED",
    "REJECTED",
    "ENROLLED",
    "DRAFT",
    "CANCELLED",
  ];
  const byStatus = statusLabels.map((s) => ({
    status: s,
    count: byStatusRaw.find((r) => r.status === s)?._count._all ?? 0,
  }));

  // By gender
  const byGenderRaw = await db.admissionApplication.groupBy({
    by: ["gender"],
    where,
    _count: { _all: true },
  });
  const byGender = {
    MALE: byGenderRaw.find((r) => r.gender === "MALE")?._count._all ?? 0,
    FEMALE: byGenderRaw.find((r) => r.gender === "FEMALE")?._count._all ?? 0,
  };

  // By programme preference
  const applications = await db.admissionApplication.findMany({
    where,
    select: {
      programmePreference1Id: true,
    },
  });

  const prefCounts = new Map<string, number>();
  for (const app of applications) {
    const prefId = app.programmePreference1Id;
    if (prefId) {
      prefCounts.set(prefId, (prefCounts.get(prefId) || 0) + 1);
    }
  }

  const programmeIds = [...prefCounts.keys()];
  let programmeMap = new Map<string, string>();
  if (programmeIds.length > 0) {
    const programmes = await db.programme.findMany({
      where: { id: { in: programmeIds } },
      select: { id: true, name: true },
    });
    programmeMap = new Map(programmes.map((p) => [p.id, p.name]));
  }

  const byProgramme = [...prefCounts.entries()]
    .map(([id, count]) => ({
      programme: programmeMap.get(id) ?? "Unknown",
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Conversion rate: enrolled / total
  const enrolledCount =
    byStatusRaw.find((r) => r.status === "ENROLLED")?._count._all ?? 0;
  const totalForConversion = await db.admissionApplication.count({
    where: { schoolId: ctx.schoolId, academicYearId },
  });
  const conversionRate =
    totalForConversion > 0
      ? Math.round((enrolledCount / totalForConversion) * 100 * 100) / 100
      : 0;

  // Recent applications (last 20)
  const recentApplications = await db.admissionApplication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      applicationNumber: true,
      firstName: true,
      lastName: true,
      gender: true,
      status: true,
      submittedAt: true,
    },
  });

  return {
    data: {
      totalApplications,
      byStatus,
      byGender,
      byProgramme,
      conversionRate,
      recentApplications,
    },
  };
}
