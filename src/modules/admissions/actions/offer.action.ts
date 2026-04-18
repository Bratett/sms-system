"use server";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { transitionWorkflowWithAutoStart } from "@/lib/workflow/engine";
import {
  ADMISSION_WORKFLOW_KEY,
  ADMISSION_EVENTS,
} from "@/lib/workflow/definitions/admission";
import { DEFAULT_OFFER_EXPIRY_DAYS } from "@/modules/admissions/constants";

const ADMISSION_ENTITY = "AdmissionApplication";

/**
 * Internal helper — issue an offer for an ACCEPTED application.
 * Must be called inside the caller's `db.$transaction`.
 *
 * Creates one `AdmissionOffer` row and mirrors `offerExpiryDate` onto the
 * parent application so list views can filter by expiry without a join.
 */
export async function issueOfferInTx(
  tx: Prisma.TransactionClient,
  opts: {
    applicationId: string;
    schoolId: string;
    expiryDays?: number;
  },
): Promise<{ offerId: string; expiryDate: Date }> {
  const expiryDate = new Date();
  expiryDate.setDate(
    expiryDate.getDate() + (opts.expiryDays ?? DEFAULT_OFFER_EXPIRY_DAYS),
  );

  const offer = await tx.admissionOffer.create({
    data: {
      applicationId: opts.applicationId,
      schoolId: opts.schoolId,
      expiryDate,
    },
  });

  await tx.admissionApplication.update({
    where: { id: opts.applicationId },
    data: { offerExpiryDate: expiryDate },
  });

  return { offerId: offer.id, expiryDate };
}

/**
 * Record that the guardian has accepted the offer. Moves the application into
 * the ACCEPT_OFFER transition (idempotent within state machine), stamps the
 * offer's acceptedAt, and notifies internal staff.
 */
export async function acceptOfferAction(applicationId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_APPROVE);
  if (denied) return denied;

  const application = await db.admissionApplication.findUnique({
    where: { id: applicationId },
    include: {
      offers: { orderBy: { issuedAt: "desc" }, take: 1 },
    },
  });
  if (!application || application.schoolId !== ctx.schoolId) {
    return { error: "Application not found" };
  }

  if (application.status !== "ACCEPTED" && application.status !== "CONDITIONAL_ACCEPT") {
    return { error: "Application is not in an acceptable state for offer acceptance." };
  }

  const openOffer = application.offers[0];
  if (!openOffer) {
    return { error: "No offer has been issued for this application." };
  }
  if (openOffer.acceptedAt) {
    return { error: "This offer was already accepted." };
  }
  if (openOffer.declinedAt) {
    return { error: "This offer was declined." };
  }
  if (openOffer.expiryDate < new Date()) {
    return { error: "This offer has expired." };
  }

  const now = new Date();

  try {
    await transitionWorkflowWithAutoStart({
      definitionKey: ADMISSION_WORKFLOW_KEY,
      entityType: ADMISSION_ENTITY,
      event: ADMISSION_EVENTS.ACCEPT_OFFER,
      entity: { id: application.id, status: application.status },
      schoolId: ctx.schoolId,
      actor: { userId: ctx.session.user.id!, role: "admissions_officer" },
      extraMutations: [
        (tx) =>
          tx.admissionOffer.update({
            where: { id: openOffer.id },
            data: { acceptedAt: now },
          }),
        (tx) =>
          tx.admissionApplication.update({
            where: { id: applicationId },
            data: {
              offerAccepted: true,
              offerAcceptedAt: now,
            },
          }),
      ],
    });
  } catch (err) {
    return { error: (err as Error).message };
  }

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "AdmissionOffer",
    entityId: openOffer.id,
    module: "admissions",
    description: `Offer accepted for ${application.applicationNumber}`,
    newData: { acceptedAt: now },
  });

  return { data: { acceptedAt: now } };
}

export async function declineOfferAction(applicationId: string, reason: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_APPROVE);
  if (denied) return denied;

  const application = await db.admissionApplication.findUnique({
    where: { id: applicationId },
    include: { offers: { orderBy: { issuedAt: "desc" }, take: 1 } },
  });
  if (!application || application.schoolId !== ctx.schoolId) {
    return { error: "Application not found" };
  }

  const openOffer = application.offers[0];
  if (!openOffer || openOffer.acceptedAt || openOffer.declinedAt) {
    return { error: "No open offer to decline." };
  }

  const now = new Date();

  try {
    await transitionWorkflowWithAutoStart({
      definitionKey: ADMISSION_WORKFLOW_KEY,
      entityType: ADMISSION_ENTITY,
      event: ADMISSION_EVENTS.WITHDRAW,
      entity: { id: application.id, status: application.status },
      schoolId: ctx.schoolId,
      actor: { userId: ctx.session.user.id!, role: "admissions_officer" },
      reason: reason || "Offer declined",
      extraMutations: [
        (tx) =>
          tx.admissionOffer.update({
            where: { id: openOffer.id },
            data: { declinedAt: now, declineReason: reason || null },
          }),
        (tx) =>
          tx.admissionApplication.update({
            where: { id: applicationId },
            data: {
              status: "WITHDRAWN",
              currentStage: "WITHDRAWN",
              withdrawnAt: now,
              withdrawalReason: reason || "Offer declined",
            },
          }),
      ],
    });
  } catch (err) {
    return { error: (err as Error).message };
  }

  await dispatch({
    event: NOTIFICATION_EVENTS.ADMISSION_STATUS_CHANGED,
    title: "Offer declined",
    message: `Offer for ${application.applicationNumber} was declined.`,
    recipients: [
      {
        name: application.guardianName,
        phone: application.guardianPhone,
        email: application.guardianEmail ?? undefined,
      },
    ],
    schoolId: ctx.schoolId,
  });

  return { data: { declinedAt: now } };
}
