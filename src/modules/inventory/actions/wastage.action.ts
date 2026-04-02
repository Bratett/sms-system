"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";

// ─── Record Wastage ─────────────────────────────────────────────────

export async function recordWastageAction(data: {
  storeItemId: string;
  quantity: number;
  reason: "EXPIRED" | "DAMAGED" | "SPOILED" | "OBSOLETE" | "OTHER";
  description?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  if (data.quantity <= 0) return { error: "Quantity must be greater than zero." };

  const storeItem = await db.storeItem.findUnique({ where: { id: data.storeItemId } });
  if (!storeItem) return { error: "Item not found." };

  if (storeItem.quantity < data.quantity) {
    return { error: `Insufficient stock. Available: ${storeItem.quantity} ${storeItem.unit}.` };
  }

  const previousQuantity = storeItem.quantity;
  const newQuantity = previousQuantity - data.quantity;

  // Map wastage reason to movement type
  const movementType = data.reason === "EXPIRED" ? "EXPIRED" : "DAMAGED";

  const [wastage] = await db.$transaction([
    db.wastageRecord.create({
      data: {
        storeItemId: data.storeItemId,
        quantity: data.quantity,
        reason: data.reason,
        description: data.description || null,
        recordedBy: session.user.id!,
      },
    }),
    db.storeItem.update({
      where: { id: data.storeItemId },
      data: { quantity: newQuantity },
    }),
    db.stockMovement.create({
      data: {
        storeItemId: data.storeItemId,
        type: movementType,
        quantity: data.quantity,
        previousQuantity,
        newQuantity,
        reason: `Wastage (${data.reason}): ${data.description || "No description"}`,
        referenceType: "wastage",
        conductedBy: session.user.id!,
      },
    }),
  ]);

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "WastageRecord",
    entityId: wastage.id,
    module: "inventory",
    description: `Recorded wastage: ${data.quantity} ${storeItem.unit} of "${storeItem.name}" (${data.reason})`,
    newData: wastage,
  });

  return { data: wastage };
}

// ─── Wastage Report ─────────────────────────────────────────────────

export async function getWastageReportAction(filters?: {
  storeId?: string;
  reason?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const records = await db.wastageRecord.findMany({
    where: {
      storeItem: {
        store: {
          schoolId: school.id,
          ...(filters?.storeId && { id: filters.storeId }),
        },
      },
      ...(filters?.reason && { reason: filters.reason as any }),
      ...(filters?.dateFrom || filters?.dateTo
        ? {
            recordedAt: {
              ...(filters?.dateFrom && { gte: new Date(filters.dateFrom) }),
              ...(filters?.dateTo && { lte: new Date(filters.dateTo + "T23:59:59.999Z") }),
            },
          }
        : {}),
    },
    include: {
      storeItem: {
        select: {
          name: true,
          unit: true,
          unitPrice: true,
          store: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { recordedAt: "desc" },
  });

  // Fetch recorder names
  const recorderIds = [...new Set(records.map((r) => r.recordedBy))];
  const users = recorderIds.length > 0
    ? await db.user.findMany({ where: { id: { in: recorderIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = records.map((r) => ({
    id: r.id,
    itemName: r.storeItem.name,
    storeName: r.storeItem.store.name,
    categoryName: r.storeItem.category?.name ?? "Uncategorized",
    unit: r.storeItem.unit,
    quantity: r.quantity,
    costImpact: r.quantity * toNum(r.storeItem.unitPrice),
    reason: r.reason,
    description: r.description,
    recordedBy: r.recordedBy,
    recordedByName: userMap.get(r.recordedBy) ?? "Unknown",
    recordedAt: r.recordedAt,
  }));

  return { data };
}

// ─── Wastage Analytics ──────────────────────────────────────────────

export async function getWastageAnalyticsAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const records = await db.wastageRecord.findMany({
    where: { storeItem: { store: { schoolId: school.id } } },
    include: {
      storeItem: {
        select: { name: true, unitPrice: true, store: { select: { name: true } }, category: { select: { name: true } } },
      },
    },
  });

  // By reason
  const byReason = new Map<string, { reason: string; count: number; totalQty: number; totalCost: number }>();
  for (const r of records) {
    if (!byReason.has(r.reason)) {
      byReason.set(r.reason, { reason: r.reason, count: 0, totalQty: 0, totalCost: 0 });
    }
    const entry = byReason.get(r.reason)!;
    entry.count++;
    entry.totalQty += r.quantity;
    entry.totalCost += r.quantity * toNum(r.storeItem.unitPrice);
  }

  // By month (last 12 months)
  const byMonth = new Map<string, { month: string; count: number; totalCost: number }>();
  for (const r of records) {
    const key = `${r.recordedAt.getFullYear()}-${String(r.recordedAt.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(key)) {
      byMonth.set(key, { month: key, count: 0, totalCost: 0 });
    }
    const entry = byMonth.get(key)!;
    entry.count++;
    entry.totalCost += r.quantity * toNum(r.storeItem.unitPrice);
  }

  // Top wasted items
  const byItem = new Map<string, { name: string; totalQty: number; totalCost: number }>();
  for (const r of records) {
    const key = r.storeItem.name;
    if (!byItem.has(key)) {
      byItem.set(key, { name: key, totalQty: 0, totalCost: 0 });
    }
    const entry = byItem.get(key)!;
    entry.totalQty += r.quantity;
    entry.totalCost += r.quantity * toNum(r.storeItem.unitPrice);
  }

  const totalCost = records.reduce((s, r) => s + r.quantity * toNum(r.storeItem.unitPrice), 0);

  return {
    data: {
      totalRecords: records.length,
      totalCost,
      byReason: Array.from(byReason.values()),
      byMonth: Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)),
      topWastedItems: Array.from(byItem.values()).sort((a, b) => b.totalCost - a.totalCost).slice(0, 10),
    },
  };
}
