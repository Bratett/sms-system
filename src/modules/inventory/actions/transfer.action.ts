"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── List Transfers ─────────────────────────────────────────────────

export async function getTransfersAction(filters?: {
  status?: string;
  storeId?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const transfers = await db.storeTransfer.findMany({
    where: {
      schoolId: school.id,
      ...(filters?.status && { status: filters.status as any }),
      ...(filters?.storeId && {
        OR: [{ fromStoreId: filters.storeId }, { toStoreId: filters.storeId }],
      }),
    },
    include: {
      items: true,
    },
    orderBy: { requestedAt: "desc" },
  });

  // Fetch store names
  const storeIds = [...new Set(transfers.flatMap((t) => [t.fromStoreId, t.toStoreId]))];
  const stores = storeIds.length > 0
    ? await db.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true } })
    : [];
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));

  // Fetch user names
  const userIds = [...new Set(transfers.flatMap((t) => [t.requestedBy, t.approvedBy].filter(Boolean) as string[]))];
  const users = userIds.length > 0
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = transfers.map((t) => ({
    id: t.id,
    transferNumber: t.transferNumber,
    fromStoreId: t.fromStoreId,
    fromStoreName: storeMap.get(t.fromStoreId) ?? "Unknown",
    toStoreId: t.toStoreId,
    toStoreName: storeMap.get(t.toStoreId) ?? "Unknown",
    requestedBy: t.requestedBy,
    requestedByName: userMap.get(t.requestedBy) ?? "Unknown",
    approvedBy: t.approvedBy,
    approvedByName: t.approvedBy ? userMap.get(t.approvedBy) ?? "Unknown" : null,
    status: t.status,
    reason: t.reason,
    itemCount: t.items.length,
    requestedAt: t.requestedAt,
    approvedAt: t.approvedAt,
    completedAt: t.completedAt,
  }));

  return { data };
}

// ─── Get Transfer Detail ────────────────────────────────────────────

export async function getTransferAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const transfer = await db.storeTransfer.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!transfer) return { error: "Transfer not found." };

  // Fetch item names
  const itemIds = transfer.items.map((i) => i.storeItemId);
  const storeItems = itemIds.length > 0
    ? await db.storeItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, name: true, unit: true, quantity: true },
      })
    : [];
  const itemMap = new Map(storeItems.map((i) => [i.id, i]));

  // Fetch store names
  const stores = await db.store.findMany({
    where: { id: { in: [transfer.fromStoreId, transfer.toStoreId] } },
    select: { id: true, name: true },
  });
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));

  return {
    data: {
      ...transfer,
      fromStoreName: storeMap.get(transfer.fromStoreId) ?? "Unknown",
      toStoreName: storeMap.get(transfer.toStoreId) ?? "Unknown",
      items: transfer.items.map((i) => {
        const item = itemMap.get(i.storeItemId);
        return {
          ...i,
          itemName: item?.name ?? "Unknown",
          itemUnit: item?.unit ?? "pcs",
          availableQty: item?.quantity ?? 0,
        };
      }),
    },
  };
}

// ─── Create Transfer ────────────────────────────────────────────────

