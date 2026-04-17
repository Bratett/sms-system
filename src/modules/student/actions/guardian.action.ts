"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── List Guardians ─────────────────────────────────────────────

export async function getGuardiansAction(search?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_READ);
  if (denied) return denied;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ];
  }

  const guardians = await db.guardian.findMany({
    where,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: {
      _count: {
        select: { students: true },
      },
    },
  });

  const data = guardians.map((g) => ({
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    phone: g.phone,
    altPhone: g.altPhone,
    email: g.email,
    occupation: g.occupation,
    address: g.address,
    relationship: g.relationship,
    studentCount: g._count.students,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  }));

  return { data };
}

// ─── Single Guardian ────────────────────────────────────────────

export async function getGuardianAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const guardian = await db.guardian.findUnique({
    where: { id },
    include: {
      students: {
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!guardian) {
    return { error: "Guardian not found." };
  }

  return {
    data: {
      id: guardian.id,
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      phone: guardian.phone,
      altPhone: guardian.altPhone,
      email: guardian.email,
      occupation: guardian.occupation,
      address: guardian.address,
      relationship: guardian.relationship,
      createdAt: guardian.createdAt,
      updatedAt: guardian.updatedAt,
      students: guardian.students.map((sg) => ({
        id: sg.student.id,
        studentId: sg.student.studentId,
        firstName: sg.student.firstName,
        lastName: sg.student.lastName,
        status: sg.student.status,
        isPrimary: sg.isPrimary,
      })),
    },
  };
}

// ─── Create Guardian ────────────────────────────────────────────

export async function createGuardianAction(data: {
  firstName: string;
  lastName: string;
  phone: string;
  altPhone?: string;
  email?: string;
  occupation?: string;
  address?: string;
  relationship?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_UPDATE);
  if (denied) return denied;

  if (!data.firstName?.trim() || !data.lastName?.trim()) {
    return { error: "Guardian first and last names are required." };
  }

  if (!data.phone?.trim()) {
    return { error: "Guardian phone number is required." };
  }

  const guardian = await db.guardian.create({
    data: {
      schoolId: ctx.schoolId,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone.trim(),
      altPhone: data.altPhone?.trim() || null,
      email: data.email?.trim() || null,
      occupation: data.occupation?.trim() || null,
      address: data.address?.trim() || null,
      relationship: data.relationship?.trim() || null,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "Guardian",
    entityId: guardian.id,
    module: "student",
    description: `Created guardian "${guardian.firstName} ${guardian.lastName}"`,
    newData: guardian,
  });

  return { data: guardian };
}

// ─── Update Guardian ────────────────────────────────────────────

export async function updateGuardianAction(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    altPhone?: string;
    email?: string;
    occupation?: string;
    address?: string;
    relationship?: string;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_UPDATE);
  if (denied) return denied;

  const existing = await db.guardian.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Guardian not found." };
  }

  const previousData = { ...existing };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};
  if (data.firstName !== undefined) updateData.firstName = data.firstName.trim();
  if (data.lastName !== undefined) updateData.lastName = data.lastName.trim();
  if (data.phone !== undefined) updateData.phone = data.phone.trim();
  if (data.altPhone !== undefined) updateData.altPhone = data.altPhone?.trim() || null;
  if (data.email !== undefined) updateData.email = data.email?.trim() || null;
  if (data.occupation !== undefined) updateData.occupation = data.occupation?.trim() || null;
  if (data.address !== undefined) updateData.address = data.address?.trim() || null;
  if (data.relationship !== undefined) updateData.relationship = data.relationship?.trim() || null;

  const updated = await db.guardian.update({
    where: { id },
    data: updateData,
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "Guardian",
    entityId: id,
    module: "student",
    description: `Updated guardian "${updated.firstName} ${updated.lastName}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

// ─── Link Guardian to Student ───────────────────────────────────

export async function linkGuardianToStudentAction(
  studentId: string,
  guardianId: string,
  isPrimary?: boolean,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_UPDATE);
  if (denied) return denied;

  // Check if link already exists
  const existing = await db.studentGuardian.findUnique({
    where: {
      studentId_guardianId: {
        studentId,
        guardianId,
      },
    },
  });

  if (existing) {
    return { error: "This guardian is already linked to this student." };
  }

  const link = await db.studentGuardian.create({
    data: {
      schoolId: ctx.schoolId,
      studentId,
      guardianId,
      isPrimary: isPrimary ?? false,
    },
  });

  // If set as primary, unset other primary guardians for this student
  if (isPrimary) {
    await db.studentGuardian.updateMany({
      where: {
        studentId,
        id: { not: link.id },
      },
      data: { isPrimary: false },
    });
  }

  const [student, guardian] = await Promise.all([
    db.student.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true } }),
    db.guardian.findUnique({ where: { id: guardianId }, select: { firstName: true, lastName: true } }),
  ]);

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "StudentGuardian",
    entityId: link.id,
    module: "student",
    description: `Linked guardian "${guardian?.firstName} ${guardian?.lastName}" to student "${student?.firstName} ${student?.lastName}"`,
    newData: link,
  });

  return { data: link };
}

// ─── Unlink Guardian from Student ───────────────────────────────

export async function unlinkGuardianFromStudentAction(studentId: string, guardianId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_UPDATE);
  if (denied) return denied;

  const existing = await db.studentGuardian.findUnique({
    where: {
      studentId_guardianId: {
        studentId,
        guardianId,
      },
    },
  });

  if (!existing) {
    return { error: "Guardian link not found." };
  }

  await db.studentGuardian.delete({
    where: { id: existing.id },
  });

  const [student, guardian] = await Promise.all([
    db.student.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true } }),
    db.guardian.findUnique({ where: { id: guardianId }, select: { firstName: true, lastName: true } }),
  ]);

  await audit({
    userId: ctx.session.user.id!,
    action: "DELETE",
    entity: "StudentGuardian",
    entityId: existing.id,
    module: "student",
    description: `Unlinked guardian "${guardian?.firstName} ${guardian?.lastName}" from student "${student?.firstName} ${student?.lastName}"`,
    previousData: existing,
  });

  return { success: true };
}

// ─── Get Student's Guardians ────────────────────────────────────

export async function getStudentGuardiansAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_READ);
  if (denied) return denied;

  const links = await db.studentGuardian.findMany({
    where: { studentId },
    include: {
      guardian: true,
    },
    orderBy: {
      isPrimary: "desc",
    },
  });

  const data = links.map((link) => ({
    id: link.guardian.id,
    firstName: link.guardian.firstName,
    lastName: link.guardian.lastName,
    phone: link.guardian.phone,
    altPhone: link.guardian.altPhone,
    email: link.guardian.email,
    occupation: link.guardian.occupation,
    address: link.guardian.address,
    relationship: link.guardian.relationship,
    isPrimary: link.isPrimary,
  }));

  return { data };
}
