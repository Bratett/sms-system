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
}

export async function generateEnrollmentCensus(
  schoolId: string,
  employer: EmployerContext,
  period: StatutoryReturnPeriod,
  academicYearId: string,
): Promise<StatutoryReturn<EnrollmentCensusRow>> {
  const enrollments = await db.enrollment.findMany({
    where: { schoolId, academicYearId, status: "ACTIVE" },
    include: {
      student: { select: { gender: true } },
      classArm: {
        select: {
          id: true,
          name: true,
          class: {
            select: {
              name: true,
              programme: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const byArm = new Map<string, EnrollmentCensusRow>();
  for (const e of enrollments) {
    const armId = e.classArmId;
    let row = byArm.get(armId);
    if (!row) {
      row = {
        classArmId: armId,
        className: e.classArm?.class?.name ?? "Unknown",
        armName: e.classArm?.name ?? "—",
        programmeName: e.classArm?.class?.programme?.name ?? null,
        male: 0,
        female: 0,
        total: 0,
      };
      byArm.set(armId, row);
    }
    const gender = e.student?.gender;
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
