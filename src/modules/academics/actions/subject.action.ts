"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Subjects ────────────────────────────────────────────────────────

export async function getSubjectsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBJECTS_READ);
  if (denied) return denied;

  const subjects = await db.subject.findMany({
    where: { schoolId: ctx.schoolId },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { programmeSubjects: true },
      },
    },
  });

  const data = subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    code: subject.code,
    description: subject.description,
    type: subject.type,
    status: subject.status,
    programmesCount: subject._count.programmeSubjects,
    createdAt: subject.createdAt,
    updatedAt: subject.updatedAt,
  }));

  return { data };
}

export async function createSubjectAction(data: {
  name: string;
  code?: string;
  description?: string;
  type: "CORE" | "ELECTIVE";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBJECTS_CREATE);
  if (denied) return denied;

  // Check for duplicate name
  const existing = await db.subject.findUnique({
    where: {
      schoolId_name: {
        schoolId: ctx.schoolId,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { error: `A subject named "${data.name}" already exists.` };
  }

  const subject = await db.subject.create({
    data: {
      schoolId: ctx.schoolId,
      name: data.name,
      code: data.code || null,
      description: data.description || null,
      type: data.type,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "Subject",
    entityId: subject.id,
    module: "academics",
    description: `Created subject "${subject.name}"`,
    newData: subject,
  });

  return { data: subject };
}

export async function updateSubjectAction(
  id: string,
  data: {
    name?: string;
    code?: string;
    description?: string;
    type?: "CORE" | "ELECTIVE";
    status?: "ACTIVE" | "INACTIVE";
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBJECTS_UPDATE);
  if (denied) return denied;

  const existing = await db.subject.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Subject not found." };
  }

  // Check for duplicate name if name is being changed
  if (data.name && data.name !== existing.name) {
    const duplicate = await db.subject.findUnique({
      where: {
        schoolId_name: {
          schoolId: ctx.schoolId,
          name: data.name,
        },
      },
    });
    if (duplicate) {
      return { error: `A subject named "${data.name}" already exists.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.subject.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      code: data.code !== undefined ? data.code || null : existing.code,
      description: data.description !== undefined ? data.description || null : existing.description,
      type: data.type ?? existing.type,
      status: data.status ?? existing.status,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "Subject",
    entityId: id,
    module: "academics",
    description: `Updated subject "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteSubjectAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBJECTS_DELETE);
  if (denied) return denied;

  const existing = await db.subject.findUnique({
    where: { id },
    include: {
      _count: { select: { marks: true } },
    },
  });

  if (!existing) {
    return { error: "Subject not found." };
  }

  if (existing._count.marks > 0) {
    return { error: "Cannot delete subject that has marks recorded. Remove all marks first." };
  }

  await db.subject.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id!,
    action: "DELETE",
    entity: "Subject",
    entityId: id,
    module: "academics",
    description: `Deleted subject "${existing.name}"`,
    previousData: existing,
  });

  return { success: true };
}

// ─── Programme-Subject Assignments ───────────────────────────────────

export async function getProgrammeSubjectsAction(programmeId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBJECTS_READ);
  if (denied) return denied;

  const programmeSubjects = await db.programmeSubject.findMany({
    where: { programmeId },
    include: {
      subject: {
        select: { id: true, name: true, code: true, type: true, status: true },
      },
    },
    orderBy: { subject: { name: "asc" } },
  });

  const data = programmeSubjects.map((ps) => ({
    id: ps.id,
    programmeId: ps.programmeId,
    subjectId: ps.subjectId,
    isCore: ps.isCore,
    yearGroup: ps.yearGroup,
    subjectName: ps.subject.name,
    subjectCode: ps.subject.code,
    subjectType: ps.subject.type,
    subjectStatus: ps.subject.status,
  }));

  return { data };
}

export async function assignSubjectToProgrammeAction(data: {
  programmeId: string;
  subjectId: string;
  isCore: boolean;
  yearGroup?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBJECTS_CREATE);
  if (denied) return denied;

  // Check for duplicate assignment
  const existing = await db.programmeSubject.findUnique({
    where: {
      programmeId_subjectId: {
        programmeId: data.programmeId,
        subjectId: data.subjectId,
      },
    },
  });

  if (existing) {
    return { error: "This subject is already assigned to the programme." };
  }

  const assignment = await db.programmeSubject.create({
    data: {
      schoolId: ctx.schoolId,
      programmeId: data.programmeId,
      subjectId: data.subjectId,
      isCore: data.isCore,
      yearGroup: data.yearGroup ?? null,
    },
  });

  const assignedSubject = await db.subject.findUnique({
    where: { id: data.subjectId },
    select: { name: true },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "ProgrammeSubject",
    entityId: assignment.id,
    module: "academics",
    description: `Assigned subject "${assignedSubject?.name ?? "Unknown"}" to programme`,
    newData: assignment,
  });

  return { data: assignment };
}

export async function removeSubjectFromProgrammeAction(programmeSubjectId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBJECTS_DELETE);
  if (denied) return denied;

  const existing = await db.programmeSubject.findUnique({
    where: { id: programmeSubjectId },
    include: {
      subject: { select: { name: true } },
    },
  });

  if (!existing) {
    return { error: "Programme-subject assignment not found." };
  }

  await db.programmeSubject.delete({ where: { id: programmeSubjectId } });

  await audit({
    userId: ctx.session.user.id!,
    action: "DELETE",
    entity: "ProgrammeSubject",
    entityId: programmeSubjectId,
    module: "academics",
    description: `Removed subject "${existing.subject.name}" from programme`,
    previousData: existing,
  });

  return { success: true };
}
