"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

// ─── Items ──────────────────────────────────────────────────────────

export async function getItemsAction(filters?: {
  storeId?: string;
  categoryId?: string;
  search?: string;
  lowStock?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Prisma.StoreItemWhereInput = {
    status: "ACTIVE",
    ...(filters?.storeId && { storeId: filters.storeId }),
    ...(filters?.categoryId && { categoryId: filters.categoryId }),
    ...(filters?.search && {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
  };

  // For low stock filter, we need a raw condition
  if (filters?.lowStock) {
    where.AND = [
      {
        quantity: { lte: db.storeItem.fields?.reorderLevel as unknown as number },
      },
    ];
  }

  const [items, total] = await Promise.all([
    db.storeItem.findMany({
      where,
      include: {
        store: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
    }),
    db.storeItem.count({ where }),
  ]);

  // If lowStock filter, further filter in JS since Prisma doesn't support column-to-column comparison
  let filteredItems = items;
  if (filters?.lowStock) {
    filteredItems = items.filter((item) => item.quantity <= item.reorderLevel);
  }

  const data = filteredItems.map((item) => ({
    id: item.id,
    storeId: item.storeId,
    storeName: item.store.name,
    categoryId: item.categoryId,
    categoryName: item.category?.name ?? null,
    name: item.name,
    code: item.code,
    unit: item.unit,
    quantity: item.quantity,
    reorderLevel: item.reorderLevel,
    unitPrice: item.unitPrice,
    value: item.quantity * item.unitPrice,
    description: item.description,
    status: item.status,
    isLowStock: item.quantity <= item.reorderLevel,
    createdAt: item.createdAt,
  }));

  return { data, total, page, pageSize };
}

export async function getItemAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const item = await db.storeItem.findUnique({
    where: { id },
    include: {
      store: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      movements: {
        orderBy: { conductedAt: "desc" },
        take: 20,
      },
    },
  });

  if (!item) {
    return { error: "Item not found." };
  }

  // Fetch conductor names
  const conductorIds = [...new Set(item.movements.map((m) => m.conductedBy))];
  let conductorMap = new Map<string, string>();
  if (conductorIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: conductorIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    conductorMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  const data = {
    id: item.id,
    storeId: item.storeId,
    storeName: item.store.name,
    categoryId: item.categoryId,
    categoryName: item.category?.name ?? null,
    name: item.name,
    code: item.code,
    unit: item.unit,
    quantity: item.quantity,
    reorderLevel: item.reorderLevel,
    unitPrice: item.unitPrice,
    value: item.quantity * item.unitPrice,
    description: item.description,
    status: item.status,
    isLowStock: item.quantity <= item.reorderLevel,
    movements: item.movements.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: m.quantity,
      previousQuantity: m.previousQuantity,
      newQuantity: m.newQuantity,
      reason: m.reason,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      issuedTo: m.issuedTo,
      conductedBy: m.conductedBy,
      conductedByName: conductorMap.get(m.conductedBy) ?? "Unknown",
      conductedAt: m.conductedAt,
    })),
  };

  return { data };
}

export async function createItemAction(data: {
  storeId: string;
  categoryId?: string;
  name: string;
  code?: string;
  unit?: string;
  quantity?: number;
  reorderLevel?: number;
  unitPrice?: number;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  // Check duplicate name in same store
  const existing = await db.storeItem.findUnique({
    where: {
      storeId_name: {
        storeId: data.storeId,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { error: `An item named "${data.name}" already exists in this store.` };
  }

  const item = await db.storeItem.create({
    data: {
      storeId: data.storeId,
      categoryId: data.categoryId || null,
      name: data.name,
      code: data.code || null,
      unit: data.unit ?? "pcs",
      quantity: data.quantity ?? 0,
      reorderLevel: data.reorderLevel ?? 0,
      unitPrice: data.unitPrice ?? 0,
      description: data.description || null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "StoreItem",
    entityId: item.id,
    module: "inventory",
    description: `Created item "${item.name}" in store`,
    newData: item,
  });

  return { data: item };
}

export async function updateItemAction(
  id: string,
  data: {
    categoryId?: string;
    name?: string;
    code?: string;
    unit?: string;
    reorderLevel?: number;
    unitPrice?: number;
    description?: string;
    status?: "ACTIVE" | "INACTIVE";
  },
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const existing = await db.storeItem.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Item not found." };
  }

  if (data.name && data.name !== existing.name) {
    const duplicate = await db.storeItem.findUnique({
      where: {
        storeId_name: {
          storeId: existing.storeId,
          name: data.name,
        },
      },
    });
    if (duplicate) {
      return { error: `An item named "${data.name}" already exists in this store.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.storeItem.update({
    where: { id },
    data: {
      categoryId: data.categoryId !== undefined ? data.categoryId || null : existing.categoryId,
      name: data.name ?? existing.name,
      code: data.code !== undefined ? data.code || null : existing.code,
      unit: data.unit ?? existing.unit,
      reorderLevel: data.reorderLevel !== undefined ? data.reorderLevel : existing.reorderLevel,
      unitPrice: data.unitPrice !== undefined ? data.unitPrice : existing.unitPrice,
      description: data.description !== undefined ? data.description || null : existing.description,
      status: data.status ?? existing.status,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "StoreItem",
    entityId: id,
    module: "inventory",
    description: `Updated item "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteItemAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const item = await db.storeItem.findUnique({
    where: { id },
    include: { _count: { select: { movements: true } } },
  });

  if (!item) {
    return { error: "Item not found." };
  }

  if (item._count.movements > 0) {
    return { error: "Cannot delete item with movement history. Deactivate it instead." };
  }

  await db.storeItem.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "StoreItem",
    entityId: id,
    module: "inventory",
    description: `Deleted item "${item.name}"`,
    previousData: item,
  });

  return { success: true };
}

export async function getLowStockAlertsAction() {
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
        include: {
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = stores
    .map((store) => {
      const lowStockItems = store.items
        .filter((item) => item.quantity <= item.reorderLevel)
        .map((item) => ({
          id: item.id,
          name: item.name,
          code: item.code,
          categoryName: item.category?.name ?? null,
          quantity: item.quantity,
          reorderLevel: item.reorderLevel,
          unit: item.unit,
          unitPrice: item.unitPrice,
        }));

      return {
        storeId: store.id,
        storeName: store.name,
        items: lowStockItems,
      };
    })
    .filter((store) => store.items.length > 0);

  return { data };
}
