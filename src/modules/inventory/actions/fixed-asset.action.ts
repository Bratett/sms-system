"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import {
  createAssetCategorySchema,
  createFixedAssetSchema,
  updateFixedAssetSchema,
  disposeAssetSchema,
  type CreateAssetCategoryInput,
  type CreateFixedAssetInput,
  type UpdateFixedAssetInput,
  type DisposeAssetInput,
} from "@/modules/inventory/schemas/fixed-asset.schema";

async function generateAssetNumber(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AST/${year}/`;
  const lastAsset = await db.fixedAsset.findFirst({
    where: { schoolId, assetNumber: { startsWith: prefix } },
    orderBy: { assetNumber: "desc" },
  });
  const nextNum = lastAsset ? parseInt(lastAsset.assetNumber.split("/").pop()!) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

export async function getAssetCategoriesAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FIXED_ASSETS_READ);
  if (denied) return denied;

  const categories = await db.assetCategory.findMany({
    where: { schoolId: ctx.schoolId },
    include: { _count: { select: { assets: true } } },
    orderBy: { name: "asc" },
  });

  const data = categories.map((c) => ({ ...c, assetCount: c._count.assets }));
  return { data };
}

export async function createAssetCategoryAction(data: CreateAssetCategoryInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FIXED_ASSETS_CREATE);
  if (denied) return denied;

  const parsed = createAssetCategorySchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const category = await db.assetCategory.create({
    data: { schoolId: ctx.schoolId, ...parsed.data },
  });

  return { data: category };
}

export async function getFixedAssetsAction(filters?: {
  categoryId?: string;
  status?: string;
  condition?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FIXED_ASSETS_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.categoryId) where.categoryId = filters.categoryId;
  if (filters?.status) where.status = filters.status;
  if (filters?.condition) where.condition = filters.condition;

  const [assets, total] = await Promise.all([
    db.fixedAsset.findMany({
      where,
      include: {
        category: { select: { name: true, code: true } },
        _count: { select: { depreciationRecords: true, maintenanceRecords: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.fixedAsset.count({ where }),
  ]);

  const data = assets.map((a) => ({
    ...a,
    categoryName: a.category.name,
    categoryCode: a.category.code,
    depreciationCount: a._count.depreciationRecords,
    maintenanceCount: a._count.maintenanceRecords,
    accumulatedDepreciation: toNum(a.purchasePrice) - toNum(a.currentValue),
  }));

  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getFixedAssetAction(assetId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FIXED_ASSETS_READ);
  if (denied) return denied;

  const asset = await db.fixedAsset.findUnique({
    where: { id: assetId },
    include: {
      category: true,
      depreciationRecords: { orderBy: { period: "desc" } },
      maintenanceRecords: { orderBy: { date: "desc" } },
    },
  });

  if (!asset) return { error: "Asset not found" };

  // Resolve user names for maintenance records
  const userIds = [...new Set(asset.maintenanceRecords.map((m) => m.recordedBy))];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } });
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  return {
    data: {
      ...asset,
      maintenanceRecords: asset.maintenanceRecords.map((m) => ({
        ...m,
        recordedByName: userMap.get(m.recordedBy) ?? "Unknown",
      })),
    },
  };
}

export async function createFixedAssetAction(data: CreateFixedAssetInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FIXED_ASSETS_CREATE);
  if (denied) return denied;

  const parsed = createFixedAssetSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const assetNumber = await generateAssetNumber(ctx.schoolId);

  const asset = await db.fixedAsset.create({
    data: {
      schoolId: ctx.schoolId,
      assetNumber,
      currentValue: parsed.data.purchasePrice,
      ...parsed.data,
    },
  });

  await audit({ userId: ctx.session.user.id, action: "CREATE", entity: "FixedAsset", entityId: asset.id, module: "inventory", description: `Registered asset "${parsed.data.name}" (${assetNumber})` });

  return { data: asset };
}

export async function updateFixedAssetAction(assetId: string, data: UpdateFixedAssetInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FIXED_ASSETS_UPDATE);
  if (denied) return denied;

  const parsed = updateFixedAssetSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const asset = await db.fixedAsset.findUnique({ where: { id: assetId } });
  if (!asset) return { error: "Asset not found" };

  const updated = await db.fixedAsset.update({ where: { id: assetId }, data: parsed.data });

  await audit({ userId: ctx.session.user.id, action: "UPDATE", entity: "FixedAsset", entityId: assetId, module: "inventory", description: `Updated asset "${updated.name}" (${updated.assetNumber})` });

  return { data: updated };
}

export async function disposeAssetAction(data: DisposeAssetInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FIXED_ASSETS_DISPOSE);
  if (denied) return denied;

  const parsed = disposeAssetSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const asset = await db.fixedAsset.findUnique({ where: { id: parsed.data.assetId } });
  if (!asset) return { error: "Asset not found" };
  if (asset.status === "DISPOSED" || asset.status === "WRITTEN_OFF") {
    return { error: "Asset is already disposed" };
  }

  await db.fixedAsset.update({
    where: { id: parsed.data.assetId },
    data: {
      status: parsed.data.disposalMethod === "WRITTEN_OFF" ? "WRITTEN_OFF" : "DISPOSED",
      disposedAt: new Date(),
      disposalMethod: parsed.data.disposalMethod,
      disposalAmount: parsed.data.disposalAmount,
      disposedBy: ctx.session.user.id,
      currentValue: 0,
    },
  });

  await audit({ userId: ctx.session.user.id, action: "UPDATE", entity: "FixedAsset", entityId: parsed.data.assetId, module: "inventory", description: `Disposed asset "${asset.name}" (${asset.assetNumber}) via ${parsed.data.disposalMethod}` });

  return { data: { success: true } };
}

export async function getAssetSummaryAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FIXED_ASSETS_READ);
  if (denied) return denied;

  const assets = await db.fixedAsset.findMany({
    where: { schoolId: ctx.schoolId },
    include: { category: { select: { name: true } } },
  });

  const totalPurchaseValue = assets.reduce((sum, a) => sum + toNum(a.purchasePrice), 0);
  const totalCurrentValue = assets.reduce((sum, a) => sum + toNum(a.currentValue), 0);
  const totalDepreciation = totalPurchaseValue - totalCurrentValue;
  const activeCount = assets.filter((a) => a.status === "ACTIVE").length;

  const byCategory = new Map<string, { category: string; count: number; purchaseValue: number; currentValue: number }>();
  for (const a of assets) {
    const cat = a.category.name;
    const entry = byCategory.get(cat) ?? { category: cat, count: 0, purchaseValue: 0, currentValue: 0 };
    entry.count++;
    entry.purchaseValue += toNum(a.purchasePrice);
    entry.currentValue += toNum(a.currentValue);
    byCategory.set(cat, entry);
  }

  return {
    data: {
      totalAssets: assets.length,
      activeCount,
      totalPurchaseValue,
      totalCurrentValue,
      totalDepreciation,
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.currentValue - a.currentValue),
    },
  };
}
