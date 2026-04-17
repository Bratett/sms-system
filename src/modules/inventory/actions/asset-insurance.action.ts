"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";

// ─── Add Insurance ──────────────────────────────────────────────────

export async function addInsuranceAction(data: {
  fixedAssetId: string;
  provider: string;
  policyNumber?: string;
  coverageAmount?: number;
  premium?: number;
  startDate: string;
  endDate: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_INSURANCE_MANAGE);
  if (denied) return denied;

  const asset = await db.fixedAsset.findUnique({ where: { id: data.fixedAssetId } });
  if (!asset) return { error: "Asset not found." };

  const insurance = await db.assetInsurance.create({
    data: {
      fixedAssetId: data.fixedAssetId,
      provider: data.provider,
      policyNumber: data.policyNumber || null,
      coverageAmount: data.coverageAmount ?? null,
      premium: data.premium ?? null,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "AssetInsurance",
    entityId: insurance.id,
    module: "inventory",
    description: `Added insurance for asset "${asset.name}" (${asset.assetNumber}) — provider: ${data.provider}`,
    newData: insurance,
  });

  return { data: insurance };
}

// ─── Get Asset Insurance ────────────────────────────────────────────

export async function getAssetInsuranceAction(fixedAssetId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_INSURANCE_MANAGE);
  if (denied) return denied;

  const policies = await db.assetInsurance.findMany({
    where: { fixedAssetId },
    orderBy: { endDate: "desc" },
  });

  const now = new Date();
  const data = policies.map((p) => ({
    id: p.id,
    provider: p.provider,
    policyNumber: p.policyNumber,
    coverageAmount: p.coverageAmount ? toNum(p.coverageAmount) : null,
    premium: p.premium ? toNum(p.premium) : null,
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
    isExpired: p.endDate < now,
    daysUntilExpiry: Math.ceil((p.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  }));

  return { data };
}

// ─── Expiring Insurance ─────────────────────────────────────────────

export async function getExpiringInsuranceAction(withinDays: number = 90) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_INSURANCE_MANAGE);
  if (denied) return denied;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + withinDays);

  const policies = await db.assetInsurance.findMany({
    where: {
      status: "ACTIVE",
      endDate: { lte: cutoffDate },
      fixedAsset: { schoolId: ctx.schoolId },
    },
    include: {
      fixedAsset: { select: { assetNumber: true, name: true } },
    },
    orderBy: { endDate: "asc" },
  });

  const now = new Date();
  const data = policies.map((p) => {
    const daysUntilExpiry = Math.ceil((p.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: p.id,
      assetNumber: p.fixedAsset.assetNumber,
      assetName: p.fixedAsset.name,
      provider: p.provider,
      policyNumber: p.policyNumber,
      endDate: p.endDate,
      daysUntilExpiry,
      isExpired: daysUntilExpiry < 0,
      urgency: daysUntilExpiry < 0 ? "expired" : daysUntilExpiry <= 30 ? "critical" : daysUntilExpiry <= 60 ? "warning" : "info",
    };
  });

  return { data };
}

// ─── Add Warranty ───────────────────────────────────────────────────

export async function addWarrantyAction(data: {
  fixedAssetId: string;
  provider: string;
  warrantyType?: string;
  startDate: string;
  endDate: string;
  terms?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_INSURANCE_MANAGE);
  if (denied) return denied;

  const asset = await db.fixedAsset.findUnique({ where: { id: data.fixedAssetId } });
  if (!asset) return { error: "Asset not found." };

  const warranty = await db.assetWarranty.create({
    data: {
      fixedAssetId: data.fixedAssetId,
      provider: data.provider,
      warrantyType: data.warrantyType || null,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      terms: data.terms || null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "AssetWarranty",
    entityId: warranty.id,
    module: "inventory",
    description: `Added warranty for asset "${asset.name}" (${asset.assetNumber}) — provider: ${data.provider}`,
    newData: warranty,
  });

  return { data: warranty };
}

// ─── Get Asset Warranties ───────────────────────────────────────────

export async function getAssetWarrantiesAction(fixedAssetId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_INSURANCE_MANAGE);
  if (denied) return denied;

  const warranties = await db.assetWarranty.findMany({
    where: { fixedAssetId },
    orderBy: { endDate: "desc" },
  });

  const now = new Date();
  const data = warranties.map((w) => ({
    id: w.id,
    provider: w.provider,
    warrantyType: w.warrantyType,
    startDate: w.startDate,
    endDate: w.endDate,
    terms: w.terms,
    isExpired: w.endDate < now,
    daysUntilExpiry: Math.ceil((w.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  }));

  return { data };
}

// ─── Expiring Warranties ────────────────────────────────────────────

export async function getExpiringWarrantiesAction(withinDays: number = 90) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.INVENTORY_ASSET_INSURANCE_MANAGE);
  if (denied) return denied;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + withinDays);

  const warranties = await db.assetWarranty.findMany({
    where: {
      endDate: { lte: cutoffDate, gt: new Date() },
      fixedAsset: { schoolId: ctx.schoolId, status: { in: ["ACTIVE", "UNDER_MAINTENANCE"] } },
    },
    include: {
      fixedAsset: { select: { assetNumber: true, name: true } },
    },
    orderBy: { endDate: "asc" },
  });

  const now = new Date();
  const data = warranties.map((w) => {
    const daysUntilExpiry = Math.ceil((w.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: w.id,
      assetNumber: w.fixedAsset.assetNumber,
      assetName: w.fixedAsset.name,
      provider: w.provider,
      warrantyType: w.warrantyType,
      endDate: w.endDate,
      daysUntilExpiry,
      urgency: daysUntilExpiry <= 30 ? "critical" : daysUntilExpiry <= 60 ? "warning" : "info",
    };
  });

  return { data };
}
