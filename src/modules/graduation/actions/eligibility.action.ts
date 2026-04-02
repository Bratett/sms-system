"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
/**
 * Check graduation eligibility for a student.
 * Criteria: all fees paid, required credits earned, no unresolved discipline.
 */
export async function checkGraduationEligibilityAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GRADUATION_READ);
  if (denied) return denied;

  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      enrollments: {
        where: { status: "ACTIVE" },
        include: { classArm: { include: { class: true } } },
      },
    },
  });

  if (!student) return { error: "Student not found" };

  const issues: string[] = [];

  // 1. Check if student is in final year (SHS 3)
  const currentEnrollment = student.enrollments[0];
  if (!currentEnrollment || currentEnrollment.classArm.class.yearGroup !== 3) {
    issues.push("Student is not in the final year (SHS 3)");
  }

  // 2. Check outstanding fees
  const unpaidBills = await db.studentBill.count({
    where: {
      studentId,
      status: { in: ["UNPAID", "PARTIAL"] },
    },
  });
  if (unpaidBills > 0) {
    issues.push(`Student has ${unpaidBills} unpaid or partially paid bill(s)`);
  }

  // 3. Check unresolved disciplinary cases
  const unresolvedDiscipline = await db.disciplinaryIncident.count({
    where: {
      studentId,
      status: { in: ["REPORTED", "INVESTIGATING"] },
    },
  });
  if (unresolvedDiscipline > 0) {
    issues.push(`Student has ${unresolvedDiscipline} unresolved disciplinary case(s)`);
  }

  // 4. Check if terminal results exist for all required terms
  const activeAcademicYear = await db.academicYear.findFirst({
    where: { schoolId: ctx.schoolId, status: "ACTIVE" },
    include: { terms: true },
  });

  if (activeAcademicYear) {
    const completedTerms = await db.terminalResult.count({
      where: {
        studentId,
        academicYearId: activeAcademicYear.id,
      },
    });
    const expectedTerms = activeAcademicYear.terms.filter((t) => t.status === "COMPLETED").length;

    if (completedTerms < expectedTerms) {
      issues.push(
        `Missing results for ${expectedTerms - completedTerms} term(s) in current academic year`,
      );
    }
  }

  return {
    data: {
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      isEligible: issues.length === 0,
      issues,
    },
  };
}
