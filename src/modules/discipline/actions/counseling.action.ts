"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  resolveConfidentialCapability,
  redactCounselingRecord,
  logConfidentialAccess,
} from "@/lib/confidential";

// ─── Create Counseling Record ──────────────────────────────────────

export async function createCounselingRecordAction(data: {
  studentId: string;
  sessionDate: string;
  type: string;
  summary: string;
  actionPlan?: string;
  followUpDate?: string;
  isConfidential?: boolean;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COUNSELING_CREATE);
  if (denied) return denied;

  const record = await db.counselingRecord.create({
    data: {
      schoolId: ctx.schoolId,
      studentId: data.studentId,
      counselorId: ctx.session.user.id,
      sessionDate: new Date(data.sessionDate),
      type: data.type,
      summary: data.summary,
      actionPlan: data.actionPlan || null,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      isConfidential: data.isConfidential ?? true,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "CounselingRecord",
    entityId: record.id,
    module: "welfare",
    description: `Created counseling record for student ${data.studentId}`,
  });

  return { data: record };
}

// ─── Get Counseling Records ────────────────────────────────────────

export async function getCounselingRecordsAction(filters?: {
  studentId?: string;
  type?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COUNSELING_READ);
  if (denied) return denied;

  const { canReadConfidential } = resolveConfidentialCapability(
    ctx.session,
    PERMISSIONS.COUNSELING_CONFIDENTIAL_READ,
  );

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.studentId) where.studentId = filters.studentId;
  if (filters?.type) where.type = filters.type;
  if (filters?.status) where.status = filters.status;

  const [records, total] = await Promise.all([
    db.counselingRecord.findMany({
      where,
      orderBy: { sessionDate: "desc" },
      skip,
      take: pageSize,
    }),
    db.counselingRecord.count({ where }),
  ]);

  return {
    data: records.map((r) => redactCounselingRecord(r, canReadConfidential)),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// ─── Update Counseling Record ──────────────────────────────────────

export async function updateCounselingRecordAction(
  id: string,
  data: {
    summary?: string;
    actionPlan?: string;
    followUpDate?: string;
    status?: string;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COUNSELING_UPDATE);
  if (denied) return denied;

  const previous = await db.counselingRecord.findUnique({ where: { id } });
  if (!previous) return { error: "Record not found" };

  const record = await db.counselingRecord.update({
    where: { id },
    data: {
      summary: data.summary,
      actionPlan: data.actionPlan,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
      status: data.status,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "CounselingRecord",
    entityId: id,
    module: "welfare",
    description: `Updated counseling record`,
    previousData: previous,
    newData: record,
  });

  return { data: record };
}

// ─── Get Single Counseling Record (with access logging) ────────────

/**
 * Fetches a single counseling record by id. Writes an audit log entry when
 * the record is confidential. Redacts sensitive fields when the caller
 * lacks COUNSELING_CONFIDENTIAL_READ.
 */
export async function getCounselingRecordAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COUNSELING_READ);
  if (denied) return denied;

  const record = await db.counselingRecord.findFirst({
    where: { id, schoolId: ctx.schoolId },
  });
  if (!record) return { error: "Record not found" };

  const { canReadConfidential } = resolveConfidentialCapability(
    ctx.session,
    PERMISSIONS.COUNSELING_CONFIDENTIAL_READ,
  );

  if (record.isConfidential) {
    await logConfidentialAccess({
      userId: ctx.session.user.id!,
      schoolId: ctx.schoolId,
      entity: "CounselingRecord",
      entityId: record.id,
      isConfidential: true,
      denied: !canReadConfidential,
      module: "welfare",
    });
  }

  return { data: redactCounselingRecord(record, canReadConfidential) };
}
