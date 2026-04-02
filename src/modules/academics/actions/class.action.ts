"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Classes ────────────────────────────────────────────────────────

export async function getClassesAction(academicYearId?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.CLASSES_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (academicYearId) {
    where.academicYearId = academicYearId;
  }

  const classes = await db.class.findMany({
    where,
    orderBy: [{ yearGroup: "asc" }, { name: "asc" }],
    include: {
      classArms: {
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { enrollments: true },
          },
        },
      },
    },
  });

  // We need programme names — fetch all programmes for this school
  const programmes = await db.programme.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  const programmeMap = new Map(programmes.map((p) => [p.id, p.name]));

  const data = classes.map((cls) => {
    const enrollmentCount = cls.classArms.reduce(
      (sum, arm) => sum + arm._count.enrollments,
      0,
    );

    return {
      id: cls.id,
      name: cls.name,
      code: cls.code,
      yearGroup: cls.yearGroup,
      maxCapacity: cls.maxCapacity,
      status: cls.status,
      programmeId: cls.programmeId,
      programmeName: programmeMap.get(cls.programmeId) ?? "Unknown",
      academicYearId: cls.academicYearId,
      classArmCount: cls.classArms.length,
      enrollmentCount,
      classArms: cls.classArms.map((arm) => ({
        id: arm.id,
        name: arm.name,
        capacity: arm.capacity,
        status: arm.status,
        enrollmentCount: arm._count.enrollments,
      })),
      createdAt: cls.createdAt,
      updatedAt: cls.updatedAt,
    };
  });

  return { data };
}

export async function createClassAction(data: {
  programmeId: string;
  academicYearId: string;
  yearGroup: number;
  name: string;
  code?: string;
  maxCapacity?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.CLASSES_CREATE);
  if (denied) return denied;

  // Check for duplicate name within same academic year
  const existing = await db.class.findUnique({
    where: {
      schoolId_name_academicYearId: {
        schoolId: ctx.schoolId,
        name: data.name,
        academicYearId: data.academicYearId,
      },
    },
  });

  if (existing) {
    return { error: `A class named "${data.name}" already exists for this academic year.` };
  }

  const newClass = await db.class.create({
    data: {
      schoolId: ctx.schoolId,
      programmeId: data.programmeId,
      academicYearId: data.academicYearId,
      yearGroup: data.yearGroup,
      name: data.name,
      code: data.code || null,
      maxCapacity: data.maxCapacity ?? 50,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "Class",
    entityId: newClass.id,
    module: "academics",
    description: `Created class "${newClass.name}"`,
    newData: newClass,
  });

  return { data: newClass };
}

export async function updateClassAction(
  id: string,
  data: {
    name?: string;
    code?: string;
    programmeId?: string;
    yearGroup?: number;
    maxCapacity?: number;
    status?: "ACTIVE" | "INACTIVE";
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.CLASSES_UPDATE);
  if (denied) return denied;

  const existing = await db.class.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Class not found." };
  }

  // Check for duplicate name if name is being changed
  if (data.name && data.name !== existing.name) {
    const duplicate = await db.class.findUnique({
      where: {
        schoolId_name_academicYearId: {
          schoolId: ctx.schoolId,
          name: data.name,
          academicYearId: existing.academicYearId,
        },
      },
    });
    if (duplicate) {
      return { error: `A class named "${data.name}" already exists for this academic year.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.class.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      code: data.code !== undefined ? data.code || null : existing.code,
      programmeId: data.programmeId ?? existing.programmeId,
      yearGroup: data.yearGroup ?? existing.yearGroup,
      maxCapacity: data.maxCapacity ?? existing.maxCapacity,
      status: data.status ?? existing.status,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "Class",
    entityId: id,
    module: "academics",
    description: `Updated class "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteClassAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.CLASSES_DELETE);
  if (denied) return denied;

  const existing = await db.class.findUnique({
    where: { id },
    include: {
      classArms: {
        include: {
          _count: { select: { enrollments: true } },
        },
      },
    },
  });

  if (!existing) {
    return { error: "Class not found." };
  }

  // Check if any class arm has enrollments
  const hasEnrollments = existing.classArms.some((arm) => arm._count.enrollments > 0);
  if (hasEnrollments) {
    return { error: "Cannot delete class that has enrolled students. Remove all enrollments first." };
  }

  await db.class.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id!,
    action: "DELETE",
    entity: "Class",
    entityId: id,
    module: "academics",
    description: `Deleted class "${existing.name}"`,
    previousData: existing,
  });

  return { success: true };
}

// ─── Class Arms ─────────────────────────────────────────────────────

export async function getClassArmsAction(classId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.CLASSES_READ);
  if (denied) return denied;

  const classArms = await db.classArm.findMany({
    where: { classId },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { enrollments: true },
      },
    },
  });

  const data = classArms.map((arm) => ({
    id: arm.id,
    classId: arm.classId,
    name: arm.name,
    capacity: arm.capacity,
    status: arm.status,
    enrollmentCount: arm._count.enrollments,
    createdAt: arm.createdAt,
    updatedAt: arm.updatedAt,
  }));

  return { data };
}

export async function createClassArmAction(data: {
  classId: string;
  name: string;
  capacity?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.CLASSES_CREATE);
  if (denied) return denied;

  // Check for duplicate name within same class
  const existing = await db.classArm.findUnique({
    where: {
      classId_name: {
        classId: data.classId,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { error: `Class arm "${data.name}" already exists for this class.` };
  }

  const parentClass = await db.class.findUnique({
    where: { id: data.classId },
    select: { name: true },
  });

  const arm = await db.classArm.create({
    data: {
      schoolId: ctx.schoolId,
      classId: data.classId,
      name: data.name,
      capacity: data.capacity ?? 50,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "ClassArm",
    entityId: arm.id,
    module: "academics",
    description: `Created class arm "${parentClass?.name ?? ""} ${arm.name}"`,
    newData: arm,
  });

  return { data: arm };
}

export async function updateClassArmAction(
  id: string,
  data: {
    name?: string;
    capacity?: number;
    status?: "ACTIVE" | "INACTIVE";
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.CLASSES_UPDATE);
  if (denied) return denied;

  const existing = await db.classArm.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Class arm not found." };
  }

  // Check for duplicate name if name is being changed
  if (data.name && data.name !== existing.name) {
    const duplicate = await db.classArm.findUnique({
      where: {
        classId_name: {
          classId: existing.classId,
          name: data.name,
        },
      },
    });
    if (duplicate) {
      return { error: `Class arm "${data.name}" already exists for this class.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.classArm.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      capacity: data.capacity ?? existing.capacity,
      status: data.status ?? existing.status,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "ClassArm",
    entityId: id,
    module: "academics",
    description: `Updated class arm "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteClassArmAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.CLASSES_DELETE);
  if (denied) return denied;

  const existing = await db.classArm.findUnique({
    where: { id },
    include: {
      _count: { select: { enrollments: true } },
      class: { select: { name: true } },
    },
  });

  if (!existing) {
    return { error: "Class arm not found." };
  }

  if (existing._count.enrollments > 0) {
    return { error: "Cannot delete class arm that has enrolled students. Remove all enrollments first." };
  }

  await db.classArm.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id!,
    action: "DELETE",
    entity: "ClassArm",
    entityId: id,
    module: "academics",
    description: `Deleted class arm "${existing.class.name} ${existing.name}"`,
    previousData: existing,
  });

  return { success: true };
}
