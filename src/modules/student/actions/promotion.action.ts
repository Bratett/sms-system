"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

export async function getEligibleSourceArmsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const currentYear = await db.academicYear.findFirst({
    where: { schoolId: ctx.schoolId, isCurrent: true },
  });
  if (!currentYear) return { error: "No current academic year set." };

  const arms = await db.classArm.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "ACTIVE",
      class: { academicYearId: currentYear.id },
    },
    include: {
      class: { select: { name: true, yearGroup: true, academicYearId: true, programmeId: true } },
      _count: { select: { enrollments: { where: { status: "ACTIVE", academicYearId: currentYear.id } } } },
    },
    orderBy: [{ class: { yearGroup: "asc" } }, { name: "asc" }],
  });

  const drafts = await db.promotionRun.findMany({
    where: { schoolId: ctx.schoolId, sourceAcademicYearId: currentYear.id, status: "DRAFT" },
    select: { sourceClassArmId: true },
  });
  const draftArmIds = new Set(drafts.map((d) => d.sourceClassArmId));

  return { data: arms.filter((a) => !draftArmIds.has(a.id)) };
}

export async function listPromotionRunsAction(opts?: { status?: "DRAFT" | "COMMITTED" | "REVERTED"; academicYearId?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const runs = await db.promotionRun.findMany({
    where: {
      schoolId: ctx.schoolId,
      ...(opts?.status && { status: opts.status }),
      ...(opts?.academicYearId && { sourceAcademicYearId: opts.academicYearId }),
    },
    include: {
      sourceClassArm: { include: { class: { select: { name: true, yearGroup: true } } } },
      sourceAcademicYear: { select: { name: true } },
      targetAcademicYear: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  return { data: runs };
}

export async function getPromotionRunAction(runId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_PROMOTE);
  if (denied) return denied;

  const run = await db.promotionRun.findFirst({
    where: { id: runId, schoolId: ctx.schoolId },
    include: {
      items: {
        include: {
          student: { select: { id: true, studentId: true, firstName: true, lastName: true, status: true } },
          destinationClassArm: { include: { class: { select: { name: true, yearGroup: true } } } },
        },
        orderBy: [{ student: { lastName: "asc" } }],
      },
      sourceClassArm: { include: { class: { select: { id: true, name: true, yearGroup: true, programmeId: true } } } },
      sourceAcademicYear: { select: { id: true, name: true } },
      targetAcademicYear: { select: { id: true, name: true } },
    },
  });
  if (!run) return { error: "Promotion run not found" };

  // Capacity rollup: count draft items per destination arm.
  const destIds = run.items.map((i) => i.destinationClassArmId).filter(Boolean) as string[];
  const destArms = destIds.length
    ? await db.classArm.findMany({
        where: { id: { in: destIds } },
        select: { id: true, capacity: true, _count: { select: { enrollments: { where: { status: "ACTIVE", academicYearId: run.targetAcademicYearId } } } } },
      })
    : [];
  const capacityByArm: Record<string, { capacity: number; existing: number; incoming: number }> = {};
  for (const a of destArms) {
    capacityByArm[a.id] = {
      capacity: a.capacity,
      existing: a._count.enrollments,
      incoming: run.items.filter((i) => i.destinationClassArmId === a.id).length,
    };
  }

  return { data: { ...run, capacityByArm } };
}
