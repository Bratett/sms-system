"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Create Medical Record ─────────────────────────────────────────

export async function createMedicalRecordAction(data: {
  studentId: string;
  date: string;
  type: string;
  title: string;
  description: string;
  treatment?: string;
  followUpDate?: string;
  isConfidential?: boolean;
  attachmentKey?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_CREATE);
  if (denied) return denied;

  const record = await db.medicalRecord.create({
    data: {
      schoolId: ctx.schoolId,
      studentId: data.studentId,
      recordedBy: ctx.session.user.id!,
      date: new Date(data.date),
      type: data.type,
      title: data.title,
      description: data.description,
      treatment: data.treatment || null,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      isConfidential: data.isConfidential ?? true,
      attachmentKey: data.attachmentKey || null,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "MedicalRecord",
    entityId: record.id,
    module: "medical",
    description: `Created medical record for student ${data.studentId}`,
  });

  return { data: record };
}

// ─── Get Medical Records ───────────────────────────────────────────

export async function getMedicalRecordsAction(filters?: {
  studentId?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.studentId) where.studentId = filters.studentId;
  if (filters?.type) where.type = filters.type;

  const [records, total] = await Promise.all([
    db.medicalRecord.findMany({
      where,
      include: { student: { select: { firstName: true, lastName: true, studentId: true } } },
      orderBy: { date: "desc" },
      skip,
      take: pageSize,
    }),
    db.medicalRecord.count({ where }),
  ]);

  return {
    data: records,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// ─── Update Medical Record ─────────────────────────────────────────

export async function updateMedicalRecordAction(
  id: string,
  data: {
    treatment?: string;
    followUpDate?: string;
    description?: string;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MEDICAL_UPDATE);
  if (denied) return denied;

  const previous = await db.medicalRecord.findUnique({ where: { id } });
  if (!previous) return { error: "Record not found" };

  const record = await db.medicalRecord.update({
    where: { id },
    data: {
      treatment: data.treatment,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
      description: data.description,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "MedicalRecord",
    entityId: id,
    module: "medical",
    description: `Updated medical record`,
    previousData: previous,
    newData: record,
  });

  return { data: record };
}
