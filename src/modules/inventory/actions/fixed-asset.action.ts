"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const categories = await db.assetCategory.findMany({
    where: { schoolId: school.id },
    include: { _count: { select: { assets: true } } },
    orderBy: { name: "asc" },
  });

  const data = categories.map((c) => ({ ...c, assetCount: c._count.assets }));
  return { data };
}

export async function createAssetCategoryAction(data: CreateAssetCategoryInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createAssetCategorySchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const category = await db.assetCategory.create({
    data: { schoolId: school.id, ...parsed.data },
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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: school.id };
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
    accumulatedDepreciation: a.purchasePrice - a.currentValue,
  }));

  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getFixedAssetAction(assetId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createFixedAssetSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const assetNumber = await generateAssetNumber(school.id);

  const asset = await db.fixedAsset.create({
    data: {
      schoolId: school.id,
      assetNumber,
      currentValue: parsed.data.purchasePrice,
      ...parsed.data,
    },
  });

  await audit({ userId: session.user.id!, action: "CREATE", entity: "FixedAsset", entityId: asset.id, module: "inventory", description: `Registered asset "${parsed.data.name}" (${assetNumber})` });

  return { data: asset };
}

export async function updateFixedAssetAction(assetId: string, data: UpdateFixedAssetInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = updateFixedAssetSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const asset = await db.fixedAsset.findUnique({ where: { id: assetId } });
  if (!asset) return { error: "Asset not found" };

  const updated = await db.fixedAsset.update({ where: { id: assetId }, data: parsed.data });

  await audit({ userId: session.user.id!, action: "UPDATE", entity: "FixedAsset", entityId: assetId, module: "inventory", description: `Updated asset "${updated.name}" (${updated.assetNumber})` });

  return { data: updated };
}

export async function disposeAssetAction(data: DisposeAssetInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

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
      disposedBy: session.user.id!,
      currentValue: 0,
    },
  });

  await audit({ userId: session.user.id!, action: "UPDATE", entity: "FixedAsset", entityId: parsed.data.assetId, module: "inventory", description: `Disposed asset "${asset.name}" (${asset.assetNumber}) via ${parsed.data.disposalMethod}` });

  return { data: { success: true } };
}

export async function getAssetSummaryAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const assets = await db.fixedAsset.findMany({
    where: { schoolId: school.id },
    include: { category: { select: { name: true } } },
  });

  const totalPurchaseValue = assets.reduce((sum, a) => sum + a.purchasePrice, 0);
  const totalCurrentValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
  const totalDepreciation = totalPurchaseValue - totalCurrentValue;
  const activeCount = assets.filter((a) => a.status === "ACTIVE").length;

  const byCategory = new Map<string, { category: string; count: number; purchaseValue: number; currentValue: number }>();
  for (const a of assets) {
    const cat = a.category.name;
    const entry = byCategory.get(cat) ?? { category: cat, count: 0, purchaseValue: 0, currentValue: 0 };
    entry.count++;
    entry.purchaseValue += a.purchasePrice;
    entry.currentValue += a.currentValue;
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
