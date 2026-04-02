"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";

// ─── List Stock Takes ───────────────────────────────────────────────

export async function getStockTakesAction(filters?: {
  status?: string;
  storeId?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_STOCK_TAKE_READ);
  if (denied) return denied;

  const stockTakes = await db.stockTake.findMany({
    where: {
      schoolId: ctx.schoolId,
      ...(filters?.status && { status: filters.status as any }),
      ...(filters?.storeId && { storeId: filters.storeId }),
    },
    include: { items: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Fetch store names
  const storeIds = [...new Set(stockTakes.map((st) => st.storeId))];
  const stores = storeIds.length > 0
    ? await db.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true } })
    : [];
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));

  // Fetch user names
  const userIds = [...new Set(stockTakes.flatMap((st) => [st.conductedBy, st.approvedBy].filter(Boolean) as string[]))];
  const users = userIds.length > 0
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = stockTakes.map((st) => ({
    id: st.id,
    reference: st.reference,
    storeId: st.storeId,
    storeName: storeMap.get(st.storeId) ?? "Unknown",
    status: st.status,
    scheduledDate: st.scheduledDate,
    startedAt: st.startedAt,
    completedAt: st.completedAt,
    conductedBy: st.conductedBy,
    conductedByName: st.conductedBy ? userMap.get(st.conductedBy) ?? "Unknown" : null,
    approvedBy: st.approvedBy,
    approvedByName: st.approvedBy ? userMap.get(st.approvedBy) ?? "Unknown" : null,
    itemCount: st.items.length,
    notes: st.notes,
    createdAt: st.createdAt,
  }));

  return { data };
}

// ─── Get Stock Take Detail ──────────────────────────────────────────

export async function getStockTakeAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_STOCK_TAKE_READ);
  if (denied) return denied;

  const stockTake = await db.stockTake.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!stockTake) return { error: "Stock take not found." };

  const store = await db.store.findUnique({ where: { id: stockTake.storeId }, select: { name: true } });

  // Fetch current item quantities for comparison
  const itemIds = stockTake.items.map((i) => i.storeItemId);
  const storeItems = itemIds.length > 0
    ? await db.storeItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, name: true, unit: true, quantity: true, unitPrice: true },
      })
    : [];
  const itemMap = new Map(storeItems.map((i) => [i.id, i]));

  return {
    data: {
      ...stockTake,
      storeName: store?.name ?? "Unknown",
      items: stockTake.items.map((i) => {
        const item = itemMap.get(i.storeItemId);
        return {
          ...i,
          currentSystemQty: item?.quantity ?? 0,
          itemUnit: item?.unit ?? "pcs",
          unitPrice: item ? toNum(item.unitPrice) : 0,
          varianceValue: i.variance ? i.variance * (item ? toNum(item.unitPrice) : 0) : 0,
        };
      }),
    },
  };
}

// ─── Create Stock Take ──────────────────────────────────────────────

export async function createStockTakeAction(data: {
  storeId: string;
  scheduledDate?: string;
  notes?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_STOCK_TAKE_CREATE);
  if (denied) return denied;

  // Verify store exists
  const store = await db.store.findUnique({ where: { id: data.storeId } });
  if (!store) return { error: "Store not found." };

  // Generate reference number
  const year = new Date().getFullYear();
  const last = await db.stockTake.findFirst({
    where: { reference: { startsWith: `ST/${year}/` } },
    orderBy: { reference: "desc" },
  });
  let nextSeq = 1;
  if (last) {
    const parts = last.reference.split("/");
    nextSeq = parseInt(parts[2], 10) + 1;
  }
  const reference = `ST/${year}/${String(nextSeq).padStart(4, "0")}`;

  // Get all active items in the store and snapshot their quantities
  const storeItems = await db.storeItem.findMany({
    where: { storeId: data.storeId, status: "ACTIVE" },
    select: { id: true, name: true, quantity: true },
  });

  const stockTake = await db.stockTake.create({
    data: {
      schoolId: ctx.schoolId,
      storeId: data.storeId,
      reference,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
      notes: data.notes || null,
      items: {
        create: storeItems.map((item) => ({
          storeItemId: item.id,
          itemName: item.name,
          systemQuantity: item.quantity,
        })),
      },
    },
    include: { items: true },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "StockTake",
    entityId: stockTake.id,
    module: "inventory",
    description: `Created stock take ${reference} for store "${store.name}" with ${storeItems.length} items`,
    newData: stockTake,
  });

  return { data: stockTake };
}

// ─── Start Stock Take ───────────────────────────────────────────────

export async function startStockTakeAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_STOCK_TAKE_CREATE);
  if (denied) return denied;

  const stockTake = await db.stockTake.findUnique({ where: { id } });
  if (!stockTake) return { error: "Stock take not found." };
  if (stockTake.status !== "PLANNED") return { error: "Only planned stock takes can be started." };

  const updated = await db.stockTake.update({
    where: { id },
    data: { status: "IN_PROGRESS", startedAt: new Date(), conductedBy: ctx.session.user.id },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "StockTake",
    entityId: id,
    module: "inventory",
    description: `Started stock take ${stockTake.reference}`,
    previousData: { status: "PLANNED" },
    newData: { status: "IN_PROGRESS" },
  });

  return { data: updated };
}

// ─── Record Physical Counts ─────────────────────────────────────────

