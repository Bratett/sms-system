"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";

// ─── Purchase Requests ──────────────────────────────────────────────

export async function getPurchaseRequestsAction(status?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PROCUREMENT_CREATE);
  if (denied) return denied;

  const requests = await db.purchaseRequest.findMany({
    where: {
      ...(status && { status: status as "PENDING" | "APPROVED" | "REJECTED" | "ORDERED" | "RECEIVED" }),
    },
    include: {
      items: {
        include: {
          purchaseRequest: false,
        },
      },
    },
    orderBy: { requestedAt: "desc" },
  });

  // Fetch store names
  const storeIds = [...new Set(requests.map((r) => r.storeId))];
  let storeMap = new Map<string, string>();
  if (storeIds.length > 0) {
    const stores = await db.store.findMany({
      where: { id: { in: storeIds } },
      select: { id: true, name: true },
    });
    storeMap = new Map(stores.map((s) => [s.id, s.name]));
  }

  // Fetch requester names
  const userIds = [...new Set(requests.map((r) => r.requestedBy))];
  let userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  const data = requests.map((r) => {
    const estimatedTotal = r.items.reduce(
      (sum, item) => sum + item.quantityRequested * toNum(item.estimatedUnitPrice),
      0,
    );

    return {
      id: r.id,
      storeId: r.storeId,
      storeName: storeMap.get(r.storeId) ?? "Unknown",
      requestedBy: r.requestedBy,
      requestedByName: userMap.get(r.requestedBy) ?? "Unknown",
      reason: r.reason,
      status: r.status,
      itemCount: r.items.length,
      estimatedTotal,
      requestedAt: r.requestedAt,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt,
    };
  });

  return { data };
}

export async function createPurchaseRequestAction(data: {
  storeId: string;
  reason?: string;
  items: Array<{
    storeItemId: string;
    quantityRequested: number;
    estimatedUnitPrice?: number;
  }>;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PROCUREMENT_CREATE);
  if (denied) return denied;

  if (!data.items || data.items.length === 0) {
    return { error: "At least one item is required." };
  }

  const request = await db.purchaseRequest.create({
    data: {
      storeId: data.storeId,
      requestedBy: ctx.session.user.id,
      reason: data.reason || null,
      items: {
        create: data.items.map((item) => ({
          storeItemId: item.storeItemId,
          quantityRequested: item.quantityRequested,
          estimatedUnitPrice: item.estimatedUnitPrice ?? null,
        })),
      },
    },
    include: { items: true },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "PurchaseRequest",
    entityId: request.id,
    module: "inventory",
    description: `Created purchase request with ${data.items.length} item(s)`,
    newData: request,
  });

  return { data: request };
}

export async function approvePurchaseRequestAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PROCUREMENT_APPROVE);
  if (denied) return denied;

  const request = await db.purchaseRequest.findUnique({ where: { id } });
  if (!request) {
    return { error: "Purchase request not found." };
  }

  if (request.status !== "PENDING") {
    return { error: "Only pending requests can be approved." };
  }

  const updated = await db.purchaseRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedBy: ctx.session.user.id,
      approvedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "PurchaseRequest",
    entityId: id,
    module: "inventory",
    description: `Approved purchase request`,
    previousData: { status: request.status },
    newData: { status: updated.status },
  });

  return { data: updated };
}

export async function rejectPurchaseRequestAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PROCUREMENT_APPROVE);
  if (denied) return denied;

  const request = await db.purchaseRequest.findUnique({ where: { id } });
  if (!request) {
    return { error: "Purchase request not found." };
  }

  if (request.status !== "PENDING") {
    return { error: "Only pending requests can be rejected." };
  }

  const updated = await db.purchaseRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedBy: ctx.session.user.id,
      approvedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "PurchaseRequest",
    entityId: id,
    module: "inventory",
    description: `Rejected purchase request`,
    previousData: { status: request.status },
    newData: { status: updated.status },
  });

  return { data: updated };
}

// ─── Purchase Orders ────────────────────────────────────────────────

export async function getPurchaseOrdersAction(status?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PROCUREMENT_CREATE);
  if (denied) return denied;

  const orders = await db.purchaseOrder.findMany({
    where: {
      ...(status && { status: status as "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED" }),
    },
    include: {
      supplier: { select: { id: true, name: true } },
      items: true,
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

  const data = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    purchaseRequestId: o.purchaseRequestId,
    supplierId: o.supplierId,
    supplierName: o.supplier.name,
    totalAmount: o.totalAmount,
    status: o.status,
    itemCount: o.items.length,
    orderedBy: o.orderedBy,
    orderedByName: userMap.get(o.orderedBy) ?? "Unknown",
    orderedAt: o.orderedAt,
  }));

  return { data };
}

