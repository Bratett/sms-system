"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

// ─── Stock In ───────────────────────────────────────────────────────

export async function recordStockInAction(data: {
  storeItemId: string;
  quantity: number;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STOCK_MOVEMENT_CREATE);
  if (denied) return denied;

  if (data.quantity <= 0) {
    return { error: "Quantity must be greater than zero." };
  }

  const item = await db.storeItem.findUnique({ where: { id: data.storeItemId } });
  if (!item) {
    return { error: "Item not found." };
  }

  const previousQuantity = item.quantity;
  const newQuantity = previousQuantity + data.quantity;

  const [movement] = await db.$transaction([
    db.stockMovement.create({
      data: {
        storeItemId: data.storeItemId,
        type: "IN",
        quantity: data.quantity,
        previousQuantity,
        newQuantity,
        reason: data.reason || null,
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        conductedBy: ctx.session.user.id,
      },
    }),
    db.storeItem.update({
      where: { id: data.storeItemId },
      data: { quantity: newQuantity },
    }),
  ]);

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "StockMovement",
    entityId: movement.id,
    module: "inventory",
    description: `Stock IN: ${data.quantity} units of "${item.name}" (${previousQuantity} → ${newQuantity})`,
    newData: movement,
  });

  return { data: movement };
}

// ─── Stock Out ──────────────────────────────────────────────────────

export async function recordStockOutAction(data: {
  storeItemId: string;
  quantity: number;
  reason?: string;
  issuedTo?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STOCK_MOVEMENT_CREATE);
  if (denied) return denied;

  if (data.quantity <= 0) {
    return { error: "Quantity must be greater than zero." };
  }

  const item = await db.storeItem.findUnique({ where: { id: data.storeItemId } });
  if (!item) {
    return { error: "Item not found." };
  }

  if (item.quantity < data.quantity) {
    return { error: `Insufficient stock. Available: ${item.quantity} ${item.unit}.` };
  }

  const previousQuantity = item.quantity;
  const newQuantity = previousQuantity - data.quantity;

  const [movement] = await db.$transaction([
    db.stockMovement.create({
      data: {
        storeItemId: data.storeItemId,
        type: "OUT",
        quantity: data.quantity,
        previousQuantity,
        newQuantity,
        reason: data.reason || null,
        issuedTo: data.issuedTo || null,
        conductedBy: ctx.session.user.id,
      },
    }),
    db.storeItem.update({
      where: { id: data.storeItemId },
      data: { quantity: newQuantity },
    }),
  ]);

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "StockMovement",
    entityId: movement.id,
    module: "inventory",
    description: `Stock OUT: ${data.quantity} units of "${item.name}" (${previousQuantity} → ${newQuantity})`,
    newData: movement,
  });

  return { data: movement };
}

// ─── Adjust Stock ───────────────────────────────────────────────────

export async function adjustStockAction(data: {
  storeItemId: string;
  newQuantity: number;
  reason: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STOCK_MOVEMENT_CREATE);
  if (denied) return denied;

  if (data.newQuantity < 0) {
    return { error: "Quantity cannot be negative." };
  }

  if (!data.reason.trim()) {
    return { error: "A reason is required for stock adjustments." };
  }

  const item = await db.storeItem.findUnique({ where: { id: data.storeItemId } });
  if (!item) {
    return { error: "Item not found." };
  }

  const previousQuantity = item.quantity;
  const difference = data.newQuantity - previousQuantity;

  const [movement] = await db.$transaction([
    db.stockMovement.create({
      data: {
        storeItemId: data.storeItemId,
        type: "ADJUSTMENT",
        quantity: Math.abs(difference),
        previousQuantity,
        newQuantity: data.newQuantity,
        reason: data.reason,
        conductedBy: ctx.session.user.id,
      },
    }),
    db.storeItem.update({
      where: { id: data.storeItemId },
      data: { quantity: data.newQuantity },
    }),
  ]);

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "StockMovement",
    entityId: movement.id,
    module: "inventory",
    description: `Stock ADJUSTMENT: "${item.name}" (${previousQuantity} → ${data.newQuantity}). Reason: ${data.reason}`,
    newData: movement,
  });

  return { data: movement };
}

// ─── Movement History ───────────────────────────────────────────────

export async function getStockMovementsAction(filters?: {
  storeItemId?: string;
  storeId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STOCK_MOVEMENT_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Prisma.StockMovementWhereInput = {
    ...(filters?.storeItemId && { storeItemId: filters.storeItemId }),
    ...(filters?.storeId && { storeItem: { storeId: filters.storeId } }),
    ...(filters?.type && { type: filters.type as Prisma.EnumMovementTypeFilter }),
    ...(filters?.dateFrom || filters?.dateTo
      ? {
          conductedAt: {
            ...(filters?.dateFrom && { gte: new Date(filters.dateFrom) }),
            ...(filters?.dateTo && { lte: new Date(filters.dateTo + "T23:59:59.999Z") }),
          },
        }
      : {}),
  };

  const [movements, total] = await Promise.all([
    db.stockMovement.findMany({
      where,
      include: {
        storeItem: {
          select: {
            id: true,
            name: true,
            unit: true,
            store: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { conductedAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.stockMovement.count({ where }),
  ]);

  // Fetch conductor names
  const conductorIds = [...new Set(movements.map((m) => m.conductedBy))];
  let conductorMap = new Map<string, string>();
  if (conductorIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: conductorIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    conductorMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  const data = movements.map((m) => ({
    id: m.id,
    storeItemId: m.storeItemId,
    itemName: m.storeItem.name,
    itemUnit: m.storeItem.unit,
    storeId: m.storeItem.store.id,
    storeName: m.storeItem.store.name,
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
  }));

  return { data, total, page, pageSize };
}
