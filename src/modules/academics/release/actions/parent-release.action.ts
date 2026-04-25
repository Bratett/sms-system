"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { _renderReportCardPdfInternal } from "@/modules/academics/actions/report-card.action";

// ─── Acknowledge ────────────────────────────────────────────────────

export async function acknowledgeReportCardAction(input: {
  releaseId: string;
  studentId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_DOWNLOAD_OWN);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const release = await db.reportCardRelease.findFirst({
    where: { id: input.releaseId, schoolId: ctx.schoolId },
    select: { id: true, classArmId: true, schoolId: true },
  });
  if (!release) return { error: "Report card not found" };

  // Caller must be a guardian of this student
  const link = await db.studentGuardian.findFirst({
    where: {
      studentId: input.studentId,
      guardian: { userId, schoolId: ctx.schoolId },
    },
    select: {
      studentId: true,
      guardian: { select: { userId: true, householdId: true } },
    },
  });
  if (!link?.guardian.householdId) return { error: "Report card not found" };

  // Student must be currently enrolled in the released arm
  const studentInArm = await db.student.findFirst({
    where: {
      id: input.studentId,
      schoolId: ctx.schoolId,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      enrollments: { some: { status: "ACTIVE", classArmId: release.classArmId } },
    },
    select: { id: true },
  });
  if (!studentInArm) return { error: "Report card not found" };

  try {
    await db.reportCardAcknowledgement.create({
      data: {
        releaseId: input.releaseId,
        studentId: input.studentId,
        householdId: link.guardian.householdId,
        acknowledgedByUserId: userId,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return { success: true };
    }
    throw err;
  }

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "ReportCardAcknowledgement",
    entityId: input.releaseId,
    module: "academics",
    description: `Parent acknowledged report card for student ${input.studentId}`,
    newData: { studentId: input.studentId, householdId: link.guardian.householdId },
  });

  return { success: true };
}

// ─── Get My Report Card Release ─────────────────────────────────────

/** @no-audit Read-only parent view. */
export async function getMyReportCardReleaseAction(input: {
  studentId: string;
  termId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.RESULTS_READ);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const link = await db.studentGuardian.findFirst({
    where: {
      studentId: input.studentId,
      guardian: { userId, schoolId: ctx.schoolId },
    },
    select: {
      studentId: true,
      guardian: { select: { userId: true, householdId: true } },
    },
  });
  if (!link) return { error: "Report card not found" };

  const enrollment = await db.enrollment.findFirst({
    where: {
      studentId: input.studentId,
      status: "ACTIVE",
      schoolId: ctx.schoolId,
    },
    select: { classArmId: true },
  });
  if (!enrollment?.classArmId) return { data: { released: false } as const };

  const release = await db.reportCardRelease.findUnique({
    where: { termId_classArmId: { termId: input.termId, classArmId: enrollment.classArmId } },
    select: { id: true, releasedAt: true, schoolId: true },
  });
  if (!release || release.schoolId !== ctx.schoolId) {
    return { data: { released: false } as const };
  }

  let isAcknowledgedByMyHousehold = false;
  if (link.guardian.householdId) {
    const ack = await db.reportCardAcknowledgement.findUnique({
      where: {
        releaseId_studentId_householdId: {
          releaseId: release.id,
          studentId: input.studentId,
          householdId: link.guardian.householdId,
        },
      },
    });
    isAcknowledgedByMyHousehold = !!ack;
  }

  return {
    data: {
      released: true as const,
      releaseId: release.id,
      releasedAt: release.releasedAt,
      isAcknowledgedByMyHousehold,
    },
  };
}

// ─── Get My Report Card PDF URL ─────────────────────────────────────

/** @no-audit Read-only — internal helper writes audit on render. */
export async function getMyReportCardPdfUrlAction(input: {
  studentId: string;
  termId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.REPORT_CARDS_DOWNLOAD_OWN);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const link = await db.studentGuardian.findFirst({
    where: {
      studentId: input.studentId,
      guardian: { userId, schoolId: ctx.schoolId },
    },
    select: { studentId: true, guardian: { select: { userId: true, householdId: true } } },
  });
  if (!link) return { error: "Report card not found" };

  const enrollment = await db.enrollment.findFirst({
    where: {
      studentId: input.studentId,
      status: "ACTIVE",
      schoolId: ctx.schoolId,
    },
    select: { classArmId: true },
  });
  if (!enrollment?.classArmId) return { error: "Report card not yet released" };

  const release = await db.reportCardRelease.findUnique({
    where: { termId_classArmId: { termId: input.termId, classArmId: enrollment.classArmId } },
    select: { id: true, schoolId: true },
  });
  if (!release || release.schoolId !== ctx.schoolId) {
    return { error: "Report card not yet released" };
  }

  return _renderReportCardPdfInternal({
    studentId: input.studentId,
    termId: input.termId,
    schoolId: ctx.schoolId,
    callerUserId: userId,
  });
}
