"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Create Intervention ─────────────────────────────────────────────

export async function createInterventionAction(data: {
  studentId: string;
  academicYearId: string;
  termId: string;
  type: string;
  title: string;
  description?: string;
  targetArea?: string;
  startDate: Date;
  endDate?: Date;
  assignedTo?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INTERVENTIONS_CREATE);
  if (denied) return denied;

  const intervention = await db.academicIntervention.create({
    data: {
      studentId: data.studentId,
      schoolId: ctx.schoolId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      type: data.type as any,
      title: data.title,
      description: data.description,
      targetArea: data.targetArea,
      startDate: data.startDate,
      endDate: data.endDate,
      assignedTo: data.assignedTo,
      createdBy: ctx.session.user.id!,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "AcademicIntervention",
    entityId: intervention.id,
    module: "academics",
    description: `Created intervention: ${data.title} for student`,
  });

  return { data: intervention };
}

// ─── Update Intervention ─────────────────────────────────────────────

export async function updateInterventionAction(
  id: string,
  data: {
    title?: string;
    description?: string;
    targetArea?: string;
    endDate?: Date;
    status?: string;
    outcome?: string;
    assignedTo?: string;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INTERVENTIONS_UPDATE);
  if (denied) return denied;

  const existing = await db.academicIntervention.findUnique({ where: { id } });
  if (!existing) return { error: "Intervention not found." };

  const updated = await db.academicIntervention.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.targetArea !== undefined && { targetArea: data.targetArea }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
      ...(data.status !== undefined && { status: data.status as any }),
      ...(data.outcome !== undefined && { outcome: data.outcome }),
      ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "AcademicIntervention",
    entityId: id,
    module: "academics",
    description: `Updated intervention: ${updated.title}`,
  });

  return { data: updated };
}

// ─── Add Note to Intervention ────────────────────────────────────────

export async function addInterventionNoteAction(
  id: string,
  note: { text: string; date?: string },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INTERVENTIONS_UPDATE);
  if (denied) return denied;

  const existing = await db.academicIntervention.findUnique({ where: { id } });
  if (!existing) return { error: "Intervention not found." };

  const currentNotes = (existing.notes as any[]) ?? [];
  const newNote = {
    text: note.text,
    date: note.date ?? new Date().toISOString(),
    addedBy: ctx.session.user.id,
  };

  const updated = await db.academicIntervention.update({
    where: { id },
    data: { notes: [...currentNotes, newNote] },
  });

  return { data: updated };
}

// ─── Get Student Interventions ───────────────────────────────────────

export async function getStudentInterventionsAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INTERVENTIONS_READ);
  if (denied) return denied;

  const interventions = await db.academicIntervention.findMany({
    where: { studentId },
    orderBy: { startDate: "desc" },
  });

  return { data: interventions };
}

// ─── Get Interventions (Admin View) ──────────────────────────────────

export async function getInterventionsAction(filters?: {
  academicYearId?: string;
  termId?: string;
  status?: string;
  type?: string;
  assignedTo?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INTERVENTIONS_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters?.termId) where.termId = filters.termId;
  if (filters?.status) where.status = filters.status;
  if (filters?.type) where.type = filters.type;
  if (filters?.assignedTo) where.assignedTo = filters.assignedTo;

  const interventions = await db.academicIntervention.findMany({
    where,
    orderBy: { startDate: "desc" },
  });

  // Get student info
  const studentIds = [...new Set(interventions.map((i) => i.studentId))];
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const data = interventions.map((i) => {
    const student = studentMap.get(i.studentId);
    return {
      ...i,
      studentIdNumber: student?.studentId ?? "",
      studentName: student ? `${student.lastName} ${student.firstName}` : "Unknown",
    };
  });

  return { data };
}

// ─── Delete Intervention ─────────────────────────────────────────────

export async function deleteInterventionAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INTERVENTIONS_UPDATE);
  if (denied) return denied;

  const existing = await db.academicIntervention.findUnique({ where: { id } });
  if (!existing) return { error: "Intervention not found." };

  await db.academicIntervention.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id!,
    action: "DELETE",
    entity: "AcademicIntervention",
    entityId: id,
    module: "academics",
    description: `Deleted intervention: ${existing.title}`,
  });

  return { data: { deleted: true } };
}
