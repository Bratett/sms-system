"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── List Requisitions ──────────────────────────────────────────────

export async function getRequisitionsAction(filters?: {
  status?: string;
  department?: string;
  storeId?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const requisitions = await db.requisition.findMany({
    where: {
      schoolId: school.id,
      ...(filters?.status && { status: filters.status as any }),
      ...(filters?.department && { department: filters.department }),
      ...(filters?.storeId && { storeId: filters.storeId }),
    },
    include: { items: true },
    orderBy: { requestedAt: "desc" },
  });

  // Fetch store names
  const storeIds = [...new Set(requisitions.map((r) => r.storeId))];
  const stores = storeIds.length > 0
    ? await db.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true } })
    : [];
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));

  // Fetch user names
  const userIds = [...new Set(requisitions.flatMap((r) => [r.requestedBy, r.approvedBy, r.issuedBy].filter(Boolean) as string[]))];
  const users = userIds.length > 0
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = requisitions.map((r) => ({
    id: r.id,
    requisitionNumber: r.requisitionNumber,
    storeId: r.storeId,
    storeName: storeMap.get(r.storeId) ?? "Unknown",
    department: r.department,
    requestedBy: r.requestedBy,
    requestedByName: userMap.get(r.requestedBy) ?? "Unknown",
    approvedBy: r.approvedBy,
    approvedByName: r.approvedBy ? userMap.get(r.approvedBy) ?? "Unknown" : null,
    issuedBy: r.issuedBy,
    issuedByName: r.issuedBy ? userMap.get(r.issuedBy) ?? "Unknown" : null,
    status: r.status,
    purpose: r.purpose,
    itemCount: r.items.length,
    requestedAt: r.requestedAt,
    approvedAt: r.approvedAt,
    issuedAt: r.issuedAt,
  }));

  return { data };
}

// ─── Get Requisition Detail ─────────────────────────────────────────

