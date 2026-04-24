"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { validateAttachment } from "@/modules/messaging/attachments";
import {
  notifyMedicalDisclosureSubmitted,
  notifyMedicalDisclosureReviewed,
} from "../notifications";

type AttachmentInput = {
  attachmentKey?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMime?: string;
};

type Category = "ALLERGY" | "CONDITION" | "MEDICATION";

function checkAttachment(input: AttachmentInput): { ok: true } | { ok: false; error: string } {
  if (!input.attachmentKey) return { ok: true };
  if (!input.attachmentMime || !input.attachmentSize) {
    return { ok: false, error: "Attachment metadata incomplete." };
  }
  const v = validateAttachment({ mimeType: input.attachmentMime, size: input.attachmentSize });
  return v.ok ? { ok: true } : v;
}

function mergeDenormalized(existing: string | null | undefined, addition: string): string {
  const current = (existing ?? "").split(/;/).map((s) => s.trim()).filter(Boolean);
  const add = addition.split(/;/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set(current.map((s) => s.toLowerCase()));
  for (const a of add) {
    if (!seen.has(a.toLowerCase())) {
      current.push(a);
      seen.add(a.toLowerCase());
    }
  }
  return current.join("; ");
}

// ─── Submit ───────────────────────────────────────────────────────

export async function submitMedicalDisclosureAction(input: {
  studentId: string;
  category: Category;
  title: string;
  description: string;
  isUrgent?: boolean;
} & AttachmentInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_SUBMIT);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const title = (input.title ?? "").trim();
  const description = (input.description ?? "").trim();
  if (!title) return { error: "Title is required." };
  if (!description) return { error: "Description is required." };
  if (!(["ALLERGY", "CONDITION", "MEDICATION"] as const).includes(input.category)) {
    return { error: "Invalid category." };
  }
  const att = checkAttachment(input);
  if (!att.ok) return { error: att.error };

  const student = await db.student.findFirst({
    where: { id: input.studentId, schoolId: ctx.schoolId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      guardians: { select: { guardian: { select: { userId: true } } } },
    },
  });
  if (!student) return { error: "Student not found." };
  const guardianUserIds = student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  if (!guardianUserIds.includes(userId)) {
    return { error: "You are not authorized to submit for this student." };
  }

  const isUrgent = input.isUrgent ?? false;

  const created = await db.medicalDisclosure.create({
    data: {
      schoolId: ctx.schoolId,
      studentId: input.studentId,
      submittedByUserId: userId,
      category: input.category,
      title,
      description,
      isUrgent,
      attachmentKey: input.attachmentKey ?? null,
      attachmentName: input.attachmentName ?? null,
      attachmentSize: input.attachmentSize ?? null,
      attachmentMime: input.attachmentMime ?? null,
      status: "PENDING",
    },
  });

  try {
    const nurses = await db.userRole.findMany({
      where: {
        role: { name: "school_nurse" },
        user: { userSchools: { some: { schoolId: ctx.schoolId } } },
      },
      select: { userId: true },
    });
    const nurseUserIds = [
      ...new Set(nurses.map((n) => n.userId).filter((u): u is string => !!u)),
    ];
    if (nurseUserIds.length > 0) {
      await notifyMedicalDisclosureSubmitted({
        disclosureId: created.id,
        nurseUserIds,
        studentName: `${student.firstName} ${student.lastName}`,
        category: input.category,
        title,
        isUrgent,
        submitterName: ctx.session.user.name ?? "Parent",
      });
    }
  } catch (err) {
    console.error("notifyMedicalDisclosureSubmitted failed", { id: created.id, err });
  }

  return { data: { id: created.id } };
}

// ─── Withdraw ─────────────────────────────────────────────────────

export async function withdrawMedicalDisclosureAction(disclosureId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_SUBMIT);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const row = await db.medicalDisclosure.findFirst({
    where: { id: disclosureId, schoolId: ctx.schoolId },
    select: { submittedByUserId: true, status: true },
  });
  if (!row) return { error: "Disclosure not found." };
  if (row.submittedByUserId !== userId) {
    return { error: "You can only withdraw your own disclosures." };
  }
  if (row.status !== "PENDING") return { error: "Already reviewed" };

  await db.medicalDisclosure.update({
    where: { id: disclosureId },
    data: { status: "WITHDRAWN" },
  });
  return { success: true };
}

// ─── Get Mine ─────────────────────────────────────────────────────

/** @no-audit Read-only. */
export async function getMyMedicalDisclosuresAction(filters?: {
  status?: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_SUBMIT);
  if (denied) return denied;

  const rows = await db.medicalDisclosure.findMany({
    where: {
      schoolId: ctx.schoolId,
      submittedByUserId: ctx.session.user.id!,
      ...(filters?.status ? { status: filters.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return { data: rows };
}

// ─── Get Pending (nurse queue) ────────────────────────────────────

/** @no-audit Read-only. */
export async function getPendingMedicalDisclosuresAction(filters?: { urgent?: boolean }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);
  if (denied) return denied;

  const rows = await db.medicalDisclosure.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "PENDING",
      ...(filters?.urgent != null ? { isUrgent: filters.urgent } : {}),
    },
    orderBy: [{ isUrgent: "desc" }, { createdAt: "asc" }],
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      submittedBy: { select: { firstName: true, lastName: true } },
    },
  });
  return { data: rows };
}

