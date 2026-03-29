"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const record = await db.medicalRecord.create({
    data: {
      schoolId: school.id,
      studentId: data.studentId,
      recordedBy: session.user.id!,
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
    userId: session.user.id!,
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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

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
    userId: session.user.id!,
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
