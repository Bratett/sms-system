"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── List Households ───────────────────────────────────────────────

export async function getHouseholdsAction(filters?: { search?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOUSEHOLDS_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  const households = await db.household.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { guardians: true, students: true } } },
  });

  return {
    data: households.map((h) => ({
      id: h.id,
      name: h.name,
      address: h.address,
      notes: h.notes,
      guardianCount: h._count.guardians,
      studentCount: h._count.students,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
    })),
  };
}

// ─── Single Household (detail) ─────────────────────────────────────

export async function getHouseholdAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOUSEHOLDS_READ);
  if (denied) return denied;

  const household = await db.household.findFirst({
    where: { id, schoolId: ctx.schoolId },
    include: {
      guardians: {
        select: { id: true, firstName: true, lastName: true, phone: true, relationship: true },
      },
      students: {
        select: { id: true, studentId: true, firstName: true, lastName: true, status: true },
      },
    },
  });
  if (!household) return { error: "Household not found" };

  return {
    data: {
      id: household.id,
      name: household.name,
      address: household.address,
      notes: household.notes,
      guardians: household.guardians,
      students: household.students,
      createdAt: household.createdAt,
      updatedAt: household.updatedAt,
    },
  };
}

// ─── Create Household ──────────────────────────────────────────────

export async function createHouseholdAction(data: {
  name: string;
  address?: string;
  notes?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOUSEHOLDS_MANAGE);
  if (denied) return denied;

  if (!data.name?.trim()) return { error: "Household name is required." };

  const household = await db.household.create({
    data: {
      schoolId: ctx.schoolId,
      name: data.name.trim(),
      address: data.address?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "Household",
    entityId: household.id,
    module: "student",
    description: `Created household "${household.name}"`,
    newData: household,
  });

  return { data: household };
}

// ─── Update Household ──────────────────────────────────────────────

export async function updateHouseholdAction(
  id: string,
  data: { name?: string; address?: string; notes?: string },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOUSEHOLDS_MANAGE);
  if (denied) return denied;

  const existing = await db.household.findFirst({ where: { id, schoolId: ctx.schoolId } });
  if (!existing) return { error: "Household not found" };

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.address !== undefined) updateData.address = data.address?.trim() || null;
  if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;

  const updated = await db.household.update({ where: { id }, data: updateData });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Household",
    entityId: id,
    module: "student",
    description: `Updated household "${updated.name}"`,
    previousData: existing,
    newData: updated,
  });

  return { data: updated };
}

// ─── Delete Household ──────────────────────────────────────────────

export async function deleteHouseholdAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOUSEHOLDS_MANAGE);
  if (denied) return denied;

  const existing = await db.household.findFirst({
    where: { id, schoolId: ctx.schoolId },
    include: { _count: { select: { guardians: true, students: true } } },
  });
  if (!existing) return { error: "Household not found" };

  if (existing._count.guardians > 0 || existing._count.students > 0) {
    return {
      error: `Cannot delete non-empty household (${existing._count.guardians} guardians, ${existing._count.students} students)`,
    };
  }

  await db.household.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "DELETE",
    entity: "Household",
    entityId: id,
    module: "student",
    description: `Deleted household "${existing.name}"`,
    previousData: existing,
  });

  return { success: true };
}

// ─── Move Guardian to Household ────────────────────────────────────

export async function moveGuardianToHouseholdAction(
  guardianId: string,
  householdId: string | null,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOUSEHOLDS_MANAGE);
  if (denied) return denied;

  const guardian = await db.guardian.findFirst({
    where: { id: guardianId, schoolId: ctx.schoolId },
  });
  if (!guardian) return { error: "Guardian not found" };

  if (householdId !== null) {
    const household = await db.household.findFirst({
      where: { id: householdId, schoolId: ctx.schoolId },
    });
    if (!household) return { error: "Household not found" };
  }

  const updated = await db.guardian.update({
    where: { id: guardianId },
    data: { householdId },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Guardian",
    entityId: guardianId,
    module: "student",
    description: householdId
      ? `Moved guardian "${guardian.firstName} ${guardian.lastName}" to household ${householdId}`
      : `Removed guardian "${guardian.firstName} ${guardian.lastName}" from household`,
    previousData: { householdId: guardian.householdId },
    newData: { householdId: updated.householdId },
  });

  return { success: true };
}

// ─── Move Student to Household ─────────────────────────────────────

export async function moveStudentToHouseholdAction(
  studentId: string,
  householdId: string | null,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOUSEHOLDS_MANAGE);
  if (denied) return denied;

  const student = await db.student.findFirst({
    where: { id: studentId, schoolId: ctx.schoolId },
  });
  if (!student) return { error: "Student not found" };

  if (householdId !== null) {
    const household = await db.household.findFirst({
      where: { id: householdId, schoolId: ctx.schoolId },
    });
    if (!household) return { error: "Household not found" };
  }

  const updated = await db.student.update({
    where: { id: studentId },
    data: { householdId },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Student",
    entityId: studentId,
    module: "student",
    description: householdId
      ? `Moved student to household ${householdId}`
      : `Removed student from household`,
    previousData: { householdId: student.householdId },
    newData: { householdId: updated.householdId },
  });

  return { success: true };
}
