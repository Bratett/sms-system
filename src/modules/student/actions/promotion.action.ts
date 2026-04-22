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
