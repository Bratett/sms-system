"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getInventoryReportAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Total items and total value
  const items = await db.storeItem.findMany({
    where: {
      store: { schoolId: school.id },
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      code: true,
      unit: true,
      quantity: true,
      reorderLevel: true,
      unitPrice: true,
    },
  });

  const totalItems = items.length;
  const totalValue = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  // Items below reorder level (low stock alerts)
  const lowStockItems = items
    .filter((item) => item.quantity <= item.reorderLevel && item.reorderLevel > 0)
    .map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      unit: item.unit,
      currentQuantity: item.quantity,
      reorderLevel: item.reorderLevel,
      deficit: item.reorderLevel - item.quantity,
    }))
    .sort((a, b) => b.deficit - a.deficit);

  // Stock movements summary (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const movementSummaryRaw = await db.stockMovement.groupBy({
    by: ["type"],
    where: {
      conductedAt: { gte: thirtyDaysAgo },
      storeItem: {
        store: { schoolId: school.id },
      },
    },
    _sum: { quantity: true },
    _count: { _all: true },
  });

  const stockMovementsSummary = {
    totalIn:
      movementSummaryRaw.find((r) => r.type === "IN")?._sum.quantity ?? 0,
    totalOut:
      movementSummaryRaw.find((r) => r.type === "OUT")?._sum.quantity ?? 0,
    totalAdjustment:
      movementSummaryRaw.find((r) => r.type === "ADJUSTMENT")?._sum.quantity ??
      0,
  };

  // Top 10 most issued items (by OUT movements in last 30 days)
  const topIssuedRaw = await db.stockMovement.groupBy({
    by: ["storeItemId"],
    where: {
      type: "OUT",
      conductedAt: { gte: thirtyDaysAgo },
      storeItem: {
        store: { schoolId: school.id },
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 10,
  });

  const issuedItemIds = topIssuedRaw.map((r) => r.storeItemId);
  let itemNameMap = new Map<string, string>();
  if (issuedItemIds.length > 0) {
    const issuedItems = await db.storeItem.findMany({
      where: { id: { in: issuedItemIds } },
      select: { id: true, name: true },
    });
    itemNameMap = new Map(issuedItems.map((i) => [i.id, i.name]));
  }

  const topIssuedItems = topIssuedRaw.map((r) => ({
    itemName: itemNameMap.get(r.storeItemId) ?? "Unknown",
    totalIssued: r._sum.quantity ?? 0,
  }));

  // Pending purchase requests count
  const pendingPurchaseRequests = await db.purchaseRequest.count({
    where: {
      status: "PENDING",
      storeId: {
        in: (
          await db.store.findMany({
            where: { schoolId: school.id },
            select: { id: true },
          })
        ).map((s) => s.id),
      },
    },
  });

  return {
    data: {
      totalItems,
      totalValue: Math.round(totalValue * 100) / 100,
      lowStockItems,
      stockMovementsSummary,
      topIssuedItems,
      pendingPurchaseRequests,
    },
  };
}
