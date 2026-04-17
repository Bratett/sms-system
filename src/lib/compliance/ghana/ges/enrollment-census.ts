import { db } from "@/lib/db";
import type {
  EmployerContext,
  StatutoryReturn,
  StatutoryReturnPeriod,
} from "../types";

/**
 * GES enrollment census.
 *
 * Snapshots enrollment counts by class arm + programme + gender for the
 * target academic year. Matches the quarterly return GES expects from
 * public secondary schools.
 */

export interface EnrollmentCensusRow {
  classArmId: string;
  className: string;
  armName: string;
  programmeName: string | null;
  male: number;
  female: number;
  total: number;
  [key: string]: unknown;
}

export async function generateEnrollmentCensus(
  schoolId: string,
  employer: EmployerContext,
  period: StatutoryReturnPeriod,
  academicYearId: string,
): Promise<StatutoryReturn<EnrollmentCensusRow>> {
  // Fetch enrollments as flat records then enrich with class-arm, class, and
  // programme metadata via separate queries. Class has no direct `programme`
  // relation in the Prisma schema — it carries `programmeId`, and Programme
  // is resolved here by the id map.
  const enrollments = await db.enrollment.findMany({
    where: { schoolId, academicYearId, status: "ACTIVE" },
    select: { studentId: true, classArmId: true },
  });

  const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
  const armIds = [...new Set(enrollments.map((e) => e.classArmId))];

  const students = studentIds.length
    ? await db.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, gender: true },
      })
    : [];
  const genderById = new Map(students.map((s) => [s.id, s.gender]));

  const arms = armIds.length
    ? await db.classArm.findMany({
        where: { id: { in: armIds } },
        select: {
          id: true,
          name: true,
          class: { select: { name: true, programmeId: true } },
        },
      })
    : [];
  const armById = new Map(arms.map((a) => [a.id, a]));

  const programmeIds = [
    ...new Set(
      arms
        .map((a) => a.class?.programmeId)
        .filter((x): x is string => !!x),
    ),
  ];
  const programmes = programmeIds.length
    ? await db.programme.findMany({
        where: { id: { in: programmeIds } },
        select: { id: true, name: true },
      })
    : [];
  const programmeById = new Map(programmes.map((p) => [p.id, p.name]));

  const byArm = new Map<string, EnrollmentCensusRow>();
  for (const e of enrollments) {
    const arm = armById.get(e.classArmId);
    let row = byArm.get(e.classArmId);
    if (!row) {
      row = {
        classArmId: e.classArmId,
        className: arm?.class?.name ?? "Unknown",
        armName: arm?.name ?? "—",
        programmeName: arm?.class?.programmeId
          ? programmeById.get(arm.class.programmeId) ?? null
          : null,
        male: 0,
        female: 0,
        total: 0,
      };
      byArm.set(e.classArmId, row);
    }
    const gender = genderById.get(e.studentId);
    if (gender === "MALE") row.male++;
    else if (gender === "FEMALE") row.female++;
    row.total++;
  }

  const rows = Array.from(byArm.values()).sort(
    (a, b) =>
      a.className.localeCompare(b.className) || a.armName.localeCompare(b.armName),
  );

  return {
    kind: "GH_GES_ENROLLMENT_CENSUS",
    period,
    employer,
    rows,
    totals: {
      classArms: rows.length,
      male: rows.reduce((acc, r) => acc + r.male, 0),
      female: rows.reduce((acc, r) => acc + r.female, 0),
      total: rows.reduce((acc, r) => acc + r.total, 0),
    },
    generatedAt: new Date(),
  };
}
