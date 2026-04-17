"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { toNum } from "@/lib/decimal";

// ─── Inventory Overview KPIs ────────────────────────────────────────

export async function getInventoryOverviewAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ANALYTICS_READ);
  if (denied) return denied;

  const [
    totalStores,
    totalItems,
    lowStockItems,
    outOfStockItems,
    pendingPOs,
    totalAssets,
    items,
    monthlySpend,
  ] = await Promise.all([
    db.store.count({ where: { schoolId: ctx.schoolId, status: "ACTIVE" } }),
    db.storeItem.count({ where: { store: { schoolId: ctx.schoolId }, status: "ACTIVE" } }),
    db.storeItem.count({
      where: {
        store: { schoolId: ctx.schoolId },
        status: "ACTIVE",
        quantity: { gt: 0 },
        reorderLevel: { gt: 0 },
      },
    }).then(async () => {
      // Low stock: quantity > 0 but <= reorderLevel
      const items = await db.storeItem.findMany({
        where: { store: { schoolId: ctx.schoolId }, status: "ACTIVE", reorderLevel: { gt: 0 } },
        select: { quantity: true, reorderLevel: true },
      });
      return items.filter((i) => i.quantity > 0 && i.quantity <= i.reorderLevel).length;
    }),
    db.storeItem.count({
      where: { store: { schoolId: ctx.schoolId }, status: "ACTIVE", quantity: 0 },
    }),
    db.purchaseOrder.count({
      where: { supplier: { schoolId: ctx.schoolId }, status: { in: ["DRAFT", "SENT"] } },
    }),
    db.fixedAsset.count({ where: { schoolId: ctx.schoolId, status: "ACTIVE" } }),
    db.storeItem.findMany({
      where: { store: { schoolId: ctx.schoolId }, status: "ACTIVE" },
      select: { quantity: true, unitPrice: true },
    }),
    // Monthly spend from purchase orders in current month
    db.purchaseOrder.aggregate({
      where: {
        supplier: { schoolId: ctx.schoolId },
        status: { in: ["SENT", "PARTIALLY_RECEIVED", "RECEIVED"] },
        orderedAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      _sum: { totalAmount: true },
    }),
  ]);

  const totalValue = items.reduce((sum, i) => sum + i.quantity * toNum(i.unitPrice), 0);

  return {
    data: {
      totalStores,
      totalItems,
      totalValue,
      lowStockItems,
      outOfStockItems,
      pendingPOs,
      totalAssets,
      monthlySpend: toNum(monthlySpend._sum.totalAmount),
    },
  };
}

// ─── Stock Movement Trends ──────────────────────────────────────────

