"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

const ROW_CAP = 5000;

export interface FormRegisterRow {
  row: number;
  studentId: string;
  fullName: string;
  gender: string;
}

export async function getStudentFormRegisterAction(filters: {
  academicYearId?: string;
  classArmId?: string;
  weeks?: number;
  daysPerWeek?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORTS_ENROLLMENT_READ);
  if (denied) return denied;

  if (!filters.classArmId) return { error: "Class arm is required for form master register." };

  let academicYearId = filters.academicYearId;
  if (!academicYearId) {
    const cur = await db.academicYear.findFirst({ where: { schoolId: ctx.schoolId, isCurrent: true } });
    academicYearId = cur?.id;
  }
  if (!academicYearId) return { error: "No academic year found." };

  const weeks = Math.min(15, Math.max(1, filters.weeks ?? 13));
  const daysPerWeek = ([5, 6, 7] as const).includes((filters.daysPerWeek ?? 5) as 5 | 6 | 7)
    ? (filters.daysPerWeek as 5 | 6 | 7) : 5;

  const count = await db.enrollment.count({
    where: { academicYearId, status: "ACTIVE", classArmId: filters.classArmId, classArm: { class: { schoolId: ctx.schoolId } } },
  });
  if (count > ROW_CAP) return { error: `Result set too large (${count} rows). Apply tighter filters.` };

  const enrollments = await db.enrollment.findMany({
    where: { academicYearId, status: "ACTIVE", classArmId: filters.classArmId, classArm: { class: { schoolId: ctx.schoolId } } },
    select: {
      student: {
        select: { studentId: true, firstName: true, lastName: true, otherNames: true, gender: true },
      },
    },
  });

  const rows: FormRegisterRow[] = enrollments
    .map((e) => ({
      row: 0,
      studentId: e.student.studentId,
      fullName: [e.student.lastName, e.student.firstName, e.student.otherNames].filter(Boolean).join(", "),
      gender: e.student.gender,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((r, i) => ({ ...r, row: i + 1 }));

  return { data: { rows, total: rows.length, weeks, daysPerWeek, classArmId: filters.classArmId, academicYearId } };
}
