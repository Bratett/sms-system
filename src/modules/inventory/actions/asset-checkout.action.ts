"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Checkout Asset ─────────────────────────────────────────────────

export async function checkoutAssetAction(data: {
  fixedAssetId: string;
  checkedOutTo: string;
  purpose?: string;
  expectedReturn?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_CHECKOUT);
  if (denied) return denied;

  const asset = await db.fixedAsset.findUnique({ where: { id: data.fixedAssetId } });
  if (!asset) return { error: "Asset not found." };

  if (asset.status !== "ACTIVE") {
    return { error: `Asset is currently ${asset.status.toLowerCase()} and cannot be checked out.` };
  }

  // Check if already checked out
  const activeCheckout = await db.assetCheckout.findFirst({
    where: { fixedAssetId: data.fixedAssetId, status: "CHECKED_OUT" },
  });
  if (activeCheckout) {
    return { error: "Asset is already checked out." };
  }

  const checkout = await db.assetCheckout.create({
    data: {
      fixedAssetId: data.fixedAssetId,
      checkedOutTo: data.checkedOutTo,
      checkedOutBy: ctx.session.user.id,
      purpose: data.purpose || null,
      expectedReturn: data.expectedReturn ? new Date(data.expectedReturn) : null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "AssetCheckout",
    entityId: checkout.id,
    module: "inventory",
    description: `Checked out asset "${asset.name}" (${asset.assetNumber}) to ${data.checkedOutTo}`,
    newData: checkout,
  });

  return { data: checkout };
}

// ─── Return Asset ───────────────────────────────────────────────────

export async function returnAssetAction(
  checkoutId: string,
  data: {
    condition?: "NEW" | "GOOD" | "FAIR" | "POOR" | "UNSERVICEABLE";
    returnNotes?: string;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_CHECKOUT);
  if (denied) return denied;

  const checkout = await db.assetCheckout.findUnique({
    where: { id: checkoutId },
    include: { fixedAsset: true },
  });

  if (!checkout) return { error: "Checkout record not found." };
  if (checkout.status !== "CHECKED_OUT") return { error: "Asset is not currently checked out." };

  const updated = await db.assetCheckout.update({
    where: { id: checkoutId },
    data: {
      status: "RETURNED",
      returnDate: new Date(),
      returnedBy: ctx.session.user.id,
      condition: data.condition || null,
      returnNotes: data.returnNotes || null,
    },
  });

  // Update asset condition if specified
  if (data.condition) {
    await db.fixedAsset.update({
      where: { id: checkout.fixedAssetId },
      data: { condition: data.condition },
    });
  }

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "AssetCheckout",
    entityId: checkoutId,
    module: "inventory",
    description: `Returned asset "${checkout.fixedAsset.name}" (${checkout.fixedAsset.assetNumber})${data.condition ? ` — condition: ${data.condition}` : ""}`,
    previousData: { status: "CHECKED_OUT" },
    newData: { status: "RETURNED" },
  });

  return { data: updated };
}

// ─── Checkout History ───────────────────────────────────────────────

export async function getCheckoutHistoryAction(assetId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_CHECKOUT);
  if (denied) return denied;

  const checkouts = await db.assetCheckout.findMany({
    where: { fixedAssetId: assetId },
    orderBy: { checkoutDate: "desc" },
  });

  // Fetch user names
  const userIds = [...new Set(checkouts.flatMap((c) => [c.checkedOutBy, c.returnedBy].filter(Boolean) as string[]))];
  const users = userIds.length > 0
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = checkouts.map((c) => ({
    id: c.id,
    checkedOutTo: c.checkedOutTo,
    checkedOutBy: c.checkedOutBy,
    checkedOutByName: userMap.get(c.checkedOutBy) ?? "Unknown",
    purpose: c.purpose,
    checkoutDate: c.checkoutDate,
    expectedReturn: c.expectedReturn,
    returnDate: c.returnDate,
    returnedBy: c.returnedBy,
    returnedByName: c.returnedBy ? userMap.get(c.returnedBy) ?? "Unknown" : null,
    condition: c.condition,
    returnNotes: c.returnNotes,
    status: c.status,
  }));

  return { data };
}

// ─── Active Checkouts ───────────────────────────────────────────────

export async function getActiveCheckoutsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_CHECKOUT);
  if (denied) return denied;

  const checkouts = await db.assetCheckout.findMany({
    where: {
      status: "CHECKED_OUT",
      fixedAsset: { schoolId: ctx.schoolId },
    },
    include: {
      fixedAsset: {
        select: { assetNumber: true, name: true, category: { select: { name: true } } },
      },
    },
    orderBy: { checkoutDate: "desc" },
  });

  // Fetch user names
  const userIds = [...new Set(checkouts.map((c) => c.checkedOutBy))];
  const users = userIds.length > 0
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const now = new Date();
  const data = checkouts.map((c) => ({
    id: c.id,
    assetNumber: c.fixedAsset.assetNumber,
    assetName: c.fixedAsset.name,
    categoryName: c.fixedAsset.category.name,
    checkedOutTo: c.checkedOutTo,
    checkedOutByName: userMap.get(c.checkedOutBy) ?? "Unknown",
    purpose: c.purpose,
    checkoutDate: c.checkoutDate,
    expectedReturn: c.expectedReturn,
    isOverdue: c.expectedReturn ? c.expectedReturn < now : false,
    daysOut: Math.floor((now.getTime() - c.checkoutDate.getTime()) / (1000 * 60 * 60 * 24)),
  }));

  return { data };
}

// ─── Overdue Checkouts ──────────────────────────────────────────────

export async function getOverdueCheckoutsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_CHECKOUT);
  if (denied) return denied;

  const overdue = await db.assetCheckout.findMany({
    where: {
      status: "CHECKED_OUT",
      expectedReturn: { lt: new Date() },
      fixedAsset: { schoolId: ctx.schoolId },
    },
    include: {
      fixedAsset: {
        select: { assetNumber: true, name: true },
      },
    },
    orderBy: { expectedReturn: "asc" },
  });

  const now = new Date();
  const data = overdue.map((c) => ({
    id: c.id,
    assetNumber: c.fixedAsset.assetNumber,
    assetName: c.fixedAsset.name,
    checkedOutTo: c.checkedOutTo,
    checkoutDate: c.checkoutDate,
    expectedReturn: c.expectedReturn,
    daysOverdue: Math.floor((now.getTime() - c.expectedReturn!.getTime()) / (1000 * 60 * 60 * 24)),
  }));

  return { data };
}
