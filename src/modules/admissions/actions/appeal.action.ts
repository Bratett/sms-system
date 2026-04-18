"use server";

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
import {
  submitAppealSchema,
  resolveAppealSchema,
  type SubmitAppealInput,
  type ResolveAppealInput,
} from "@/modules/admissions/schemas/admission.schema";

const ADMISSION_ENTITY = "AdmissionApplication";

/**
 * Submit an appeal against a rejection. Allowed only when the application is
 * currently REJECTED and no PENDING appeal already exists.
 */
export async function submitAppealAction(
  applicationId: string,
  input: SubmitAppealInput,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  // Guardians typically submit appeals through the portal; staff can file on
  // behalf of families. We gate on ADMISSIONS_READ as a minimum.
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_READ);
  if (denied) return denied;

  const parsed = submitAppealSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const application = await db.admissionApplication.findUnique({
    where: { id: applicationId },
    include: { appeals: { where: { status: "PENDING" }, take: 1 } },
  });
  if (!application || application.schoolId !== ctx.schoolId) {
    return { error: "Application not found" };
  }
  if (application.status !== "REJECTED") {
    return { error: "Appeals can only be filed against rejected applications." };
  }
  if (application.appeals.length > 0) {
    return { error: "A pending appeal already exists for this application." };
  }

  const appeal = await db.admissionAppeal.create({
    data: {
      applicationId,
      schoolId: ctx.schoolId,
      submittedBy: ctx.session.user.id!,
      reason: parsed.data.reason,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "AdmissionAppeal",
    entityId: appeal.id,
    module: "admissions",
    description: `Appeal submitted for ${application.applicationNumber}`,
    newData: { reason: parsed.data.reason },
  });

  // Staff-facing notification — let the dispatcher fan out to admissions
  // roles via event routing. Sending to the guardian would page them with
  // internal workflow language like "requires review".
  await dispatch({
    event: NOTIFICATION_EVENTS.ADMISSION_APPEAL_SUBMITTED,
    title: "Admission appeal submitted",
    message: `Appeal for ${application.applicationNumber} requires review.`,
    recipients: [],
    schoolId: ctx.schoolId,
  });

  return { data: appeal };
}

/**
 * Resolve a pending appeal. Upholding the appeal moves the application back
 * into AWAITING_DECISION so the admissions team can re-decide. Denying the
 * appeal leaves the application rejected.
 */
export async function resolveAppealAction(
  appealId: string,
  input: ResolveAppealInput,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_OVERRIDE);
  if (denied) return denied;

  const parsed = resolveAppealSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const appeal = await db.admissionAppeal.findUnique({
    where: { id: appealId },
    include: { application: true },
  });
  if (!appeal || appeal.schoolId !== ctx.schoolId) {
    return { error: "Appeal not found" };
  }
  if (appeal.status !== "PENDING") {
    return { error: "This appeal has already been resolved." };
  }

  const now = new Date();
  const nextStatus = parsed.data.upheld ? "UPHELD" : "DENIED";

  await db.admissionAppeal.update({
    where: { id: appealId },
    data: {
      status: nextStatus,
      resolvedBy: ctx.session.user.id,
      resolvedAt: now,
      resolution: parsed.data.resolution,
    },
  });

  if (parsed.data.upheld) {
    try {
      await transitionWorkflowWithAutoStart({
        definitionKey: ADMISSION_WORKFLOW_KEY,
        entityType: ADMISSION_ENTITY,
        event: ADMISSION_EVENTS.APPEAL_UPHELD,
        entity: { id: appeal.application.id, status: appeal.application.status },
        schoolId: ctx.schoolId,
        actor: { userId: ctx.session.user.id!, role: "headmaster" },
        reason: parsed.data.resolution,
        extraMutations: [
          (tx) =>
            tx.admissionApplication.update({
              where: { id: appeal.application.id },
              data: {
                status: "AWAITING_DECISION",
                currentStage: "AWAITING_DECISION",
                decisionReason: null,
              },
            }),
        ],
      });
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: parsed.data.upheld ? "APPROVE" : "REJECT",
    entity: "AdmissionAppeal",
    entityId: appealId,
    module: "admissions",
    description: `Appeal ${nextStatus} for ${appeal.application.applicationNumber}`,
    newData: { status: nextStatus, resolution: parsed.data.resolution },
  });

  await dispatch({
    event: NOTIFICATION_EVENTS.ADMISSION_APPEAL_RESOLVED,
    title: `Appeal ${nextStatus.toLowerCase()}`,
    message: `Appeal for ${appeal.application.applicationNumber} has been ${nextStatus.toLowerCase()}.`,
    recipients: [
      {
        name: appeal.application.guardianName,
        phone: appeal.application.guardianPhone,
        email: appeal.application.guardianEmail ?? undefined,
      },
    ],
    schoolId: ctx.schoolId,
  });

  return { data: { appealId, status: nextStatus, upheld: parsed.data.upheld } };
}

export async function listAppealsAction(filters?: {
  status?: "PENDING" | "UPHELD" | "DENIED";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_READ);
  if (denied) return denied;

  const appeals = await db.admissionAppeal.findMany({
    where: {
      schoolId: ctx.schoolId,
      ...(filters?.status ? { status: filters.status } : {}),
    },
    include: {
      application: {
        select: {
          applicationNumber: true,
          firstName: true,
          lastName: true,
          status: true,
          guardianName: true,
          guardianPhone: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return { data: appeals };
}
