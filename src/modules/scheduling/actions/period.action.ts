"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

export async function getPeriodsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ATTENDANCE_READ);
  if (denied) return denied;

  const periods = await db.period.findMany({
    where: { schoolId: ctx.schoolId },
    orderBy: { order: "asc" },
  });

  return { data: periods };
}
