"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const record = await db.counselingRecord.create({
    data: {
      schoolId: school.id,
      studentId: data.studentId,
      counselorId: session.user.id!,
      sessionDate: new Date(data.sessionDate),
      type: data.type,
      summary: data.summary,
      actionPlan: data.actionPlan || null,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      isConfidential: data.isConfidential ?? true,
    },
  });

  await audit({
    userId: session.user.id!,
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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: school.id };
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
    data: records,
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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

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
    userId: session.user.id!,
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
