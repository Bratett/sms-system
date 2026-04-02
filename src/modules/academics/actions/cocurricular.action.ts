"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Activity CRUD ───────────────────────────────────────────────────

export async function createActivityAction(data: {
  name: string;
  type: string;
  description?: string;
  supervisorId?: string;
  maxParticipants?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COCURRICULAR_CREATE);
  if (denied) return denied;

  const existing = await db.coCurricularActivity.findFirst({
    where: { schoolId: ctx.schoolId, name: data.name },
  });
  if (existing) return { error: "An activity with this name already exists." };

  const activity = await db.coCurricularActivity.create({
    data: {
      schoolId: ctx.schoolId,
      name: data.name,
      type: data.type as any,
      description: data.description,
      supervisorId: data.supervisorId,
      maxParticipants: data.maxParticipants,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "CoCurricularActivity",
    entityId: activity.id,
    module: "academics",
    description: `Created activity: ${data.name}`,
  });

  return { data: activity };
}

export async function updateActivityAction(id: string, data: {
  name?: string;
  type?: string;
  description?: string;
  supervisorId?: string;
  maxParticipants?: number;
  status?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COCURRICULAR_UPDATE);
  if (denied) return denied;

  const existing = await db.coCurricularActivity.findUnique({ where: { id } });
  if (!existing) return { error: "Activity not found." };

  const updated = await db.coCurricularActivity.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type as any }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.supervisorId !== undefined && { supervisorId: data.supervisorId }),
      ...(data.maxParticipants !== undefined && { maxParticipants: data.maxParticipants }),
      ...(data.status !== undefined && { status: data.status as any }),
    },
  });

  return { data: updated };
}

export async function deleteActivityAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COCURRICULAR_UPDATE);
  if (denied) return denied;

  await db.coCurricularActivity.delete({ where: { id } });
  return { data: { deleted: true } };
}

export async function getActivitiesAction(filters?: { type?: string; status?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COCURRICULAR_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.type) where.type = filters.type;
  if (filters?.status) where.status = filters.status;

  const activities = await db.coCurricularActivity.findMany({
    where,
    include: { participations: { select: { id: true } } },
    orderBy: { name: "asc" },
  });

  const data = activities.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    description: a.description,
    supervisorId: a.supervisorId,
    maxParticipants: a.maxParticipants,
    status: a.status,
    participantCount: a.participations.length,
    createdAt: a.createdAt,
  }));

  return { data };
}

// ─── Student Participation ───────────────────────────────────────────

export async function addStudentToActivityAction(data: {
  activityId: string;
  studentId: string;
  academicYearId: string;
  role?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COCURRICULAR_CREATE);
  if (denied) return denied;

  const existing = await db.studentActivity.findFirst({
    where: { activityId: data.activityId, studentId: data.studentId, academicYearId: data.academicYearId },
  });
  if (existing) return { error: "Student is already registered for this activity." };

  const participation = await db.studentActivity.create({
    data: {
      schoolId: ctx.schoolId,
      activityId: data.activityId,
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      role: data.role,
    },
  });

  return { data: participation };
}

export async function removeStudentFromActivityAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COCURRICULAR_UPDATE);
  if (denied) return denied;

  await db.studentActivity.delete({ where: { id } });
  return { data: { deleted: true } };
}

export async function getStudentActivitiesAction(studentId: string, academicYearId?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COCURRICULAR_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { studentId };
  if (academicYearId) where.academicYearId = academicYearId;

  const participations = await db.studentActivity.findMany({
    where,
    include: {
      activity: { select: { id: true, name: true, type: true } },
    },
    orderBy: { joinedAt: "desc" },
  });

  return { data: participations };
}
