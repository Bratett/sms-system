"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

const COMPLETENESS_FIELDS = [
  "email",
  "phone",
  "currentEmployer",
  "currentPosition",
  "industry",
  "highestEducation",
  "linkedinUrl",
  "bio",
] as const;

function computeProfileCompleteness(profile: Record<string, unknown>): number {
  let count = 0;
  for (const field of COMPLETENESS_FIELDS) {
    const value = profile[field];
    if (value !== null && value !== undefined && value !== "") count += 1;
  }
  return Math.round((count / COMPLETENESS_FIELDS.length) * 100);
}

/** @no-audit Read-only admin dashboard. */
export async function getAlumniDashboardAction(filters?: {
  search?: string;
  graduationYear?: number;
  industry?: string;
  status?: "all" | "public" | "private" | "incomplete" | "needs_invite";
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.graduationYear) where.graduationYear = filters.graduationYear;
  if (filters?.industry) {
    where.industry = { contains: filters.industry, mode: "insensitive" };
  }
  if (filters?.status === "public") where.isPublic = true;
  if (filters?.status === "private") where.isPublic = false;
  if (filters?.status === "incomplete") {
    where.bio = null;
    where.currentEmployer = null;
  }

  if (filters?.search) {
    const matchingStudents = await db.student.findMany({
      where: {
        status: "GRADUATED",
        schoolId: ctx.schoolId,
        OR: [
          { firstName: { contains: filters.search, mode: "insensitive" } },
          { lastName: { contains: filters.search, mode: "insensitive" } },
          { studentId: { contains: filters.search, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    where.studentId = { in: matchingStudents.map((s) => s.id) };
  }

  const [profiles, total, allProfiles] = await Promise.all([
    db.alumniProfile.findMany({
      where,
      orderBy: { graduationYear: "desc" },
      skip,
      take: pageSize,
    }),
    db.alumniProfile.count({ where }),
    db.alumniProfile.findMany({
      where: { schoolId: ctx.schoolId },
      select: {
        graduationYear: true,
        industry: true,
        isPublic: true,
        studentId: true,
      },
    }),
  ]);

  const pageStudentIds = profiles.map((p) => p.studentId);
  const pageStudents = await db.student.findMany({
    where: { id: { in: pageStudentIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentId: true,
      photoUrl: true,
      userId: true,
    },
  });
  const pageStudentMap = new Map(pageStudents.map((s) => [s.id, s]));

  let rows = profiles.map((p) => {
    const student = pageStudentMap.get(p.studentId);
    return {
      ...p,
      firstName: student?.firstName ?? "Unknown",
      lastName: student?.lastName ?? "",
      studentCode: student?.studentId ?? "",
      photoUrl: student?.photoUrl ?? null,
      needsInvite: !student?.userId,
      profileCompleteness: computeProfileCompleteness(p as unknown as Record<string, unknown>),
    };
  });

  // Apply needs_invite filter post-join (userId is on Student, not AlumniProfile)
  if (filters?.status === "needs_invite") {
    rows = rows.filter((r) => r.needsInvite);
  }

  // Aggregates computed across the school (not the filtered page)
  const aggTotal = allProfiles.length;
  const publicCount = allProfiles.filter((p) => p.isPublic).length;
  const privateCount = aggTotal - publicCount;

  const allStudentIds = allProfiles.map((p) => p.studentId);
  const allStudents = await db.student.findMany({
    where: { id: { in: allStudentIds } },
    select: { id: true, userId: true },
  });
  const userIdMap = new Map(allStudents.map((s) => [s.id, s.userId]));
  const needsInviteCount = allProfiles.filter((p) => !userIdMap.get(p.studentId)).length;

  const byYearMap = new Map<number, number>();
  for (const p of allProfiles) {
    byYearMap.set(p.graduationYear, (byYearMap.get(p.graduationYear) ?? 0) + 1);
  }
  const byYear = [...byYearMap.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year);

  const industryMap = new Map<string, number>();
  for (const p of allProfiles) {
    if (!p.industry) continue;
    industryMap.set(p.industry, (industryMap.get(p.industry) ?? 0) + 1);
  }
  const topIndustries = [...industryMap.entries()]
    .map(([industry, count]) => ({ industry, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    data: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    aggregates: {
      total: aggTotal,
      publicCount,
      privateCount,
      needsInviteCount,
      byYear,
      topIndustries,
    },
  };
}
