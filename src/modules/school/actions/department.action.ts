"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function getDepartmentsAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const departments = await db.department.findMany({
    where: { schoolId: school.id },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { programmes: true },
      },
    },
  });

  const data = departments.map((dept) => ({
    id: dept.id,
    name: dept.name,
    code: dept.code,
    description: dept.description,
    status: dept.status,
    programmesCount: dept._count.programmes,
    createdAt: dept.createdAt,
    updatedAt: dept.updatedAt,
  }));

  return { data };
}

export async function createDepartmentAction(data: {
  name: string;
  code?: string;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Check for duplicate name
  const existing = await db.department.findUnique({
    where: {
      schoolId_name: {
        schoolId: school.id,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { error: `A department named "${data.name}" already exists.` };
  }

  const department = await db.department.create({
    data: {
      schoolId: school.id,
      name: data.name,
      code: data.code || null,
      description: data.description || null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Department",
    entityId: department.id,
    module: "school",
    description: `Created department "${department.name}"`,
    newData: department,
  });

  return { data: department };
}

export async function updateDepartmentAction(
  id: string,
  data: {
    name?: string;
    code?: string;
    description?: string;
    status?: "ACTIVE" | "INACTIVE";
  },
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const existing = await db.department.findUnique({
    where: { id },
  });

  if (!existing) {
    return { error: "Department not found." };
  }

  // Check for duplicate name if name is being changed
  if (data.name && data.name !== existing.name) {
    const duplicate = await db.department.findUnique({
      where: {
        schoolId_name: {
          schoolId: school.id,
          name: data.name,
        },
      },
    });

    if (duplicate) {
      return { error: `A department named "${data.name}" already exists.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.department.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      code: data.code !== undefined ? data.code || null : existing.code,
      description: data.description !== undefined ? data.description || null : existing.description,
      status: data.status ?? existing.status,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Department",
    entityId: id,
    module: "school",
    description: `Updated department "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteDepartmentAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const department = await db.department.findUnique({
    where: { id },
    include: {
      _count: {
        select: { programmes: true },
      },
    },
  });

  if (!department) {
    return { error: "Department not found." };
  }

  if (department._count.programmes > 0) {
    return {
      error: `Cannot delete "${department.name}" because it has ${department._count.programmes} programme(s) linked to it. Remove or reassign them first.`,
    };
  }

  await db.department.delete({
    where: { id },
  });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "Department",
    entityId: id,
    module: "school",
    description: `Deleted department "${department.name}"`,
    previousData: department,
  });

  return { success: true };
}