export async function createPurchaseOrderAction(data: {
  supplierId: string;
  purchaseRequestId?: string;
  items: Array<{
    storeItemId: string;
    quantity: number;
    unitPrice: number;
  }>;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PROCUREMENT_CREATE);
  if (denied) return denied;

  if (!data.items || data.items.length === 0) {
    return { error: "At least one item is required." };
  }

  // Generate order number PO/YYYY/NNNN
  const year = new Date().getFullYear();
  const lastOrder = await db.purchaseOrder.findFirst({
    where: {
      orderNumber: { startsWith: `PO/${year}/` },
    },
    orderBy: { orderNumber: "desc" },
  });

  let nextSeq = 1;
  if (lastOrder) {
    const parts = lastOrder.orderNumber.split("/");
    nextSeq = parseInt(parts[2], 10) + 1;
  }
  const orderNumber = `PO/${year}/${String(nextSeq).padStart(4, "0")}`;

  const totalAmount = data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  const order = await db.purchaseOrder.create({
    data: {
      purchaseRequestId: data.purchaseRequestId || null,
      supplierId: data.supplierId,
      orderNumber,
      totalAmount,
      orderedBy: ctx.session.user.id,
      items: {
        create: data.items.map((item) => ({
          storeItemId: item.storeItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
        })),
      },
    },
    include: { items: true },
  });

  // If linked to a purchase request, update its status
  if (data.purchaseRequestId) {
    await db.purchaseRequest.update({
      where: { id: data.purchaseRequestId },
      data: { status: "ORDERED" },
    });
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "PurchaseOrder",
    entityId: order.id,
    module: "inventory",
    description: `Created purchase order ${orderNumber} (GHS ${totalAmount.toFixed(2)})`,
    newData: order,
  });

  return { data: order };
}

export async function updatePurchaseOrderStatusAction(
  id: string,
  status: "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED",
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PROCUREMENT_APPROVE);
  if (denied) return denied;

  const order = await db.purchaseOrder.findUnique({ where: { id } });
  if (!order) {
    return { error: "Purchase order not found." };
  }

  const previousStatus = order.status;

  const updated = await db.purchaseOrder.update({
    where: { id },
    data: { status },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "PurchaseOrder",
    entityId: id,
    module: "inventory",
    description: `Updated PO ${order.orderNumber} status: ${previousStatus} → ${status}`,
    previousData: { status: previousStatus },
    newData: { status },
  });

  return { data: updated };
}

// ─── Goods Received ─────────────────────────────────────────────────

export async function receiveGoodsAction(data: {
  purchaseOrderId: string;
  items: Array<{
    storeItemId: string;
    quantityReceived: number;
    condition?: string;
  }>;
  notes?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PROCUREMENT_CREATE);
  if (denied) return denied;

  const order = await db.purchaseOrder.findUnique({
    where: { id: data.purchaseOrderId },
    include: { items: true },
  });

  if (!order) {
    return { error: "Purchase order not found." };
  }

  if (order.status === "CANCELLED") {
    return { error: "Cannot receive goods for a cancelled order." };
  }

  // Create goods received record
  const goodsReceived = await db.goodsReceived.create({
    data: {
      purchaseOrderId: data.purchaseOrderId,
      receivedBy: ctx.session.user.id,
      notes: data.notes || null,
      items: {
        create: data.items.map((item) => ({
          storeItemId: item.storeItemId,
          quantityReceived: item.quantityReceived,
          condition: item.condition || "Good",
        })),
      },
    },
    include: { items: true },
  });

  // Update stock quantities and create IN movements
  for (const receivedItem of data.items) {
    if (receivedItem.quantityReceived <= 0) continue;

    const storeItem = await db.storeItem.findUnique({
      where: { id: receivedItem.storeItemId },
    });

    if (!storeItem) continue;

    const previousQuantity = storeItem.quantity;
    // Only add good-condition items to stock
    const quantityToAdd =
      receivedItem.condition === "Damaged" || receivedItem.condition === "Expired"
        ? 0
        : receivedItem.quantityReceived;
    const newQuantity = previousQuantity + quantityToAdd;

    await db.$transaction([
      db.stockMovement.create({
        data: {
          storeItemId: receivedItem.storeItemId,
          type: receivedItem.condition === "Damaged" ? "DAMAGED" : receivedItem.condition === "Expired" ? "EXPIRED" : "IN",
          quantity: receivedItem.quantityReceived,
          previousQuantity,
          newQuantity,
          reason: `Goods received from PO ${order.orderNumber}`,
          referenceType: "purchaseOrder",
          referenceId: data.purchaseOrderId,
          conductedBy: ctx.session.user.id,
        },
      }),
      db.storeItem.update({
        where: { id: receivedItem.storeItemId },
        data: { quantity: newQuantity },
      }),
    ]);
  }

  // Check if fully received
  const allGoodsReceived = await db.goodsReceived.findMany({
    where: { purchaseOrderId: data.purchaseOrderId },
    include: { items: true },
  });

  const totalReceivedByItem = new Map<string, number>();
  for (const gr of allGoodsReceived) {
    for (const item of gr.items) {
      totalReceivedByItem.set(
        item.storeItemId,
        (totalReceivedByItem.get(item.storeItemId) ?? 0) + item.quantityReceived,
      );
    }
  }

  const fullyReceived = order.items.every((orderItem) => {
    const received = totalReceivedByItem.get(orderItem.storeItemId) ?? 0;
    return received >= orderItem.quantity;
  });

  const newStatus = fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
  await db.purchaseOrder.update({
    where: { id: data.purchaseOrderId },
    data: { status: newStatus },
  });

  // If linked purchase request and fully received
  if (fullyReceived && order.purchaseRequestId) {
    await db.purchaseRequest.update({
      where: { id: order.purchaseRequestId },
      data: { status: "RECEIVED" },
    });
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "GoodsReceived",
    entityId: goodsReceived.id,
    module: "inventory",
    description: `Received goods for PO ${order.orderNumber} (${data.items.length} item(s))`,
    newData: goodsReceived,
  });

  return { data: goodsReceived };
}
