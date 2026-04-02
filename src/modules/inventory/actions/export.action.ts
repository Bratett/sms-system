"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { toNum } from "@/lib/decimal";

// ─── Export Stock Report ────────────────────────────────────────────

export async function exportStockReportAction(storeId?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_REPORTS_EXPORT);
  if (denied) return denied;

  const items = await db.storeItem.findMany({
    where: {
      status: "ACTIVE",
      store: {
        schoolId: ctx.schoolId,
        status: "ACTIVE",
        ...(storeId && { id: storeId }),
      },
    },
    include: {
      store: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: [{ store: { name: "asc" } }, { name: "asc" }],
  });

  const rows = items.map((item) => ({
    "Store": item.store.name,
    "Item Name": item.name,
    "Item Code": item.code ?? "",
    "Category": item.category?.name ?? "Uncategorized",
    "Unit": item.unit,
    "Quantity": item.quantity,
    "Reorder Level": item.reorderLevel,
    "Unit Price": toNum(item.unitPrice),
    "Total Value": item.quantity * toNum(item.unitPrice),
    "Status": item.quantity === 0 ? "OUT OF STOCK" : item.quantity <= item.reorderLevel ? "LOW STOCK" : "IN STOCK",
  }));

  return { data: rows };
}

// ─── Export Movement Report ─────────────────────────────────────────

export async function exportMovementReportAction(filters?: {
  storeId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_REPORTS_EXPORT);
  if (denied) return denied;

  const movements = await db.stockMovement.findMany({
    where: {
      storeItem: {
        store: {
          schoolId: ctx.schoolId,
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
          name: true,
          unit: true,
          store: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { conductedAt: "desc" },
  });

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

  const rows = movements.map((m) => ({
    "Date": m.conductedAt.toISOString().split("T")[0],
    "Store": m.storeItem.store.name,
    "Item": m.storeItem.name,
    "Category": m.storeItem.category?.name ?? "Uncategorized",
    "Type": m.type,
    "Quantity": m.quantity,
    "Previous Qty": m.previousQuantity,
    "New Qty": m.newQuantity,
    "Issued To": m.issuedTo ?? "",
    "Reason": m.reason ?? "",
    "Conducted By": conductorMap.get(m.conductedBy) ?? "Unknown",
  }));

  return { data: rows };
}

// ─── Export Asset Register ──────────────────────────────────────────

export async function exportAssetRegisterAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_REPORTS_EXPORT);
  if (denied) return denied;

  const assets = await db.fixedAsset.findMany({
    where: { schoolId: ctx.schoolId },
    include: {
      category: { select: { name: true } },
      depreciationRecords: { orderBy: { calculatedAt: "desc" }, take: 1 },
    },
    orderBy: { assetNumber: "asc" },
  });

  const rows = assets.map((a) => {
    const accDepreciation = toNum(a.purchasePrice) - toNum(a.currentValue);
    return {
      "Asset Number": a.assetNumber,
      "Name": a.name,
      "Description": a.description ?? "",
      "Category": a.category.name,
      "Location": a.location ?? "",
      "Serial Number": a.serialNumber ?? "",
      "Model": a.model ?? "",
      "Manufacturer": a.manufacturer ?? "",
      "Purchase Date": a.purchaseDate?.toISOString().split("T")[0] ?? "",
      "Purchase Price": toNum(a.purchasePrice),
      "Current Value": toNum(a.currentValue),
      "Accumulated Depreciation": accDepreciation,
      "Depreciation Method": a.depreciationMethod,
      "Useful Life (Years)": a.usefulLifeYears ?? "",
      "Condition": a.condition,
      "Status": a.status,
    };
  });

  return { data: rows };
}

// ─── Export Procurement Report ───────────────────────────────────────

export async function exportProcurementReportAction(dateRange?: { from?: string; to?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_REPORTS_EXPORT);
  if (denied) return denied;

  const dateFilter = {
    ...(dateRange?.from && { gte: new Date(dateRange.from) }),
    ...(dateRange?.to && { lte: new Date(dateRange.to + "T23:59:59.999Z") }),
  };
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  const orders = await db.purchaseOrder.findMany({
    where: {
      supplier: { schoolId: ctx.schoolId },
      ...(hasDateFilter && { orderedAt: dateFilter }),
    },
    include: {
      supplier: { select: { name: true } },
      items: { include: { storeItem: { select: { name: true, unit: true } } } },
    },
    orderBy: { orderedAt: "desc" },
  });

  // Fetch orderer names
  const userIds = [...new Set(orders.map((o) => o.orderedBy))];
  let userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  const rows = orders.flatMap((o) =>
    o.items.map((item) => ({
      "Order Number": o.orderNumber,
      "Date": o.orderedAt.toISOString().split("T")[0],
      "Supplier": o.supplier.name,
      "Status": o.status,
      "Item": item.storeItem.name,
      "Quantity": item.quantity,
      "Unit Price": toNum(item.unitPrice),
      "Total Price": toNum(item.totalPrice),
      "Ordered By": userMap.get(o.orderedBy) ?? "Unknown",
    })),
  );

  return { data: rows };
}
