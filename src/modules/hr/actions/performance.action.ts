"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.STAFF_PERFORMANCE_CREATE)) return { error: "Insufficient permissions" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  if (data.rating && (data.rating < 1 || data.rating > 5)) {
    return { error: "Rating must be between 1 and 5" };
  }

  const note = await db.performanceNote.create({
    data: {
      schoolId: school.id,
      staffId: data.staffId,
      reviewerId: session.user.id!,
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
    userId: session.user.id!,
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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.STAFF_PERFORMANCE_READ)) return { error: "Insufficient permissions" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: school.id };
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