// ─── Get One ──────────────────────────────────────────────────────

/** @no-audit Read-only. */
export async function getMedicalDisclosureAction(disclosureId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const userId = ctx.session.user.id!;

  const row = await db.medicalDisclosure.findFirst({
    where: { id: disclosureId, schoolId: ctx.schoolId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      submittedBy: { select: { id: true, firstName: true, lastName: true } },
      reviewer: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!row) return { error: "Disclosure not found." };

  const isSubmitter = row.submittedByUserId === userId;
  const hasReviewPerm = !assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);
  if (!isSubmitter && !hasReviewPerm) return { error: "Disclosure not found." };

  return { data: row };
}

// ─── Approve ──────────────────────────────────────────────────────

export async function approveMedicalDisclosureAction(input: {
  disclosureId: string;
  reviewNote?: string;
  syncToStudent?: { allergies?: string; conditions?: string };
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const row = await db.medicalDisclosure.findFirst({
    where: { id: input.disclosureId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          allergies: true,
          medicalConditions: true,
        },
      },
    },
  });
  if (!row) return { error: "Disclosure not found." };
  if (row.status !== "PENDING") return { error: "Already reviewed" };

  const reviewer = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });

  const medicalRecordId = await db.$transaction(async (tx) => {
    const mr = await tx.medicalRecord.create({
      data: {
        studentId: row.studentId,
        schoolId: ctx.schoolId,
        date: new Date(),
        type: row.category,
        title: row.title,
        description: row.description,
        attachmentKey: row.attachmentKey,
        recordedBy: userId,
        isConfidential: false,
      },
    });

    await tx.medicalDisclosure.update({
      where: { id: row.id },
      data: {
        status: "APPROVED",
        reviewerUserId: userId,
        reviewNote: input.reviewNote?.trim() || null,
        reviewedAt: new Date(),
        resultingMedicalRecordId: mr.id,
      },
    });

    if (input.syncToStudent) {
      const studentUpdate: Record<string, string> = {};
      if (input.syncToStudent.allergies != null) {
        studentUpdate.allergies = mergeDenormalized(row.student.allergies, input.syncToStudent.allergies);
      }
      if (input.syncToStudent.conditions != null) {
        studentUpdate.medicalConditions = mergeDenormalized(
          row.student.medicalConditions,
          input.syncToStudent.conditions,
        );
      }
      if (Object.keys(studentUpdate).length > 0) {
        await tx.student.update({ where: { id: row.studentId }, data: studentUpdate });
      }
    }

    return mr.id;
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "MedicalDisclosure",
    entityId: row.id,
    module: "parent-requests",
    description: `Approved medical disclosure ${row.id}`,
    newData: { status: "APPROVED", medicalRecordId, sync: input.syncToStudent ?? null },
  });

  try {
    await notifyMedicalDisclosureReviewed({
      disclosureId: row.id,
      submitterUserId: row.submittedByUserId,
      outcome: "APPROVED",
      reviewerName: [reviewer?.firstName, reviewer?.lastName].filter(Boolean).join(" ") || "Nurse",
      reviewNote: input.reviewNote,
      studentName: `${row.student.firstName} ${row.student.lastName}`,
    });
  } catch (err) {
    console.error("notifyMedicalDisclosureReviewed failed", { id: row.id, err });
  }

  return { success: true, medicalRecordId };
}

// ─── Reject ───────────────────────────────────────────────────────

export async function rejectMedicalDisclosureAction(input: {
  disclosureId: string;
  reviewNote: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);
  if (denied) return denied;

  const reviewNote = (input.reviewNote ?? "").trim();
  if (!reviewNote) return { error: "A review note is required to reject." };

  const userId = ctx.session.user.id!;
  const row = await db.medicalDisclosure.findFirst({
    where: { id: input.disclosureId, schoolId: ctx.schoolId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!row) return { error: "Disclosure not found." };
  if (row.status !== "PENDING") return { error: "Already reviewed" };

  const reviewer = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });

  await db.medicalDisclosure.update({
    where: { id: row.id },
    data: {
      status: "REJECTED",
      reviewerUserId: userId,
      reviewNote,
      reviewedAt: new Date(),
    },
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "MedicalDisclosure",
    entityId: row.id,
    module: "parent-requests",
    description: `Rejected medical disclosure ${row.id}`,
    newData: { status: "REJECTED", reviewNote },
  });

  try {
    await notifyMedicalDisclosureReviewed({
      disclosureId: row.id,
      submitterUserId: row.submittedByUserId,
      outcome: "REJECTED",
      reviewerName: [reviewer?.firstName, reviewer?.lastName].filter(Boolean).join(" ") || "Nurse",
      reviewNote,
      studentName: `${row.student.firstName} ${row.student.lastName}`,
    });
  } catch (err) {
    console.error("notifyMedicalDisclosureReviewed failed", { id: row.id, err });
  }

  return { success: true };
}
