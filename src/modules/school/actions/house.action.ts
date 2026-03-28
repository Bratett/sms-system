"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function getHousesAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const houses = await db.house.findMany({
    where: { schoolId: school.id },
    orderBy: { name: "asc" },
  });

  const data = houses.map((house) => ({
    id: house.id,
    name: house.name,
    color: house.color,
    motto: house.motto,
    description: house.description,
    status: house.status,
    createdAt: house.createdAt,
    updatedAt: house.updatedAt,
  }));

  return { data };
}

export async function createHouseAction(data: {
  name: string;
  color?: string;
  motto?: string;
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
  const existing = await db.house.findUnique({
    where: {
      schoolId_name: {
        schoolId: school.id,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { error: `A house named "${data.name}" already exists.` };
  }

  const house = await db.house.create({
    data: {
      schoolId: school.id,
      name: data.name,
      color: data.color || null,
      motto: data.motto || null,
      description: data.description || null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "House",
    entityId: house.id,
    module: "school",
    description: `Created house "${house.name}"`,
    newData: house,
  });

  return { data: house };
}

export async function updateHouseAction(
  id: string,
  data: {
    name?: string;
    color?: string;
    motto?: string;
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

  const existing = await db.house.findUnique({
    where: { id },
  });

  if (!existing) {
    return { error: "House not found." };
  }

  // Check for duplicate name if name is being changed
  if (data.name && data.name !== existing.name) {
    const duplicate = await db.house.findUnique({
      where: {
        schoolId_name: {
          schoolId: school.id,
          name: data.name,
        },
      },
    });

    if (duplicate) {
      return { error: `A house named "${data.name}" already exists.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.house.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      color: data.color !== undefined ? data.color || null : existing.color,
      motto: data.motto !== undefined ? data.motto || null : existing.motto,
      description: data.description !== undefined ? data.description || null : existing.description,
      status: data.status ?? existing.status,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "House",
    entityId: id,
    module: "school",
    description: `Updated house "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteHouseAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const house = await db.house.findUnique({
    where: { id },
  });

  if (!house) {
    return { error: "House not found." };
  }

  await db.house.delete({
    where: { id },
  });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "House",
    entityId: id,
    module: "school",
    description: `Deleted house "${house.name}"`,
    previousData: house,
  });

  return { success: true };
}
