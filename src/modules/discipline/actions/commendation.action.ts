"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Create Commendation ───────────────────────────────────────────

export async function createCommendationAction(data: {
  studentId: string;
  date: string;
  type: string;
  title: string;
  description?: string;
  termId?: string;
  academicYearId?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const commendation = await db.commendation.create({
    data: {
      schoolId: school.id,
      studentId: data.studentId,
      awardedBy: session.user.id!,
      date: new Date(data.date),
      type: data.type,
      title: data.title,
      description: data.description || null,
      termId: data.termId || null,
      academicYearId: data.academicYearId || null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Commendation",
    entityId: commendation.id,
    module: "welfare",
    description: `Awarded commendation "${data.title}" to student ${data.studentId}`,
  });

  return { data: commendation };
}

// ─── Get Commendations ─────────────────────────────────────────────

export async function getCommendationsAction(filters?: {
  studentId?: string;
  type?: string;
  termId?: string;
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
  if (filters?.termId) where.termId = filters.termId;

  const [records, total] = await Promise.all([
    db.commendation.findMany({ where, orderBy: { date: "desc" }, skip, take: pageSize }),
    db.commendation.count({ where }),
  ]);

  return {
    data: records,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
