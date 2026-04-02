"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Add Expiry Tracking ────────────────────────────────────────────

export async function addExpiryTrackingAction(data: {
  storeItemId: string;
  batchNumber?: string;
  quantity: number;
  expiryDate: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  if (data.quantity <= 0) return { error: "Quantity must be greater than zero." };

  const storeItem = await db.storeItem.findUnique({ where: { id: data.storeItemId } });
  if (!storeItem) return { error: "Item not found." };

  const expiryDate = new Date(data.expiryDate);
  if (isNaN(expiryDate.getTime())) return { error: "Invalid expiry date." };

  const tracking = await db.itemExpiryTracking.create({
    data: {
      storeItemId: data.storeItemId,
      batchNumber: data.batchNumber || null,
      quantity: data.quantity,
      expiryDate,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "ItemExpiryTracking",
    entityId: tracking.id,
    module: "inventory",
    description: `Added expiry tracking for "${storeItem.name}" — batch: ${data.batchNumber || "N/A"}, expires: ${data.expiryDate}`,
    newData: tracking,
  });

  return { data: tracking };
}

// ─── Get Expiring Items ─────────────────────────────────────────────

export async function getExpiringItemsAction(withinDays: number = 30) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + withinDays);

  const expiring = await db.itemExpiryTracking.findMany({
    where: {
      expiryDate: { lte: cutoffDate, gt: new Date() },
      storeItem: { store: { schoolId: school.id }, status: "ACTIVE" },
    },
    include: {
      storeItem: {
        select: {
          id: true,
          name: true,
          unit: true,
          store: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { expiryDate: "asc" },
  });

  const now = new Date();
  const data = expiring.map((e) => {
    const daysUntilExpiry = Math.ceil((e.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: e.id,
      storeItemId: e.storeItemId,
      itemName: e.storeItem.name,
      storeName: e.storeItem.store.name,
      categoryName: e.storeItem.category?.name ?? "Uncategorized",
      unit: e.storeItem.unit,
      batchNumber: e.batchNumber,
      quantity: e.quantity,
      expiryDate: e.expiryDate,
      daysUntilExpiry,
      urgency: daysUntilExpiry <= 7 ? "critical" : daysUntilExpiry <= 14 ? "warning" : "info",
      alertSent: e.alertSent,
    };
  });

  return { data };
}

// ─── Get Expired Items ──────────────────────────────────────────────

export async function getExpiredItemsAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const expired = await db.itemExpiryTracking.findMany({
    where: {
      expiryDate: { lte: new Date() },
      storeItem: { store: { schoolId: school.id }, status: "ACTIVE" },
    },
    include: {
      storeItem: {
        select: {
          id: true,
          name: true,
          unit: true,
          store: { select: { name: true } },
        },
      },
    },
    orderBy: { expiryDate: "asc" },
  });

  const now = new Date();
  const data = expired.map((e) => ({
    id: e.id,
    storeItemId: e.storeItemId,
    itemName: e.storeItem.name,
    storeName: e.storeItem.store.name,
    unit: e.storeItem.unit,
    batchNumber: e.batchNumber,
    quantity: e.quantity,
    expiryDate: e.expiryDate,
    daysExpired: Math.floor((now.getTime() - e.expiryDate.getTime()) / (1000 * 60 * 60 * 24)),
  }));

  return { data };
}
