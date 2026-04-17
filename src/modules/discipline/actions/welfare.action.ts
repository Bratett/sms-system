"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Create Welfare Note ───────────────────────────────────────────

export async function createWelfareNoteAction(data: {
  studentId: string;
  date: string;
  category: string;
  description: string;
  actionTaken?: string;
  followUpRequired?: boolean;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.WELFARE_CREATE);
  if (denied) return denied;

  const note = await db.welfareNote.create({
    data: {
      schoolId: ctx.schoolId,
      studentId: data.studentId,
      createdBy: ctx.session.user.id,
      date: new Date(data.date),
      category: data.category,
      description: data.description,
      actionTaken: data.actionTaken || null,
      followUpRequired: data.followUpRequired ?? false,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "WelfareNote",
    entityId: note.id,
    module: "welfare",
    description: `Created welfare note for student ${data.studentId}`,
  });

  return { data: note };
}

// ─── Get Welfare Notes ─────────────────────────────────────────────

export async function getWelfareNotesAction(filters?: {
  studentId?: string;
  category?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.WELFARE_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.studentId) where.studentId = filters.studentId;
  if (filters?.category) where.category = filters.category;
  if (filters?.status) where.status = filters.status;

  const [notes, total] = await Promise.all([
    db.welfareNote.findMany({ where, orderBy: { date: "desc" }, skip, take: pageSize }),
    db.welfareNote.count({ where }),
  ]);

  return {
    data: notes,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// ─── Update Welfare Note ───────────────────────────────────────────

export async function updateWelfareNoteAction(
  id: string,
  data: { actionTaken?: string; status?: string; followUpRequired?: boolean },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.WELFARE_UPDATE);
  if (denied) return denied;

  const previous = await db.welfareNote.findUnique({ where: { id } });
  if (!previous) return { error: "Note not found" };

  const note = await db.welfareNote.update({
    where: { id },
    data: {
      actionTaken: data.actionTaken,
      status: data.status,
      followUpRequired: data.followUpRequired,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "WelfareNote",
    entityId: id,
    module: "welfare",
    description: `Updated welfare note`,
    previousData: previous,
    newData: note,
  });

  return { data: note };
}
