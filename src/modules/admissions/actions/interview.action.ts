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
  scheduleInterviewSchema,
  recordInterviewSchema,
  waiveInterviewSchema,
  type ScheduleInterviewInput,
  type RecordInterviewInput,
  type WaiveInterviewInput,
} from "@/modules/admissions/schemas/admission.schema";
import { computeInterviewTotal } from "@/modules/admissions/services/decision-authority.service";

const ADMISSION_ENTITY = "AdmissionApplication";

function guardianRecipient(application: {
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string | null;
}) {
  return [
    {
      name: application.guardianName,
      phone: application.guardianPhone,
      email: application.guardianEmail ?? undefined,
    },
  ];
}

export async function scheduleInterviewAction(
  applicationId: string,
  input: ScheduleInterviewInput,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_INTERVIEW);
  if (denied) return denied;

  const parsed = scheduleInterviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const application = await db.admissionApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) return { error: "Application not found" };
  if (application.schoolId !== ctx.schoolId) {
    return { error: "Application not found" };
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { error: "Invalid scheduled date/time" };
  }

  const interview = await db.admissionInterview.create({
    data: {
      applicationId,
      schoolId: ctx.schoolId,
      scheduledAt,
      location: parsed.data.location || null,
      panelMemberIds: parsed.data.panelMemberIds,
    },
  });

  try {
    await transitionWorkflowWithAutoStart({
      definitionKey: ADMISSION_WORKFLOW_KEY,
      entityType: ADMISSION_ENTITY,
      event: ADMISSION_EVENTS.SCHEDULE_INTERVIEW,
      entity: { id: application.id, status: application.status },
      schoolId: ctx.schoolId,
      actor: { userId: ctx.session.user.id!, role: "admissions_officer" },
      extraMutations: [
        (tx) =>
          tx.admissionApplication.update({
            where: { id: applicationId },
            data: {
              status: "INTERVIEW_SCHEDULED",
              currentStage: "INTERVIEW_SCHEDULED",
              interviewRequired: true,
            },
          }),
      ],
    });
  } catch (err) {
    return { error: (err as Error).message };
  }

  await dispatch({
    event: NOTIFICATION_EVENTS.ADMISSION_INTERVIEW_SCHEDULED,
    title: "Interview scheduled",
    message: `Interview scheduled for ${application.firstName} ${application.lastName} on ${scheduledAt.toLocaleString()}.`,
    recipients: guardianRecipient(application),
    schoolId: ctx.schoolId,
  });

  return { data: interview };
}

export async function recordInterviewAction(
  interviewId: string,
  input: RecordInterviewInput,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_INTERVIEW);
  if (denied) return denied;

  const parsed = recordInterviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const interview = await db.admissionInterview.findUnique({
    where: { id: interviewId },
    include: { application: true },
  });
  if (!interview || interview.schoolId !== ctx.schoolId) {
    return { error: "Interview not found" };
  }

  const totalScore = computeInterviewTotal({
    academic: parsed.data.academicScore,
    behavioral: parsed.data.behavioralScore,
    parent: parsed.data.parentScore,
  });

  const updated = await db.admissionInterview.update({
    where: { id: interviewId },
    data: {
      academicScore: parsed.data.academicScore,
      behavioralScore: parsed.data.behavioralScore,
      parentScore: parsed.data.parentScore,
      totalScore,
      outcome: parsed.data.outcome,
      notes: parsed.data.notes || null,
      recordedBy: ctx.session.user.id,
      recordedAt: new Date(),
    },
  });

  try {
    await transitionWorkflowWithAutoStart({
      definitionKey: ADMISSION_WORKFLOW_KEY,
      entityType: ADMISSION_ENTITY,
      event: ADMISSION_EVENTS.RECORD_INTERVIEW,
      entity: { id: interview.application.id, status: interview.application.status },
      schoolId: ctx.schoolId,
      actor: { userId: ctx.session.user.id!, role: "admissions_officer" },
      extraMutations: [
        (tx) =>
          tx.admissionApplication.update({
            where: { id: interview.application.id },
            data: {
              status: "AWAITING_DECISION",
              currentStage: "AWAITING_DECISION",
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
    entity: "AdmissionInterview",
    entityId: interviewId,
    module: "admissions",
    description: `Recorded interview for ${interview.application.applicationNumber}: score ${totalScore}, outcome ${parsed.data.outcome}`,
    newData: { totalScore, outcome: parsed.data.outcome },
  });

  return { data: updated };
}

export async function waiveInterviewAction(
  applicationId: string,
  input: WaiveInterviewInput,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_INTERVIEW);
  if (denied) return denied;

  const parsed = waiveInterviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const application = await db.admissionApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application || application.schoolId !== ctx.schoolId) {
    return { error: "Application not found" };
  }

  try {
    await transitionWorkflowWithAutoStart({
      definitionKey: ADMISSION_WORKFLOW_KEY,
      entityType: ADMISSION_ENTITY,
      event: ADMISSION_EVENTS.WAIVE_INTERVIEW,
      entity: { id: application.id, status: application.status },
      schoolId: ctx.schoolId,
      actor: { userId: ctx.session.user.id!, role: "admissions_officer" },
      reason: parsed.data.reason,
      extraMutations: [
        (tx) =>
          tx.admissionApplication.update({
            where: { id: applicationId },
            data: {
              status: "AWAITING_DECISION",
              currentStage: "AWAITING_DECISION",
              interviewRequired: false,
              interviewWaivedReason: parsed.data.reason,
            },
          }),
      ],
    });
  } catch (err) {
    return { error: (err as Error).message };
  }

  return { data: { waived: true, reason: parsed.data.reason } };
}