export async function recordCountAction(
  id: string,
  counts: Array<{ stockTakeItemId: string; physicalQuantity: number; varianceReason?: string }>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_STOCK_TAKE_CREATE);
  if (denied) return denied;

  const stockTake = await db.stockTake.findUnique({ where: { id } });
  if (!stockTake) return { error: "Stock take not found." };
  if (stockTake.status !== "IN_PROGRESS") return { error: "Stock take must be in progress to record counts." };

  for (const count of counts) {
    const item = await db.stockTakeItem.findUnique({ where: { id: count.stockTakeItemId } });
    if (!item || item.stockTakeId !== id) continue;

    const variance = count.physicalQuantity - item.systemQuantity;

    await db.stockTakeItem.update({
      where: { id: count.stockTakeItemId },
      data: {
        physicalQuantity: count.physicalQuantity,
        variance,
        varianceReason: count.varianceReason || null,
      },
    });
  }

  return { data: { updated: counts.length } };
}

// ─── Complete Stock Take ────────────────────────────────────────────

export async function completeStockTakeAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_STOCK_TAKE_CREATE);
  if (denied) return denied;

  const stockTake = await db.stockTake.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!stockTake) return { error: "Stock take not found." };
  if (stockTake.status !== "IN_PROGRESS") return { error: "Only in-progress stock takes can be completed." };

  // Verify all items have been counted
  const uncounted = stockTake.items.filter((i) => i.physicalQuantity === null);
  if (uncounted.length > 0) {
    return { error: `${uncounted.length} item(s) have not been counted yet.` };
  }

  const updated = await db.stockTake.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "StockTake",
    entityId: id,
    module: "inventory",
    description: `Completed stock take ${stockTake.reference}`,
    previousData: { status: "IN_PROGRESS" },
    newData: { status: "COMPLETED" },
  });

  return { data: updated };
}

// ─── Approve Stock Take (Apply Adjustments) ─────────────────────────

export async function approveStockTakeAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_STOCK_TAKE_APPROVE);
  if (denied) return denied;

  const stockTake = await db.stockTake.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!stockTake) return { error: "Stock take not found." };
  if (stockTake.status !== "COMPLETED") return { error: "Only completed stock takes can be approved." };

  // Apply adjustments for all items with variances
  let adjustmentsApplied = 0;
  for (const stItem of stockTake.items) {
    if (stItem.variance === null || stItem.variance === 0) {
      await db.stockTakeItem.update({ where: { id: stItem.id }, data: { adjusted: true } });
      continue;
    }

    const storeItem = await db.storeItem.findUnique({ where: { id: stItem.storeItemId } });
    if (!storeItem) continue;

    const previousQuantity = storeItem.quantity;
    const newQuantity = stItem.physicalQuantity!;

    await db.$transaction([
      db.storeItem.update({
        where: { id: storeItem.id },
        data: { quantity: newQuantity },
      }),
      db.stockMovement.create({
        data: {
          storeItemId: storeItem.id,
          type: "ADJUSTMENT",
          quantity: Math.abs(stItem.variance),
          previousQuantity,
          newQuantity,
          reason: `Stock take ${stockTake.reference}: ${stItem.varianceReason || "Stock take adjustment"}`,
          referenceType: "stockTake",
          referenceId: stockTake.id,
          conductedBy: ctx.session.user.id,
        },
      }),
      db.stockTakeItem.update({
        where: { id: stItem.id },
        data: { adjusted: true },
      }),
    ]);

    adjustmentsApplied++;
  }

  const updated = await db.stockTake.update({
    where: { id },
    data: { status: "APPROVED", approvedBy: ctx.session.user.id },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "StockTake",
    entityId: id,
    module: "inventory",
    description: `Approved stock take ${stockTake.reference} — ${adjustmentsApplied} adjustment(s) applied`,
    previousData: { status: "COMPLETED" },
    newData: { status: "APPROVED" },
  });

  return { data: { ...updated, adjustmentsApplied } };
}

// ─── Variance Summary ───────────────────────────────────────────────

export async function getVarianceSummaryAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_STOCK_TAKE_READ);
  if (denied) return denied;

  const stockTake = await db.stockTake.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!stockTake) return { error: "Stock take not found." };

  // Get item prices for value calculations
  const itemIds = stockTake.items.map((i) => i.storeItemId);
  const storeItems = itemIds.length > 0
    ? await db.storeItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, unitPrice: true },
      })
    : [];
  const priceMap = new Map(storeItems.map((i) => [i.id, toNum(i.unitPrice)]));

  const counted = stockTake.items.filter((i) => i.physicalQuantity !== null);
  const matched = counted.filter((i) => i.variance === 0);
  const over = counted.filter((i) => i.variance !== null && i.variance > 0);
  const short = counted.filter((i) => i.variance !== null && i.variance < 0);

  const overValue = over.reduce((s, i) => s + i.variance! * (priceMap.get(i.storeItemId) ?? 0), 0);
  const shortValue = short.reduce((s, i) => s + Math.abs(i.variance!) * (priceMap.get(i.storeItemId) ?? 0), 0);

  return {
    data: {
      totalItems: stockTake.items.length,
      countedItems: counted.length,
      uncountedItems: stockTake.items.length - counted.length,
      matchedItems: matched.length,
      overItems: over.length,
      shortItems: short.length,
      overValue,
      shortValue,
      netVarianceValue: overValue - shortValue,
      accuracyRate: counted.length > 0 ? Math.round((matched.length / counted.length) * 100) : 0,
    },
  };
}
