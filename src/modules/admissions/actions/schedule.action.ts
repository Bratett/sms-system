"use server";

/**
 * Server-action wrappers around the admissions scheduled-task core.
 *
 * These are callable from the staff dashboard (manual trigger) and enforce
 * permissions + school context. The same core functions run unauthenticated
 * from `src/workers/admissions-schedule.worker.ts` with a SYSTEM_WORKER actor.
 */

import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import {
  expireOffersCore,
  listOverdueConditionsCore,
  sendOfferExpiryWarningsCore,
} from "@/modules/admissions/schedule/core";

export async function expireOffersAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_APPROVE);
  if (denied) return denied;

  const result = await expireOffersCore({
    schoolId: ctx.schoolId,
    actorId: ctx.session.user.id!,
  });
  return { data: result };
}

export async function checkConditionDeadlinesAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_READ);
  if (denied) return denied;

  const overdue = await listOverdueConditionsCore({ schoolId: ctx.schoolId });
  return { data: overdue };
}

export async function sendOfferExpiryWarningsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_APPROVE);
  if (denied) return denied;

  const result = await sendOfferExpiryWarningsCore({ schoolId: ctx.schoolId });
  return { data: result };
}
