"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function getProgrammesAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const programmes = await db.programme.findMany({
    where: { schoolId: school.id },
    orderBy: { name: "asc" },
    include: {
      department: {
        select: { id: true, name: true },
      },
    },
  });

  const data = programmes.map((prog) => ({
    id: prog.id,
    name: prog.name,
    code: prog.code,
    description: prog.description,
    duration: prog.duration,
    status: prog.status,
    departmentId: prog.departmentId,
    departmentName: prog.department?.name ?? null,
    createdAt: prog.createdAt,
    updatedAt: prog.updatedAt,
  }));

  return { data };
}

export async function createProgrammeAction(data: {
  name: string;
  code?: string;
  description?: string;
  departmentId?: string;
  duration?: number;
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
  const existing = await db.programme.findUnique({
    where: {
      schoolId_name: {
        schoolId: school.id,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { error: `A programme named "${data.name}" already exists.` };
  }

  const programme = await db.programme.create({
    data: {
      schoolId: school.id,
      name: data.name,
      code: data.code || null,
      description: data.description || null,
      departmentId: data.departmentId || null,
      duration: data.duration ?? 3,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Programme",
    entityId: programme.id,
    module: "school",
    description: `Created programme "${programme.name}"`,
    newData: programme,
  });

  return { data: programme };
}

export async function updateProgrammeAction(
  id: string,
  data: {
    name?: string;
    code?: string;
    description?: string;
    departmentId?: string | null;
    duration?: number;
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

  const existing = await db.programme.findUnique({
    where: { id },
  });

  if (!existing) {
    return { error: "Programme not found." };
  }

  // Check for duplicate name if name is being changed
  if (data.name && data.name !== existing.name) {
    const duplicate = await db.programme.findUnique({
      where: {
        schoolId_name: {
          schoolId: school.id,
          name: data.name,
        },
      },
    });

    if (duplicate) {
      return { error: `A programme named "${data.name}" already exists.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.programme.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      code: data.code !== undefined ? data.code || null : existing.code,
      description: data.description !== undefined ? data.description || null : existing.description,
      departmentId: data.departmentId !== undefined ? data.departmentId || null : existing.departmentId,
      duration: data.duration ?? existing.duration,
      status: data.status ?? existing.status,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Programme",
    entityId: id,
    module: "school",
    description: `Updated programme "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteProgrammeAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const programme = await db.programme.findUnique({
    where: { id },
  });

  if (!programme) {
    return { error: "Programme not found." };
  }

  await db.programme.delete({
    where: { id },
  });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "Programme",
    entityId: id,
    module: "school",
    description: `Deleted programme "${programme.name}"`,
    previousData: programme,
  });

  return { success: true };
}
