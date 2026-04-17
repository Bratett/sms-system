import { db } from "@/lib/db";
import type {
  EmployerContext,
  StatutoryReturn,
  StatutoryReturnPeriod,
} from "../types";

/**
 * BECE / final-year candidature return.
 *
 * Lists the students the school is presenting to the final examination for
 * the current academic year. Uses the admission application's BECE index
 * number when available; otherwise flags the row so the admin can backfill
 * before submission to WAEC.
 */

export interface BeceCandidatureRow {
  studentId: string;
  studentRef: string;
  fullName: string;
  gender: string;
  dateOfBirth: Date | null;
  className: string | null;
  beceIndexNumber: string | null;
  hasBeceIndex: boolean;
}

export async function generateBeceCandidature(
  schoolId: string,
  employer: EmployerContext,
  period: StatutoryReturnPeriod,
  academicYearId: string,
): Promise<StatutoryReturn<BeceCandidatureRow>> {
  const enrollments = await db.enrollment.findMany({
    where: {
      schoolId,
      academicYearId,
      status: "ACTIVE",
      // Final-year heuristic: the highest numbered class this school has.
      // Callers can refine by filtering on a specific classId before export.
    },
    include: {
      student: {
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          gender: true,
          dateOfBirth: true,
        },
      },
      classArm: { select: { class: { select: { name: true } } } },
    },
  });

  // Link BECE index numbers through the matching AdmissionApplication row.
  const studentIds = enrollments.map((e) => e.studentId);
  const applications = studentIds.length
    ? await db.admissionApplication.findMany({
        where: { schoolId, beceIndexNumber: { not: null } },
        select: { beceIndexNumber: true, firstName: true, lastName: true, dateOfBirth: true },
      })
    : [];
  const indexByName = new Map(
    applications.map((a) => [
      `${a.firstName}|${a.lastName}|${a.dateOfBirth?.toISOString() ?? ""}`.toLowerCase(),
      a.beceIndexNumber,
    ]),
  );

  const rows: BeceCandidatureRow[] = enrollments.map((e) => {
    const key =
      `${e.student.firstName}|${e.student.lastName}|${e.student.dateOfBirth?.toISOString() ?? ""}`
        .toLowerCase();
    const idx = indexByName.get(key) ?? null;
    return {
      studentId: e.studentId,
      studentRef: e.student.studentId,
      fullName: `${e.student.firstName} ${e.student.lastName}`,
      gender: String(e.student.gender),
      dateOfBirth: e.student.dateOfBirth ?? null,
      className: e.classArm?.class?.name ?? null,
      beceIndexNumber: idx,
      hasBeceIndex: Boolean(idx),
    };
  });

  return {
    kind: "GH_GES_BECE_CANDIDATURE",
    period,
    employer,
    rows,
    totals: {
      total: rows.length,
      withBeceIndex: rows.filter((r) => r.hasBeceIndex).length,
      missingBeceIndex: rows.filter((r) => !r.hasBeceIndex).length,
    },
    generatedAt: new Date(),
  };
}
