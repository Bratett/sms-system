"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// ─── Get Class Teacher Dashboard Data ────────────────────────────────

export async function getClassTeacherDashboardAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  // Find class arm(s) where this user is class teacher
  const classArms = await db.classArm.findMany({
    where: { classTeacherId: session.user.id, status: "ACTIVE" },
    include: {
      class: {
        include: {
          examSchedules: { select: { id: true } },
        },
        select: undefined,
      },
    },
  });

  // Re-query with proper include
  const classArmsData = await db.classArm.findMany({
    where: { classTeacherId: session.user.id, status: "ACTIVE" },
    include: {
      class: { select: { name: true, yearGroup: true, programmeId: true, academicYearId: true } },
    },
  });

  if (classArmsData.length === 0) {
    return { error: "You are not assigned as class teacher for any class arm." };
  }

  const dashboardData = [];

  for (const arm of classArmsData) {
    const academicYearId = arm.class.academicYearId;

    // Get enrolled students count
    const enrollmentCount = await db.enrollment.count({
      where: { classArmId: arm.id, academicYearId, status: "ACTIVE" },
    });

    // Get current term
    const currentTerm = await db.term.findFirst({
      where: { academicYearId, isCurrent: true },
    });

    // Attendance summary for current term
    let attendanceSummary = { totalDays: 0, avgPresent: 0 };
    if (currentTerm) {
      const registers = await db.attendanceRegister.findMany({
        where: {
          classArmId: arm.id,
          date: { gte: currentTerm.startDate, lte: currentTerm.endDate },
          type: "DAILY",
          status: "CLOSED",
        },
        select: { id: true },
      });

      attendanceSummary.totalDays = registers.length;

      if (registers.length > 0) {
        const presentCount = await db.attendanceRecord.count({
          where: {
            registerId: { in: registers.map((r) => r.id) },
            status: "PRESENT",
          },
        });
        const totalRecords = await db.attendanceRecord.count({
          where: { registerId: { in: registers.map((r) => r.id) } },
        });
        attendanceSummary.avgPresent = totalRecords > 0
          ? Math.round((presentCount / totalRecords) * 100)
          : 0;
      }
    }

    // Pending mark submissions (DRAFT marks count)
    const draftMarksCount = currentTerm
      ? await db.mark.count({
          where: { classArmId: arm.id, termId: currentTerm.id, status: "DRAFT" },
        })
      : 0;

    // Submitted but not approved
    const submittedMarksCount = currentTerm
      ? await db.mark.count({
          where: { classArmId: arm.id, termId: currentTerm.id, status: "SUBMITTED" },
        })
      : 0;

    // Results computed?
    const resultsComputed = currentTerm
      ? await db.terminalResult.count({
          where: { classArmId: arm.id, termId: currentTerm.id, academicYearId },
        })
      : 0;

    // At-risk students
    const riskProfiles = await db.studentRiskProfile.findMany({
      where: {
        academicYearId,
        termId: currentTerm?.id,
        riskLevel: { in: ["HIGH", "CRITICAL"] },
      },
      select: { studentId: true },
    });

    // Filter to only students in this class arm
    const enrolledStudentIds = await db.enrollment.findMany({
      where: { classArmId: arm.id, academicYearId, status: "ACTIVE" },
      select: { studentId: true },
    });
    const enrolledIds = new Set(enrolledStudentIds.map((e) => e.studentId));
    const atRiskCount = riskProfiles.filter((rp) => enrolledIds.has(rp.studentId)).length;

    // Conduct entries pending
    const conductCount = currentTerm
      ? await db.studentConduct.count({
          where: { classArmId: arm.id, termId: currentTerm.id },
        })
      : 0;
    const conductPending = enrollmentCount - conductCount;

    dashboardData.push({
      classArmId: arm.id,
      classArmName: arm.name,
      className: arm.class.name,
      yearGroup: arm.class.yearGroup,
      academicYearId,
      currentTermId: currentTerm?.id ?? null,
      currentTermName: currentTerm?.name ?? null,
      studentCount: enrollmentCount,
      attendanceSummary,
      draftMarksCount,
      submittedMarksCount,
      resultsComputed,
      atRiskCount,
      conductPending: conductPending > 0 ? conductPending : 0,
    });
  }

  return { data: dashboardData };
}
