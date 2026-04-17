"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── List Asset Audits ──────────────────────────────────────────────

export async function getAssetAuditsAction(filters?: { status?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_AUDIT_CREATE);
  if (denied) return denied;

  const audits = await db.assetAudit.findMany({
    where: {
      schoolId: ctx.schoolId,
      ...(filters?.status && { status: filters.status as any }),
    },
    include: { items: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Fetch user names
  const userIds = [...new Set(audits.flatMap((a) => [a.conductedBy].filter(Boolean) as string[]))];
  const users = userIds.length > 0
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = audits.map((a) => ({
    id: a.id,
    reference: a.reference,
    status: a.status,
    scheduledDate: a.scheduledDate,
    completedAt: a.completedAt,
    conductedBy: a.conductedBy,
    conductedByName: a.conductedBy ? userMap.get(a.conductedBy) ?? "Unknown" : null,
    assetCount: a.items.length,
    notes: a.notes,
    createdAt: a.createdAt,
  }));

  return { data };
}

// ─── Create Asset Audit ─────────────────────────────────────────────

export async function createAssetAuditAction(data: {
  scheduledDate?: string;
  notes?: string;
  categoryId?: string;
  locationFilter?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_AUDIT_CREATE);
  if (denied) return denied;

  // Generate reference number
  const year = new Date().getFullYear();
  const last = await db.assetAudit.findFirst({
    where: { reference: { startsWith: `AA/${year}/` } },
    orderBy: { reference: "desc" },
  });
  let nextSeq = 1;
  if (last) {
    const parts = last.reference.split("/");
    nextSeq = parseInt(parts[2], 10) + 1;
  }
  const reference = `AA/${year}/${String(nextSeq).padStart(4, "0")}`;

  // Get active assets to audit
  const assets = await db.fixedAsset.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: { in: ["ACTIVE", "UNDER_MAINTENANCE"] },
      ...(data.categoryId && { categoryId: data.categoryId }),
      ...(data.locationFilter && { location: { contains: data.locationFilter } }),
    },
    select: { id: true },
  });

  if (assets.length === 0) return { error: "No assets found matching the criteria." };

  const assetAudit = await db.assetAudit.create({
    data: {
      schoolId: ctx.schoolId,
      reference,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
      notes: data.notes || null,
      items: {
        create: assets.map((asset) => ({
          fixedAssetId: asset.id,
        })),
      },
    },
    include: { items: true },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "AssetAudit",
    entityId: assetAudit.id,
    module: "inventory",
    description: `Created asset audit ${reference} with ${assets.length} asset(s)`,
    newData: assetAudit,
  });

  return { data: assetAudit };
}

// ─── Get Audit Detail ───────────────────────────────────────────────

export async function getAssetAuditAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_AUDIT_CREATE);
  if (denied) return denied;

  const assetAudit = await db.assetAudit.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          fixedAsset: {
            select: {
              assetNumber: true,
              name: true,
              location: true,
              condition: true,
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!assetAudit) return { error: "Asset audit not found." };

  return {
    data: {
      id: assetAudit.id,
      reference: assetAudit.reference,
      status: assetAudit.status,
      scheduledDate: assetAudit.scheduledDate,
      completedAt: assetAudit.completedAt,
      conductedBy: assetAudit.conductedBy,
      notes: assetAudit.notes,
      items: assetAudit.items.map((item) => ({
        id: item.id,
        fixedAssetId: item.fixedAssetId,
        assetNumber: item.fixedAsset.assetNumber,
        assetName: item.fixedAsset.name,
        categoryName: item.fixedAsset.category.name,
        expectedLocation: item.fixedAsset.location,
        expectedCondition: item.fixedAsset.condition,
        found: item.found,
        condition: item.condition,
        locationVerified: item.locationVerified,
        notes: item.notes,
      })),
    },
  };
}

// ─── Record Audit Findings ──────────────────────────────────────────

export async function recordAuditFindingsAction(
  id: string,
  findings: Array<{
    auditItemId: string;
    found: boolean;
    condition?: "NEW" | "GOOD" | "FAIR" | "POOR" | "UNSERVICEABLE";
    locationVerified?: boolean;
    notes?: string;
  }>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_AUDIT_CREATE);
  if (denied) return denied;

  const assetAudit = await db.assetAudit.findUnique({ where: { id } });
  if (!assetAudit) return { error: "Asset audit not found." };
  if (assetAudit.status === "COMPLETED" || assetAudit.status === "APPROVED") {
    return { error: "Cannot modify a completed or approved audit." };
  }

  // Start audit if still planned
  if (assetAudit.status === "PLANNED") {
    await db.assetAudit.update({
      where: { id },
      data: { status: "IN_PROGRESS", conductedBy: ctx.session.user.id },
    });
  }

  for (const finding of findings) {
    await db.assetAuditItem.update({
      where: { id: finding.auditItemId },
      data: {
        found: finding.found,
        condition: finding.condition || null,
        locationVerified: finding.locationVerified ?? null,
        notes: finding.notes || null,
      },
    });
  }

  return { data: { updated: findings.length } };
}

// ─── Complete Asset Audit ───────────────────────────────────────────

export async function completeAssetAuditAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_AUDIT_APPROVE);
  if (denied) return denied;

  const assetAudit = await db.assetAudit.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!assetAudit) return { error: "Asset audit not found." };
  if (assetAudit.status !== "IN_PROGRESS") return { error: "Only in-progress audits can be completed." };

  // Check all items have been verified
  const unverified = assetAudit.items.filter((i) => i.found === null);
  if (unverified.length > 0) {
    return { error: `${unverified.length} asset(s) have not been verified yet.` };
  }

  // Update asset conditions based on findings
  for (const item of assetAudit.items) {
    if (item.condition) {
      await db.fixedAsset.update({
        where: { id: item.fixedAssetId },
        data: { condition: item.condition },
      });
    }
  }

  const updated = await db.assetAudit.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  // Compute summary
  const found = assetAudit.items.filter((i) => i.found === true).length;
  const notFound = assetAudit.items.filter((i) => i.found === false).length;
  const locationMismatch = assetAudit.items.filter((i) => i.locationVerified === false).length;

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "AssetAudit",
    entityId: id,
    module: "inventory",
    description: `Completed asset audit ${assetAudit.reference} — Found: ${found}, Not found: ${notFound}, Location mismatch: ${locationMismatch}`,
    previousData: { status: "IN_PROGRESS" },
    newData: { status: "COMPLETED" },
  });

  return {
    data: {
      ...updated,
      summary: { total: assetAudit.items.length, found, notFound, locationMismatch },
    },
  };
}