export async function createTransferAction(data: {
  fromStoreId: string;
  toStoreId: string;
  reason?: string;
  items: Array<{ storeItemId: string; quantity: number }>;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  if (data.fromStoreId === data.toStoreId) {
    return { error: "Source and destination stores must be different." };
  }

  if (!data.items || data.items.length === 0) {
    return { error: "At least one item is required." };
  }

  // Validate all items exist and have sufficient stock
  for (const item of data.items) {
    if (item.quantity <= 0) return { error: "All quantities must be greater than zero." };
    const storeItem = await db.storeItem.findUnique({ where: { id: item.storeItemId } });
    if (!storeItem) return { error: `Item not found: ${item.storeItemId}` };
    if (storeItem.storeId !== data.fromStoreId) return { error: `Item "${storeItem.name}" does not belong to the source store.` };
    if (storeItem.quantity < item.quantity) return { error: `Insufficient stock for "${storeItem.name}". Available: ${storeItem.quantity}` };
  }

  // Generate transfer number
  const year = new Date().getFullYear();
  const lastTransfer = await db.storeTransfer.findFirst({
    where: { transferNumber: { startsWith: `TRF/${year}/` } },
    orderBy: { transferNumber: "desc" },
  });
  let nextSeq = 1;
  if (lastTransfer) {
    const parts = lastTransfer.transferNumber.split("/");
    nextSeq = parseInt(parts[2], 10) + 1;
  }
  const transferNumber = `TRF/${year}/${String(nextSeq).padStart(4, "0")}`;

  const transfer = await db.storeTransfer.create({
    data: {
      schoolId: school.id,
      transferNumber,
      fromStoreId: data.fromStoreId,
      toStoreId: data.toStoreId,
      requestedBy: session.user.id!,
      reason: data.reason || null,
      items: {
        create: data.items.map((item) => ({
          storeItemId: item.storeItemId,
          quantity: item.quantity,
        })),
      },
    },
    include: { items: true },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "StoreTransfer",
    entityId: transfer.id,
    module: "inventory",
    description: `Created transfer ${transferNumber} with ${data.items.length} item(s)`,
    newData: transfer,
  });

  return { data: transfer };
}

// ─── Approve Transfer ───────────────────────────────────────────────

export async function approveTransferAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const transfer = await db.storeTransfer.findUnique({ where: { id } });
  if (!transfer) return { error: "Transfer not found." };
  if (transfer.status !== "PENDING") return { error: "Only pending transfers can be approved." };

  const updated = await db.storeTransfer.update({
    where: { id },
    data: {
      status: "IN_TRANSIT",
      approvedBy: session.user.id!,
      approvedAt: new Date(),
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "StoreTransfer",
    entityId: id,
    module: "inventory",
    description: `Approved transfer ${transfer.transferNumber}`,
    previousData: { status: "PENDING" },
    newData: { status: "IN_TRANSIT" },
  });

  return { data: updated };
}

// ─── Receive Transfer ───────────────────────────────────────────────

export async function receiveTransferAction(
  id: string,
  receivedItems: Array<{ storeTransferItemId: string; receivedQty: number }>,
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const transfer = await db.storeTransfer.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!transfer) return { error: "Transfer not found." };
  if (transfer.status !== "IN_TRANSIT" && transfer.status !== "APPROVED") {
    return { error: "Transfer must be approved or in transit to receive." };
  }

  // Process each item
  for (const ri of receivedItems) {
    const transferItem = transfer.items.find((i) => i.id === ri.storeTransferItemId);
    if (!transferItem) continue;

    const sourceItem = await db.storeItem.findUnique({ where: { id: transferItem.storeItemId } });
    if (!sourceItem) continue;

    // Deduct from source store
    const sourcePrev = sourceItem.quantity;
    const sourceNew = Math.max(0, sourcePrev - transferItem.quantity);

    await db.$transaction([
      db.storeItem.update({
        where: { id: sourceItem.id },
        data: { quantity: sourceNew },
      }),
      db.stockMovement.create({
        data: {
          storeItemId: sourceItem.id,
          type: "OUT",
          quantity: transferItem.quantity,
          previousQuantity: sourcePrev,
          newQuantity: sourceNew,
          reason: `Transfer ${transfer.transferNumber} to destination store`,
          referenceType: "transfer",
          referenceId: transfer.id,
          conductedBy: session.user.id!,
        },
      }),
    ]);

    // Find or create matching item in destination store
    let targetItem = await db.storeItem.findFirst({
      where: { storeId: transfer.toStoreId, name: sourceItem.name },
    });

    if (!targetItem) {
      targetItem = await db.storeItem.create({
        data: {
          storeId: transfer.toStoreId,
          categoryId: sourceItem.categoryId,
          name: sourceItem.name,
          code: sourceItem.code,
          unit: sourceItem.unit,
          quantity: 0,
          reorderLevel: sourceItem.reorderLevel,
          unitPrice: sourceItem.unitPrice,
          description: sourceItem.description,
        },
      });
    }

    // Add to destination store
    const targetPrev = targetItem.quantity;
    const targetNew = targetPrev + ri.receivedQty;

    await db.$transaction([
      db.storeItem.update({
        where: { id: targetItem.id },
        data: { quantity: targetNew },
      }),
      db.stockMovement.create({
        data: {
          storeItemId: targetItem.id,
          type: "IN",
          quantity: ri.receivedQty,
          previousQuantity: targetPrev,
          newQuantity: targetNew,
          reason: `Transfer ${transfer.transferNumber} from source store`,
          referenceType: "transfer",
          referenceId: transfer.id,
          conductedBy: session.user.id!,
        },
      }),
    ]);

    // Update transfer item with received qty
    await db.storeTransferItem.update({
      where: { id: transferItem.id },
      data: { receivedQty: ri.receivedQty, targetItemId: targetItem.id },
    });
  }

  // Mark transfer as received
  const updated = await db.storeTransfer.update({
    where: { id },
    data: { status: "RECEIVED", completedAt: new Date() },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "StoreTransfer",
    entityId: id,
    module: "inventory",
    description: `Received transfer ${transfer.transferNumber}`,
    previousData: { status: transfer.status },
    newData: { status: "RECEIVED" },
  });

  return { data: updated };
}

// ─── Cancel Transfer ────────────────────────────────────────────────

export async function cancelTransferAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const transfer = await db.storeTransfer.findUnique({ where: { id } });
  if (!transfer) return { error: "Transfer not found." };
  if (transfer.status === "RECEIVED" || transfer.status === "CANCELLED") {
    return { error: "Cannot cancel a completed or already cancelled transfer." };
  }

  const updated = await db.storeTransfer.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "StoreTransfer",
    entityId: id,
    module: "inventory",
    description: `Cancelled transfer ${transfer.transferNumber}`,
    previousData: { status: transfer.status },
    newData: { status: "CANCELLED" },
  });

  return { data: updated };
}
