"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

export type CensusGroupBy = "class" | "programme" | "region" | "gender" | "boarding" | "religion";

export interface CensusRow {
  groupKey: string;
  groupLabel: string;
  total: number;
  male: number;
  female: number;
  day: number;
  boarding: number;
}

export async function getStudentCensusAction(filters: {
  academicYearId?: string;
  groupBy: CensusGroupBy;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORTS_ENROLLMENT_READ);
  if (denied) return denied;

  let academicYearId = filters.academicYearId;
  if (!academicYearId) {
    const current = await db.academicYear.findFirst({
      where: { schoolId: ctx.schoolId, isCurrent: true },
    });
    academicYearId = current?.id;
  }
  if (!academicYearId) return { error: "No academic year found." };

  const enrollments = await db.enrollment.findMany({
    where: { academicYearId, status: "ACTIVE", classArm: { class: { schoolId: ctx.schoolId } } },
    select: {
      student: { select: { gender: true, boardingStatus: true, region: true, religion: true } },
      classArm: { select: { class: { select: { name: true, programmeId: true } } } },
    },
  });

  const programmes = await db.programme.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  const progName = new Map(programmes.map((p) => [p.id, p.name]));

  const buckets = new Map<string, CensusRow>();
  for (const e of enrollments) {
    const s = e.student;
    let key: string;
    let label: string;
    switch (filters.groupBy) {
      case "class": key = e.classArm.class.name; label = key; break;
      case "programme": key = e.classArm.class.programmeId ?? "UNASSIGNED"; label = progName.get(key) ?? "Unassigned"; break;
      case "region": key = s.region ?? "UNKNOWN"; label = key; break;
      case "gender": key = s.gender; label = key; break;
      case "boarding": key = s.boardingStatus; label = key; break;
      case "religion": key = s.religion ?? "UNKNOWN"; label = key; break;
    }
    if (!buckets.has(key)) buckets.set(key, { groupKey: key, groupLabel: label, total: 0, male: 0, female: 0, day: 0, boarding: 0 });
    const b = buckets.get(key)!;
    b.total++;
    if (s.gender === "MALE") b.male++;
    if (s.gender === "FEMALE") b.female++;
    if (s.boardingStatus === "DAY") b.day++;
    if (s.boardingStatus === "BOARDING") b.boarding++;
  }

  const rows = [...buckets.values()].sort((a, b) => b.total - a.total);
  return { data: { rows, total: enrollments.length, groupBy: filters.groupBy } };
}
