"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { PERMISSIONS, denyPermission } from "@/lib/permissions";

// ─── Create Performance Note ───────────────────────────────────────

export async function createPerformanceNoteAction(data: {
  staffId: string;
  period: string;
  academicYearId?: string;
  rating?: number;
  strengths?: string;
  areasForImprovement?: string;
  goals?: string;
  comments?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.STAFF_PERFORMANCE_CREATE)) return { error: "Insufficient permissions" };

  if (data.rating && (data.rating < 1 || data.rating > 5)) {
    return { error: "Rating must be between 1 and 5" };
  }

  const note = await db.performanceNote.create({
    data: {
      schoolId: ctx.schoolId,
      staffId: data.staffId,
      reviewerId: ctx.session.user.id,
      period: data.period,
      academicYearId: data.academicYearId || null,
      rating: data.rating || null,
      strengths: data.strengths || null,
      areasForImprovement: data.areasForImprovement || null,
      goals: data.goals || null,
      comments: data.comments || null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "PerformanceNote",
    entityId: note.id,
    module: "hr",
    description: `Created performance note for staff ${data.staffId}`,
  });

  return { data: note };
}

// ─── Get Performance Notes ─────────────────────────────────────────

export async function getPerformanceNotesAction(filters?: {
  staffId?: string;
  academicYearId?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.STAFF_PERFORMANCE_READ)) return { error: "Insufficient permissions" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.staffId) where.staffId = filters.staffId;
  if (filters?.academicYearId) where.academicYearId = filters.academicYearId;

  const [notes, total] = await Promise.all([
    db.performanceNote.findMany({
      where,
      include: { staff: { select: { firstName: true, lastName: true, staffId: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.performanceNote.count({ where }),
  ]);

  return {
    data: notes,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
