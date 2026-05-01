"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

const ROW_CAP = 5000;

export interface NominalRollRow {
  row: number;
  studentId: string;
  surname: string;
  otherNames: string;
  gender: string;
  dateOfBirth: Date;
  primaryGuardianPhone: string | null;
}

export async function getStudentNominalRollAction(filters: {
  academicYearId?: string;
  classArmId?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORTS_ENROLLMENT_READ);
  if (denied) return denied;

  if (!filters.classArmId) return { error: "Class arm is required for nominal roll." };

  let academicYearId = filters.academicYearId;
  if (!academicYearId) {
    const current = await db.academicYear.findFirst({ where: { schoolId: ctx.schoolId, isCurrent: true } });
    academicYearId = current?.id;
  }
  if (!academicYearId) return { error: "No academic year found." };

  const count = await db.enrollment.count({
    where: { academicYearId, status: "ACTIVE", classArmId: filters.classArmId, classArm: { class: { schoolId: ctx.schoolId } } },
  });
  if (count > ROW_CAP) {
    return { error: `Result set too large (${count} rows). Apply tighter filters.` };
  }

  const enrollments = await db.enrollment.findMany({
    where: { academicYearId, status: "ACTIVE", classArmId: filters.classArmId, classArm: { class: { schoolId: ctx.schoolId } } },
    select: {
      student: {
        select: {
          id: true, studentId: true, firstName: true, lastName: true, otherNames: true,
          gender: true, dateOfBirth: true,
          guardians: {
            select: { isPrimary: true, guardian: { select: { phone: true } } },
          },
        },
      },
    },
  });

  const rows: NominalRollRow[] = enrollments
    .map((e) => {
      const s = e.student;
      const primary = s.guardians.find((g) => g.isPrimary) ?? s.guardians[0] ?? null;
      return {
        row: 0,
        studentId: s.studentId,
        surname: s.lastName,
        otherNames: [s.firstName, s.otherNames].filter(Boolean).join(" "),
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        primaryGuardianPhone: primary?.guardian.phone ?? null,
      };
    })
    .sort((a, b) => a.surname.localeCompare(b.surname))
    .map((r, i) => ({ ...r, row: i + 1 }));

  return { data: { rows, total: rows.length, classArmId: filters.classArmId, academicYearId } };
}