export async function getRequisitionAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const requisition = await db.requisition.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!requisition) return { error: "Requisition not found." };

  // Fetch item details
  const itemIds = requisition.items.map((i) => i.storeItemId);
  const storeItems = itemIds.length > 0
    ? await db.storeItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, name: true, unit: true, quantity: true },
      })
    : [];
  const itemMap = new Map(storeItems.map((i) => [i.id, i]));

  // Fetch store name
  const store = await db.store.findUnique({ where: { id: requisition.storeId }, select: { name: true } });

  return {
    data: {
      ...requisition,
      storeName: store?.name ?? "Unknown",
      items: requisition.items.map((i) => {
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

// ─── Create Requisition ─────────────────────────────────────────────

export async function createRequisitionAction(data: {
  storeId: string;
  department: string;
  purpose?: string;
  items: Array<{ storeItemId: string; quantityRequested: number }>;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  if (!data.items || data.items.length === 0) {
    return { error: "At least one item is required." };
  }

  if (!data.department.trim()) {
    return { error: "Department is required." };
  }

  // Generate requisition number
  const year = new Date().getFullYear();
  const last = await db.requisition.findFirst({
    where: { requisitionNumber: { startsWith: `REQ/${year}/` } },
    orderBy: { requisitionNumber: "desc" },
  });
  let nextSeq = 1;
  if (last) {
    const parts = last.requisitionNumber.split("/");
    nextSeq = parseInt(parts[2], 10) + 1;
  }
  const requisitionNumber = `REQ/${year}/${String(nextSeq).padStart(4, "0")}`;

  const requisition = await db.requisition.create({
    data: {
      schoolId: school.id,
      requisitionNumber,
      storeId: data.storeId,
      department: data.department,
      requestedBy: session.user.id!,
      purpose: data.purpose || null,
      items: {
        create: data.items.map((item) => ({
          storeItemId: item.storeItemId,
          quantityRequested: item.quantityRequested,
        })),
      },
    },
    include: { items: true },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Requisition",
    entityId: requisition.id,
    module: "inventory",
    description: `Created requisition ${requisitionNumber} for ${data.department}`,
    newData: requisition,
  });

  return { data: requisition };
}

// ─── Approve Requisition ────────────────────────────────────────────

export async function approveRequisitionAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const requisition = await db.requisition.findUnique({ where: { id } });
  if (!requisition) return { error: "Requisition not found." };
  if (requisition.status !== "PENDING") return { error: "Only pending requisitions can be approved." };

  const updated = await db.requisition.update({
    where: { id },
    data: { status: "APPROVED", approvedBy: session.user.id!, approvedAt: new Date() },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Requisition",
    entityId: id,
    module: "inventory",
    description: `Approved requisition ${requisition.requisitionNumber}`,
    previousData: { status: "PENDING" },
    newData: { status: "APPROVED" },
  });

  return { data: updated };
}

// ─── Reject Requisition ─────────────────────────────────────────────

export async function rejectRequisitionAction(id: string, reason?: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const requisition = await db.requisition.findUnique({ where: { id } });
  if (!requisition) return { error: "Requisition not found." };
  if (requisition.status !== "PENDING") return { error: "Only pending requisitions can be rejected." };

  const updated = await db.requisition.update({
    where: { id },
    data: { status: "REJECTED", approvedBy: session.user.id!, approvedAt: new Date() },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Requisition",
    entityId: id,
    module: "inventory",
    description: `Rejected requisition ${requisition.requisitionNumber}${reason ? `: ${reason}` : ""}`,
    previousData: { status: "PENDING" },
    newData: { status: "REJECTED" },
  });

  return { data: updated };
}

// ─── Issue Requisition ──────────────────────────────────────────────

export async function issueRequisitionAction(
  id: string,
  issuedItems: Array<{ requisitionItemId: string; quantityIssued: number }>,
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const requisition = await db.requisition.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!requisition) return { error: "Requisition not found." };
  if (requisition.status !== "APPROVED" && requisition.status !== "PARTIALLY_ISSUED") {
    return { error: "Requisition must be approved before issuing items." };
  }

  let allFullyIssued = true;

  for (const issued of issuedItems) {
    const reqItem = requisition.items.find((i) => i.id === issued.requisitionItemId);
    if (!reqItem) continue;
    if (issued.quantityIssued <= 0) continue;

    const storeItem = await db.storeItem.findUnique({ where: { id: reqItem.storeItemId } });
    if (!storeItem) continue;

    if (storeItem.quantity < issued.quantityIssued) {
      return { error: `Insufficient stock for "${storeItem.name}". Available: ${storeItem.quantity}` };
    }

    const previousQuantity = storeItem.quantity;
    const newQuantity = previousQuantity - issued.quantityIssued;

    await db.$transaction([
      db.storeItem.update({
        where: { id: storeItem.id },
        data: { quantity: newQuantity },
      }),
      db.stockMovement.create({
        data: {
          storeItemId: storeItem.id,
          type: "OUT",
          quantity: issued.quantityIssued,
          previousQuantity,
          newQuantity,
          reason: `Requisition ${requisition.requisitionNumber}`,
          referenceType: "requisition",
          referenceId: requisition.id,
          issuedTo: requisition.department,
          conductedBy: session.user.id!,
        },
      }),
      db.requisitionItem.update({
        where: { id: reqItem.id },
        data: { quantityIssued: (reqItem.quantityIssued ?? 0) + issued.quantityIssued },
      }),
    ]);

    const totalIssued = (reqItem.quantityIssued ?? 0) + issued.quantityIssued;
    if (totalIssued < reqItem.quantityRequested) {
      allFullyIssued = false;
    }
  }

  // Check if any items still not fully issued
  if (allFullyIssued) {
    // Re-check all items
    const updatedItems = await db.requisitionItem.findMany({ where: { requisitionId: id } });
    allFullyIssued = updatedItems.every((i) => (i.quantityIssued ?? 0) >= i.quantityRequested);
  }

  const newStatus = allFullyIssued ? "ISSUED" : "PARTIALLY_ISSUED";
  const updated = await db.requisition.update({
    where: { id },
    data: {
      status: newStatus as any,
      issuedBy: session.user.id!,
      ...(allFullyIssued && { issuedAt: new Date() }),
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Requisition",
    entityId: id,
    module: "inventory",
    description: `Issued items for requisition ${requisition.requisitionNumber} (${newStatus})`,
    previousData: { status: requisition.status },
    newData: { status: newStatus },
  });

  return { data: updated };
}
