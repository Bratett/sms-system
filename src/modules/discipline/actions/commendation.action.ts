"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
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
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COMMENDATION_CREATE);
  if (denied) return denied;

  const commendation = await db.commendation.create({
    data: {
      schoolId: ctx.schoolId,
      studentId: data.studentId,
      awardedBy: ctx.session.user.id,
      date: new Date(data.date),
      type: data.type,
      title: data.title,
      description: data.description || null,
      termId: data.termId || null,
      academicYearId: data.academicYearId || null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
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
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COMMENDATION_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
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
