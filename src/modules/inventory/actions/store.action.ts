"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Stores ─────────────────────────────────────────────────────────

export async function getStoresAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const stores = await db.store.findMany({
    where: { schoolId: school.id, status: "ACTIVE" },
    include: {
      items: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          reorderLevel: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = stores.map((store) => {
    const itemCount = store.items.length;
    const totalValue = store.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const lowStockCount = store.items.filter(
      (item) => item.quantity <= item.reorderLevel,
    ).length;

    return {
      id: store.id,
      name: store.name,
      description: store.description,
      managerId: store.managerId,
      status: store.status,
      itemCount,
      totalValue,
      lowStockCount,
      createdAt: store.createdAt,
    };
  });

  // Fetch manager names
  const managerIds = data.filter((s) => s.managerId).map((s) => s.managerId!);
  let managerMap = new Map<string, string>();
  if (managerIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: managerIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    managerMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  const result = data.map((s) => ({
    ...s,
    managerName: s.managerId ? managerMap.get(s.managerId) ?? null : null,
  }));

  return { data: result };
}

export async function createStoreAction(data: {
  name: string;
  description?: string;
  managerId?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const existing = await db.store.findUnique({
    where: {
      schoolId_name: {
        schoolId: school.id,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { error: `A store named "${data.name}" already exists.` };
  }

  const store = await db.store.create({
    data: {
      schoolId: school.id,
      name: data.name,
      description: data.description || null,
      managerId: data.managerId || null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Store",
    entityId: store.id,
    module: "inventory",
    description: `Created store "${store.name}"`,
    newData: store,
  });

  return { data: store };
}

export async function updateStoreAction(
  id: string,
  data: {
    name?: string;
    description?: string;
    managerId?: string;
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

  const existing = await db.store.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Store not found." };
  }

  if (data.name && data.name !== existing.name) {
    const duplicate = await db.store.findUnique({
      where: {
        schoolId_name: {
          schoolId: school.id,
          name: data.name,
        },
      },
    });
    if (duplicate) {
      return { error: `A store named "${data.name}" already exists.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.store.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      description: data.description !== undefined ? data.description || null : existing.description,
      managerId: data.managerId !== undefined ? data.managerId || null : existing.managerId,
      status: data.status ?? existing.status,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Store",
    entityId: id,
    module: "inventory",
    description: `Updated store "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteStoreAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const store = await db.store.findUnique({
    where: { id },
    include: { items: { where: { status: "ACTIVE" } } },
  });

  if (!store) {
    return { error: "Store not found." };
  }

  if (store.items.length > 0) {
    return { error: "Cannot delete store with active items. Remove all items first." };
  }

  await db.store.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "Store",
    entityId: id,
    module: "inventory",
    description: `Deleted store "${store.name}"`,
    previousData: store,
  });

  return { success: true };
}

// ─── Item Categories ────────────────────────────────────────────────

export async function getCategoriesAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const categories = await db.itemCategory.findMany({
    where: { schoolId: school.id },
    include: {
      _count: { select: { items: true } },
    },
    orderBy: { name: "asc" },
  });

  const data = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    description: cat.description,
    itemCount: cat._count.items,
    createdAt: cat.createdAt,
  }));

  return { data };
}

export async function createCategoryAction(data: {
  name: string;
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

  const existing = await db.itemCategory.findUnique({
    where: {
      schoolId_name: {
        schoolId: school.id,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { error: `A category named "${data.name}" already exists.` };
  }

  const category = await db.itemCategory.create({
    data: {
      schoolId: school.id,
      name: data.name,
      description: data.description || null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "ItemCategory",
    entityId: category.id,
    module: "inventory",
    description: `Created item category "${category.name}"`,
    newData: category,
  });

  return { data: category };
}

export async function deleteCategoryAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const category = await db.itemCategory.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  });

  if (!category) {
    return { error: "Category not found." };
  }

  if (category._count.items > 0) {
    return { error: "Cannot delete category with items. Reassign items first." };
  }

  await db.itemCategory.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "ItemCategory",
    entityId: id,
    module: "inventory",
    description: `Deleted item category "${category.name}"`,
    previousData: category,
  });

  return { success: true };
}