export async function getStockTrendAnalyticsAction(months: number = 6) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ANALYTICS_READ);
  if (denied) return denied;

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const movements = await db.stockMovement.findMany({
    where: {
      conductedAt: { gte: startDate },
      storeItem: { store: { schoolId: ctx.schoolId } },
    },
    select: { type: true, quantity: true, conductedAt: true },
  });

  // Group by month
  const monthMap = new Map<string, { month: string; stockIn: number; stockOut: number; adjustments: number; damaged: number }>();

  for (const m of movements) {
    const key = `${m.conductedAt.getFullYear()}-${String(m.conductedAt.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, { month: key, stockIn: 0, stockOut: 0, adjustments: 0, damaged: 0 });
    }
    const entry = monthMap.get(key)!;
    switch (m.type) {
      case "IN":
      case "RETURNED":
        entry.stockIn += m.quantity;
        break;
      case "OUT":
        entry.stockOut += m.quantity;
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

  const data = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  return { data };
}

// ─── ABC Analysis ───────────────────────────────────────────────────

export async function getABCAnalysisAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ANALYTICS_READ);
  if (denied) return denied;

  // Get annual consumption: total OUT movements in the last 12 months
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const movements = await db.stockMovement.findMany({
    where: {
      type: "OUT",
      conductedAt: { gte: oneYearAgo },
      storeItem: { store: { schoolId: ctx.schoolId } },
    },
    select: { storeItemId: true, quantity: true },
  });

  // Aggregate consumption by item
  const consumptionMap = new Map<string, number>();
  for (const m of movements) {
    consumptionMap.set(m.storeItemId, (consumptionMap.get(m.storeItemId) ?? 0) + m.quantity);
  }

  // Get item details
  const items = await db.storeItem.findMany({
    where: { store: { schoolId: ctx.schoolId }, status: "ACTIVE" },
    include: {
      store: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  // Calculate annual consumption value
  const itemData = items.map((item) => {
    const annualQty = consumptionMap.get(item.id) ?? 0;
    const annualValue = annualQty * toNum(item.unitPrice);
    return {
      id: item.id,
      name: item.name,
      storeName: item.store.name,
      categoryName: item.category?.name ?? "Uncategorized",
      unit: item.unit,
      unitPrice: toNum(item.unitPrice),
      annualConsumptionQty: annualQty,
      annualConsumptionValue: annualValue,
      classification: "" as "A" | "B" | "C",
    };
  });

  // Sort by annual value descending
  itemData.sort((a, b) => b.annualConsumptionValue - a.annualConsumptionValue);

  const totalValue = itemData.reduce((sum, i) => sum + i.annualConsumptionValue, 0);

  // Classify: A = top 70%, B = next 20%, C = remaining 10%
  let cumulative = 0;
  for (const item of itemData) {
    cumulative += item.annualConsumptionValue;
    const pct = totalValue > 0 ? (cumulative / totalValue) * 100 : 100;
    item.classification = pct <= 70 ? "A" : pct <= 90 ? "B" : "C";
  }

  const summary = {
    totalAnnualValue: totalValue,
    classA: { count: itemData.filter((i) => i.classification === "A").length, value: itemData.filter((i) => i.classification === "A").reduce((s, i) => s + i.annualConsumptionValue, 0) },
    classB: { count: itemData.filter((i) => i.classification === "B").length, value: itemData.filter((i) => i.classification === "B").reduce((s, i) => s + i.annualConsumptionValue, 0) },
    classC: { count: itemData.filter((i) => i.classification === "C").length, value: itemData.filter((i) => i.classification === "C").reduce((s, i) => s + i.annualConsumptionValue, 0) },
  };

  return { data: itemData, summary };
}

// ─── Category Distribution ──────────────────────────────────────────

export async function getCategoryDistributionAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ANALYTICS_READ);
  if (denied) return denied;

  const items = await db.storeItem.findMany({
    where: { store: { schoolId: ctx.schoolId }, status: "ACTIVE" },
    include: { category: { select: { name: true } } },
  });

  const categoryMap = new Map<string, { name: string; itemCount: number; totalValue: number }>();
  for (const item of items) {
    const catName = item.category?.name ?? "Uncategorized";
    if (!categoryMap.has(catName)) {
      categoryMap.set(catName, { name: catName, itemCount: 0, totalValue: 0 });
    }
    const entry = categoryMap.get(catName)!;
    entry.itemCount++;
    entry.totalValue += item.quantity * toNum(item.unitPrice);
  }

  const data = Array.from(categoryMap.values()).sort((a, b) => b.totalValue - a.totalValue);
  return { data };
}

// ─── Stock Aging Analysis ───────────────────────────────────────────

export async function getStockAgingAnalysisAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ANALYTICS_READ);
  if (denied) return denied;

  const items = await db.storeItem.findMany({
    where: { store: { schoolId: ctx.schoolId }, status: "ACTIVE", quantity: { gt: 0 } },
    include: {
      store: { select: { name: true } },
      category: { select: { name: true } },
      movements: {
        orderBy: { conductedAt: "desc" },
        take: 1,
        select: { conductedAt: true },
      },
    },
  });

  const now = new Date();
  const data = items.map((item) => {
    const lastMovement = item.movements[0]?.conductedAt;
    const daysSinceLastMovement = lastMovement
      ? Math.floor((now.getTime() - lastMovement.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let agingBucket: "0-30" | "31-60" | "61-90" | "91-180" | "180+" | "no-movement";
    if (daysSinceLastMovement === null) {
      agingBucket = "no-movement";
    } else if (daysSinceLastMovement <= 30) {
      agingBucket = "0-30";
    } else if (daysSinceLastMovement <= 60) {
      agingBucket = "31-60";
    } else if (daysSinceLastMovement <= 90) {
      agingBucket = "61-90";
    } else if (daysSinceLastMovement <= 180) {
      agingBucket = "91-180";
    } else {
      agingBucket = "180+";
    }

    return {
      id: item.id,
      name: item.name,
      storeName: item.store.name,
      categoryName: item.category?.name ?? "Uncategorized",
      quantity: item.quantity,
      unitPrice: toNum(item.unitPrice),
      totalValue: item.quantity * toNum(item.unitPrice),
      lastMovementDate: lastMovement,
      daysSinceLastMovement,
      agingBucket,
    };
  });

  // Summary by bucket
  const buckets = ["0-30", "31-60", "61-90", "91-180", "180+", "no-movement"] as const;
  const summary = buckets.map((bucket) => {
    const bucketItems = data.filter((d) => d.agingBucket === bucket);
    return {
      bucket,
      itemCount: bucketItems.length,
      totalValue: bucketItems.reduce((s, i) => s + i.totalValue, 0),
    };
  });

  return { data, summary };
}

// ─── Reorder Analytics ──────────────────────────────────────────────

export async function getReorderAnalyticsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ANALYTICS_READ);
  if (denied) return denied;

  const items = await db.storeItem.findMany({
    where: {
      store: { schoolId: ctx.schoolId },
      status: "ACTIVE",
      reorderLevel: { gt: 0 },
    },
    include: {
      store: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  const needsReorder = items
    .filter((item) => item.quantity <= item.reorderLevel)
    .map((item) => {
      const deficit = item.reorderLevel - item.quantity;
      // Suggest ordering 2x reorder level to reduce ordering frequency
      const suggestedOrderQty = Math.max(deficit, item.reorderLevel * 2);
      return {
        id: item.id,
        name: item.name,
        code: item.code,
        storeName: item.store.name,
        categoryName: item.category?.name ?? "Uncategorized",
        unit: item.unit,
        currentQuantity: item.quantity,
        reorderLevel: item.reorderLevel,
        deficit,
        suggestedOrderQty,
        estimatedCost: suggestedOrderQty * toNum(item.unitPrice),
        unitPrice: toNum(item.unitPrice),
        isOutOfStock: item.quantity === 0,
      };
    })
    .sort((a, b) => (a.isOutOfStock === b.isOutOfStock ? b.deficit - a.deficit : a.isOutOfStock ? -1 : 1));

  const summary = {
    totalItemsNeedingReorder: needsReorder.length,
    outOfStockCount: needsReorder.filter((i) => i.isOutOfStock).length,
    lowStockCount: needsReorder.filter((i) => !i.isOutOfStock).length,
    totalEstimatedCost: needsReorder.reduce((s, i) => s + i.estimatedCost, 0),
  };

  return { data: needsReorder, summary };
}

// ─── Procurement Analytics ──────────────────────────────────────────

export async function getProcurementAnalyticsAction(dateRange?: { from?: string; to?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ANALYTICS_READ);
  if (denied) return denied;

  const dateFilter = {
    ...(dateRange?.from && { gte: new Date(dateRange.from) }),
    ...(dateRange?.to && { lte: new Date(dateRange.to + "T23:59:59.999Z") }),
  };
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  const [orders, requests] = await Promise.all([
    db.purchaseOrder.findMany({
      where: {
        supplier: { schoolId: ctx.schoolId },
        ...(hasDateFilter && { orderedAt: dateFilter }),
      },
      include: {
        supplier: { select: { name: true } },
        items: { include: { storeItem: { select: { name: true } } } },
      },
      orderBy: { orderedAt: "desc" },
    }),
    db.purchaseRequest.findMany({
      where: {
        ...(hasDateFilter && { requestedAt: dateFilter }),
      },
      select: { status: true, requestedAt: true, approvedAt: true },
    }),
  ]);

  // Spending by month
  const spendByMonth = new Map<string, number>();
  for (const o of orders) {
    if (o.status === "CANCELLED") continue;
    const key = `${o.orderedAt.getFullYear()}-${String(o.orderedAt.getMonth() + 1).padStart(2, "0")}`;
    spendByMonth.set(key, (spendByMonth.get(key) ?? 0) + toNum(o.totalAmount));
  }
  const spendTrend = Array.from(spendByMonth.entries())
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // PO status distribution
  const statusCounts = { DRAFT: 0, SENT: 0, PARTIALLY_RECEIVED: 0, RECEIVED: 0, CANCELLED: 0 };
  for (const o of orders) {
    statusCounts[o.status]++;
  }

  // Average approval time (in days)
  const approvedRequests = requests.filter((r) => r.approvedAt);
  const avgApprovalTime =
    approvedRequests.length > 0
      ? approvedRequests.reduce((sum, r) => sum + (r.approvedAt!.getTime() - r.requestedAt.getTime()) / (1000 * 60 * 60 * 24), 0) / approvedRequests.length
      : 0;

  // Top suppliers by spend
  const supplierSpend = new Map<string, { name: string; totalSpend: number; orderCount: number }>();
  for (const o of orders) {
    if (o.status === "CANCELLED") continue;
    const key = o.supplier.name;
    if (!supplierSpend.has(key)) {
      supplierSpend.set(key, { name: key, totalSpend: 0, orderCount: 0 });
    }
    const entry = supplierSpend.get(key)!;
    entry.totalSpend += toNum(o.totalAmount);
    entry.orderCount++;
  }
  const topSuppliers = Array.from(supplierSpend.values())
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 10);

  // Top requested items
  const itemRequestCount = new Map<string, { name: string; totalQty: number }>();
  for (const o of orders) {
    for (const item of o.items) {
      const key = item.storeItem.name;
      if (!itemRequestCount.has(key)) {
        itemRequestCount.set(key, { name: key, totalQty: 0 });
      }
      itemRequestCount.get(key)!.totalQty += item.quantity;
    }
  }
  const topItems = Array.from(itemRequestCount.values())
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, 10);

  const totalSpend = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + toNum(o.totalAmount), 0);

  return {
    data: {
      totalOrders: orders.length,
      totalSpend,
      avgApprovalTimeDays: Math.round(avgApprovalTime * 10) / 10,
      fulfillmentRate: orders.length > 0
        ? Math.round((orders.filter((o) => o.status === "RECEIVED").length / orders.filter((o) => o.status !== "CANCELLED").length) * 100)
        : 0,
      statusCounts,
      spendTrend,
      topSuppliers,
      topItems,
    },
  };
}

// ─── Supplier Performance ───────────────────────────────────────────

export async function getSupplierPerformanceAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ANALYTICS_READ);
  if (denied) return denied;

  const suppliers = await db.supplier.findMany({
    where: { schoolId: ctx.schoolId, status: "ACTIVE" },
    include: {
      purchaseOrders: {
        include: {
          goodsReceived: { include: { items: true } },
          items: true,
        },
      },
      ratings: true,
    },
  });

  const data = suppliers.map((supplier) => {
    const completedOrders = supplier.purchaseOrders.filter((po) => po.status === "RECEIVED");
    const totalOrders = supplier.purchaseOrders.filter((po) => po.status !== "CANCELLED").length;
    const totalSpend = completedOrders.reduce((sum, po) => sum + toNum(po.totalAmount), 0);

    // Quality score: ratio of good condition items received
    let totalReceived = 0;
    let damagedOrExpired = 0;
    for (const po of supplier.purchaseOrders) {
      for (const gr of po.goodsReceived) {
        for (const item of gr.items) {
          totalReceived += item.quantityReceived;
          if (item.condition === "Damaged" || item.condition === "Expired") {
            damagedOrExpired += item.quantityReceived;
          }
        }
      }
    }
    const qualityRate = totalReceived > 0 ? Math.round(((totalReceived - damagedOrExpired) / totalReceived) * 100) : 100;

    // Average rating
    const avgRating =
      supplier.ratings.length > 0
        ? Math.round(
            (supplier.ratings.reduce((sum, r) => sum + toNum(r.overallScore), 0) / supplier.ratings.length) * 10,
          ) / 10
        : null;

    return {
      id: supplier.id,
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      totalOrders,
      completedOrders: completedOrders.length,
      totalSpend,
      qualityRate,
      avgRating,
      ratingCount: supplier.ratings.length,
    };
  });

  return { data: data.sort((a, b) => b.totalSpend - a.totalSpend) };
}

// ─── Asset Analytics ────────────────────────────────────────────────

export async function getAssetAnalyticsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ANALYTICS_READ);
  if (denied) return denied;

  const assets = await db.fixedAsset.findMany({
    where: { schoolId: ctx.schoolId },
    include: {
      category: { select: { name: true } },
      maintenanceRecords: { select: { cost: true, date: true } },
    },
  });

  // Value by category
  const categoryValueMap = new Map<string, { name: string; purchaseValue: number; currentValue: number; count: number }>();
  for (const asset of assets) {
    const cat = asset.category.name;
    if (!categoryValueMap.has(cat)) {
      categoryValueMap.set(cat, { name: cat, purchaseValue: 0, currentValue: 0, count: 0 });
    }
    const entry = categoryValueMap.get(cat)!;
    entry.purchaseValue += toNum(asset.purchasePrice);
    entry.currentValue += toNum(asset.currentValue);
    entry.count++;
  }
  const valueByCategory = Array.from(categoryValueMap.values()).sort((a, b) => b.currentValue - a.currentValue);

  // Condition distribution
  const conditionCounts = { NEW: 0, GOOD: 0, FAIR: 0, POOR: 0, UNSERVICEABLE: 0 };
  for (const asset of assets) {
    if (asset.status === "ACTIVE" || asset.status === "UNDER_MAINTENANCE") {
      conditionCounts[asset.condition]++;
    }
  }

  // Status distribution
  const statusCounts = { ACTIVE: 0, UNDER_MAINTENANCE: 0, DISPOSED: 0, WRITTEN_OFF: 0 };
  for (const asset of assets) {
    statusCounts[asset.status]++;
  }

  // Total maintenance cost
  const maintenanceCosts = assets.reduce(
    (sum, a) => sum + a.maintenanceRecords.reduce((s, m) => s + toNum(m.cost), 0),
    0,
  );

  // Summary
  const activeAssets = assets.filter((a) => a.status === "ACTIVE" || a.status === "UNDER_MAINTENANCE");
  const totalPurchaseValue = activeAssets.reduce((s, a) => s + toNum(a.purchasePrice), 0);
  const totalCurrentValue = activeAssets.reduce((s, a) => s + toNum(a.currentValue), 0);
  const totalDepreciation = totalPurchaseValue - totalCurrentValue;

  return {
    data: {
      totalAssets: assets.length,
      activeAssets: activeAssets.length,
      totalPurchaseValue,
      totalCurrentValue,
      totalDepreciation,
      depreciationRate: totalPurchaseValue > 0 ? Math.round((totalDepreciation / totalPurchaseValue) * 100) : 0,
      maintenanceCosts,
      valueByCategory,
      conditionCounts,
      statusCounts,
    },
  };
}
