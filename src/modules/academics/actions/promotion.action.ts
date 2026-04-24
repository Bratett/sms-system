"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { archiveThreadsForStudent } from "@/modules/messaging/lifecycle";

// ─── Get Promotion Candidates ─────────────────────────────────────────

export async function getPromotionCandidatesAction(classArmId: string, academicYearId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_READ);
  if (denied) return denied;

  // Get all terms for this academic year
  const terms = await db.term.findMany({
    where: { academicYearId },
    orderBy: { termNumber: "asc" },
  });

  if (terms.length === 0) {
    return { error: "No terms found for this academic year." };
  }

  // Get all enrolled students in this class arm
  const enrollments = await db.enrollment.findMany({
    where: {
      classArmId,
      academicYearId,
      status: "ACTIVE",
    },
    include: {
      student: {
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      },
    },
  });

  if (enrollments.length === 0) {
    return { error: "No active students enrolled in this class arm." };
  }

  // Get the default grading scale to determine F9 grade
  const gradingScale = await db.gradingScale.findFirst({
    where: { schoolId: ctx.schoolId, isDefault: true },
    include: {
      gradeDefinitions: {
        orderBy: { minScore: "asc" },
      },
    },
  });

  // Find the lowest (failing) grade - typically F9
  const failingGrade = gradingScale?.gradeDefinitions[0]?.grade ?? "F9";

  // For each student, get terminal results across all terms
  const candidates = [];

  for (const enrollment of enrollments) {
    const studentId = enrollment.studentId;
    const termResults = await db.terminalResult.findMany({
      where: {
        studentId,
        academicYearId,
        classArmId,
      },
      include: {
        subjectResults: true,
      },
      orderBy: { computedAt: "asc" },
    });

    // Calculate cumulative average across all terms
    const termAverages = termResults.map((tr) => tr.averageScore ?? 0).filter((a) => a > 0);

    const cumulativeAverage =
      termAverages.length > 0
        ? Math.round((termAverages.reduce((sum, a) => sum + a, 0) / termAverages.length) * 100) /
          100
        : 0;

    // Count F9 subjects from the latest term result
    let f9Count = 0;
    const latestResult = termResults[termResults.length - 1];
    if (latestResult) {
      f9Count = latestResult.subjectResults.filter((sr) => sr.grade === failingGrade).length;
    }

    // Look up configurable promotion rules from database
    const classArm = await db.classArm.findUnique({
      where: { id: classArmId },
      include: { class: true },
    });

    const promotionRule = await db.promotionRule.findFirst({
      where: {
        schoolId: ctx.schoolId,
        isActive: true,
        OR: [
          { academicYearId, yearGroup: classArm?.class?.yearGroup ?? null },
          { academicYearId, yearGroup: null },
          { academicYearId: null, yearGroup: classArm?.class?.yearGroup ?? null },
          { academicYearId: null, yearGroup: null },
        ],
      },
      orderBy: [{ academicYearId: "desc" }, { yearGroup: "desc" }],
    });

    const passAverage = promotionRule?.passAverage ?? 40;
    const maxFailingSubjects = promotionRule?.maxFailingSubjects ?? 3;

    let recommendation: "PROMOTED" | "RETAINED" | "GRADUATED" = "RETAINED";
    let reason = "";

    const isGraduatingClass = classArm?.class?.yearGroup === 3;

    if (cumulativeAverage === 0) {
      reason = "No results computed";
    } else if (isGraduatingClass) {
      recommendation = "GRADUATED";
      reason = "Final year student";
    } else if (cumulativeAverage >= passAverage && f9Count <= maxFailingSubjects) {
      recommendation = "PROMOTED";
      reason = `Average: ${cumulativeAverage}%, F9 count: ${f9Count}`;
    } else {
      const reasons: string[] = [];
      if (cumulativeAverage < passAverage) {
        reasons.push(`Average ${cumulativeAverage}% below pass mark of ${passAverage}%`);
      }
      if (f9Count > maxFailingSubjects) {
        reasons.push(`${f9Count} failing subject(s) exceeds limit of ${maxFailingSubjects}`);
      }
      reason = reasons.join("; ");
    }

    candidates.push({
      studentId: enrollment.studentId,
      studentIdNumber: enrollment.student.studentId,
      studentName: `${enrollment.student.lastName} ${enrollment.student.firstName}`,
      studentStatus: enrollment.student.status,
      termsComputed: termAverages.length,
      totalTerms: terms.length,
      cumulativeAverage,
      f9Count,
      recommendation,
      reason,
      termAverages: termResults.map((tr) => ({
        termId: tr.termId,
        average: tr.averageScore,
        position: tr.classPosition,
      })),
    });
  }

  // Sort by cumulative average descending
  candidates.sort((a, b) => b.cumulativeAverage - a.cumulativeAverage);

  return { data: candidates };
}

// ─── Process Promotions ───────────────────────────────────────────────

export async function processPromotionsAction(data: {
  classArmId: string;
  academicYearId: string;
  promotions: Array<{
    studentId: string;
    status: "PROMOTED" | "RETAINED" | "GRADUATED";
  }>;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_COMPUTE);
  if (denied) return denied;

  if (!data.promotions || data.promotions.length === 0) {
    return { error: "No promotions to process." };
  }

  const results = {
    promoted: 0,
    retained: 0,
    graduated: 0,
    errors: [] as string[],
  };

  for (const promotion of data.promotions) {
    try {
      // Update terminal results for this student with promotion status
      await db.terminalResult.updateMany({
        where: {
          studentId: promotion.studentId,
          academicYearId: data.academicYearId,
          classArmId: data.classArmId,
        },
        data: {
          promotionStatus: promotion.status,
        },
      });

      // Update enrollment status
      const enrollment = await db.enrollment.findFirst({
        where: {
          studentId: promotion.studentId,
          academicYearId: data.academicYearId,
          classArmId: data.classArmId,
          status: "ACTIVE",
        },
      });

      if (!enrollment) {
        results.errors.push(`No active enrollment found for student ${promotion.studentId}`);
        continue;
      }

      switch (promotion.status) {
        case "PROMOTED":
          await db.enrollment.update({
            where: { id: enrollment.id },
            data: { status: "PROMOTED" },
          });
          results.promoted++;
          break;

        case "RETAINED":
          // Keep enrollment as ACTIVE - student stays in same class
          // The enrollment status remains ACTIVE; they will be re-enrolled
          // in the same class for the next academic year
          results.retained++;
          break;

        case "GRADUATED":
          await db.enrollment.update({
            where: { id: enrollment.id },
            data: { status: "COMPLETED" },
          });
          // Update student status to GRADUATED
          await db.student.update({
            where: { id: promotion.studentId },
            data: { status: "GRADUATED" },
          });
          await archiveThreadsForStudent(promotion.studentId);
          results.graduated++;
          break;
      }
    } catch (error) {
      results.errors.push(
        `Error processing promotion for student ${promotion.studentId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Audit log
  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "Enrollment",
    entityId: data.classArmId,
    module: "academics",
    description: `Processed promotions: ${results.promoted} promoted, ${results.retained} retained, ${results.graduated} graduated`,
    metadata: {
      classArmId: data.classArmId,
      academicYearId: data.academicYearId,
      ...results,
    },
  });

  return { data: results };
}
