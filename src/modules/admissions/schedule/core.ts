/**
 * Admissions scheduled-task core logic.
 *
 * These functions are pure (aside from their side-effects on the DB and
 * notification dispatcher) and take the target schoolId + actorId explicitly
 * so they can run from either:
 *   - `src/modules/admissions/actions/schedule.action.ts` (staff manual trigger)
 *   - `src/workers/admissions-schedule.worker.ts` (system cron)
 *
 * No auth/permission checks here — callers are responsible for gating.
 */

import { db } from "@/lib/db";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { transitionWorkflowWithAutoStart } from "@/lib/workflow/engine";
import {
  ADMISSION_WORKFLOW_KEY,
  ADMISSION_EVENTS,
} from "@/lib/workflow/definitions/admission";

const ADMISSION_ENTITY = "AdmissionApplication";

/** Default window before offer expiry at which to send a warning. */
const OFFER_EXPIRY_WARNING_DAYS = 3;

export interface ExpireOffersResult {
  expiredCount: number;
  considered: number;
  errors: string[];
}

export async function expireOffersCore(opts: {
  schoolId: string;
  actorId: string;
}): Promise<ExpireOffersResult> {
  const now = new Date();

  const expiring = await db.admissionApplication.findMany({
    where: {
      schoolId: opts.schoolId,
      status: "ACCEPTED",
      offerAccepted: { not: true },
      offerExpiryDate: { lt: now },
    },
    select: {
      id: true,
      status: true,
      applicationNumber: true,
    },
  });

  let expiredCount = 0;
  const errors: string[] = [];

  for (const app of expiring) {
    try {
      await transitionWorkflowWithAutoStart({
        definitionKey: ADMISSION_WORKFLOW_KEY,
        entityType: ADMISSION_ENTITY,
        event: ADMISSION_EVENTS.EXPIRE_OFFER,
        entity: { id: app.id, status: app.status },
        schoolId: opts.schoolId,
        actor: { userId: opts.actorId, role: "admissions_officer" },
        reason: "Offer expired without acceptance",
        extraMutations: [
          (tx) =>
            tx.admissionApplication.update({
              where: { id: app.id },
              data: { status: "OFFER_EXPIRED", currentStage: "OFFER_EXPIRED" },
            }),
        ],
      });
      expiredCount += 1;
    } catch (err) {
      errors.push(`${app.applicationNumber}: ${(err as Error).message}`);
    }
  }

  return { expiredCount, considered: expiring.length, errors };
}

export interface OverdueCondition {
  conditionId: string;
  type: string;
  description: string;
  deadline: Date;
  applicationId: string;
  applicationNumber: string | undefined;
  applicantName: string | null;
  applicationStatus: string | null;
}

export async function listOverdueConditionsCore(opts: {
  schoolId: string;
}): Promise<OverdueCondition[]> {
  const now = new Date();

  const overdue = await db.admissionCondition.findMany({
    where: {
      met: false,
      deadline: { lt: now },
      decision: { schoolId: opts.schoolId },
    },
    include: {
      decision: {
        select: {
          applicationId: true,
          application: {
            select: {
              applicationNumber: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: { deadline: "asc" },
  });

  return overdue.map((c) => ({
    conditionId: c.id,
    type: c.type,
    description: c.description,
    deadline: c.deadline,
    applicationId: c.decision.applicationId,
    applicationNumber: c.decision.application?.applicationNumber,
    applicantName: c.decision.application
      ? `${c.decision.application.firstName} ${c.decision.application.lastName}`
      : null,
    applicationStatus: c.decision.application?.status ?? null,
  }));
}

export interface ExpiryWarningResult {
  warnedCount: number;
}

export async function sendOfferExpiryWarningsCore(opts: {
  schoolId: string;
}): Promise<ExpiryWarningResult> {
  const now = new Date();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + OFFER_EXPIRY_WARNING_DAYS);
  // Don't re-warn within 24h. The hourly worker would otherwise send up to
  // 72 notifications over the 3-day window.
  const resendAfter = new Date();
  resendAfter.setDate(resendAfter.getDate() - 1);

  const warning = await db.admissionApplication.findMany({
    where: {
      schoolId: opts.schoolId,
      status: "ACCEPTED",
      offerAccepted: { not: true },
      offerExpiryDate: { gte: now, lte: threshold },
      OR: [
        { offerExpiryWarningSentAt: null },
        { offerExpiryWarningSentAt: { lt: resendAfter } },
      ],
    },
    select: {
      id: true,
      applicationNumber: true,
      firstName: true,
      lastName: true,
      offerExpiryDate: true,
      guardianName: true,
      guardianPhone: true,
      guardianEmail: true,
    },
  });

  let warnedCount = 0;
  for (const app of warning) {
    try {
      await dispatch({
        event: NOTIFICATION_EVENTS.ADMISSION_OFFER_EXPIRING,
        title: "Your admission offer is expiring soon",
        message: `Offer for ${app.firstName} ${app.lastName} (${app.applicationNumber}) expires on ${app.offerExpiryDate?.toLocaleDateString()}.`,
        recipients: [
          {
            name: app.guardianName,
            phone: app.guardianPhone,
            email: app.guardianEmail ?? undefined,
          },
        ],
        schoolId: opts.schoolId,
      });
      await db.admissionApplication.update({
        where: { id: app.id },
        data: { offerExpiryWarningSentAt: new Date() },
      });
      warnedCount += 1;
    } catch (err) {
      // Log and continue — one bad recipient must not block the rest.
      console.error(
        `[admissions] expiry warning failed for ${app.applicationNumber}:`,
        (err as Error).message,
      );
    }
  }

  return { warnedCount };
}
