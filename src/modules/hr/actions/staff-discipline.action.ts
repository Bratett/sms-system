"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Report Staff Disciplinary Incident ────────────────────────────

export async function reportStaffDisciplinaryAction(data: {
  staffId: string;
  date: string;
  type: string;
  description: string;
  severity?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const record = await db.staffDisciplinary.create({
    data: {
      schoolId: school.id,
      staffId: data.staffId,
      reportedBy: session.user.id!,
      date: new Date(data.date),
      type: data.type,
      description: data.description,
      severity: data.severity || "MINOR",
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "StaffDisciplinary",
    entityId: record.id,
    module: "hr",
    description: `Reported staff disciplinary: ${data.type} for staff ${data.staffId}`,
  });

  return { data: record };
}

// ─── Get Staff Disciplinary Records ────────────────────────────────

export async function getStaffDisciplinaryRecordsAction(filters?: {
  staffId?: string;
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
  if (filters?.staffId) where.staffId = filters.staffId;
  if (filters?.status) where.status = filters.status;

  const [records, total] = await Promise.all([
    db.staffDisciplinary.findMany({
      where,
      include: { staff: { select: { firstName: true, lastName: true, staffId: true } } },
      orderBy: { date: "desc" },
      skip,
      take: pageSize,
    }),
    db.staffDisciplinary.count({ where }),
  ]);

  return {
    data: records,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// ─── Resolve Staff Disciplinary ────────────────────────────────────

export async function resolveStaffDisciplinaryAction(
  id: string,
  data: { sanction?: string; status: string; notes?: string },
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const previous = await db.staffDisciplinary.findUnique({ where: { id } });
  if (!previous) return { error: "Record not found" };

  const record = await db.staffDisciplinary.update({
    where: { id },
    data: {
      sanction: data.sanction,
      status: data.status,
      notes: data.notes,
      resolvedBy: session.user.id!,
      resolvedAt: new Date(),
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "StaffDisciplinary",
    entityId: id,
    module: "hr",
    description: `Resolved staff disciplinary: ${data.status}`,
    previousData: previous,
    newData: record,
  });

  return { data: record };
}
