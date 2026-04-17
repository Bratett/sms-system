"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";

export async function getPeriodsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const periods = await db.period.findMany({
    where: { schoolId: ctx.schoolId },
    orderBy: { order: "asc" },
  });

  return { data: periods };
}
