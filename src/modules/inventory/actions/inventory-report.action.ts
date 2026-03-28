"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// ─── Stock Level Report ─────────────────────────────────────────────

export async function getStockLevelReportAction(storeId?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const items = await db.storeItem.findMany({
    where: {
      status: "ACTIVE",
      store: {
        schoolId: school.id,
        status: "ACTIVE",
        ...(storeId && { id: storeId }),
      },
    },
    include: {
      store: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
    orderBy: [{ store: { name: "asc" } }, { name: "asc" }],
  });

  const data = items.map((item) => ({
    id: item.id,
    name: item.name,
    code: item.code,
    storeName: item.store.name,
    storeId: item.store.id,
    categoryName: item.category?.name ?? "Uncategorized",
    unit: item.unit,
    quantity: item.quantity,
    reorderLevel: item.reorderLevel,
    unitPrice: item.unitPrice,
    totalValue: item.quantity * item.unitPrice,
    status:
      item.quantity === 0
        ? "OUT_OF_STOCK"
        : item.quantity <= item.reorderLevel
          ? "LOW_STOCK"
          : "IN_STOCK",
  }));

  return { data };
}

// ─── Stock Movement Report ──────────────────────────────────────────

export async function getStockMovementReportAction(filters?: {
  storeId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const movements = await db.stockMovement.findMany({
    where: {
      storeItem: {
        store: {
          schoolId: school.id,
          ...(filters?.storeId && { id: filters.storeId }),
        },
      },
      ...(filters?.dateFrom || filters?.dateTo
        ? {
            conductedAt: {
              ...(filters?.dateFrom && { gte: new Date(filters.dateFrom) }),
              ...(filters?.dateTo && { lte: new Date(filters.dateTo + "T23:59:59.999Z") }),
            },
          }
        : {}),
    },
    include: {
      storeItem: {
        select: {
          id: true,
          name: true,
          unit: true,
          category: { select: { name: true } },
          store: { select: { name: true } },
        },
      },
    },
  });

  // Group by item
  const itemMap = new Map<
    string,
    {
      itemId: string;
      itemName: string;
      storeName: string;
      categoryName: string;
      unit: string;
      totalIn: number;
      totalOut: number;
      adjustments: number;
      damaged: number;
    }
  >();

  for (const m of movements) {
    const key = m.storeItemId;
    if (!itemMap.has(key)) {
      itemMap.set(key, {
        itemId: m.storeItem.id,
        itemName: m.storeItem.name,
        storeName: m.storeItem.store.name,
        categoryName: m.storeItem.category?.name ?? "Uncategorized",
        unit: m.storeItem.unit,
        totalIn: 0,
        totalOut: 0,
        adjustments: 0,
        damaged: 0,
      });
    }

    const entry = itemMap.get(key)!;
    switch (m.type) {
      case "IN":
      case "RETURNED":
        entry.totalIn += m.quantity;
        break;
      case "OUT":
        entry.totalOut += m.quantity;
        break;
      case "ADJUSTMENT":
        entry.adjustments += m.quantity;
        break;
      case "DAMAGED":
      case "EXPIRED":
        entry.damaged += m.quantity;
        break;
    }
  }

  const data = Array.from(itemMap.values()).map((entry) => ({
    ...entry,
    netChange: entry.totalIn - entry.totalOut - entry.damaged,
  }));

  return { data };
}

// ─── Stock Valuation ────────────────────────────────────────────────

export async function getStockValuationAction() {
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
          quantity: true,
          unitPrice: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = stores.map((store) => {
    const totalValue = store.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const itemCount = store.items.length;

    return {
      storeId: store.id,
      storeName: store.name,
      itemCount,
      totalValue,
    };
  });

  const grandTotal = data.reduce((sum, s) => sum + s.totalValue, 0);

  return { data, grandTotal };
}
