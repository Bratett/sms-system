"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function runDepreciationAction(period: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const assets = await db.fixedAsset.findMany({
    where: {
      schoolId: school.id,
      status: "ACTIVE",
      depreciationMethod: { not: "NONE" },
      usefulLifeYears: { not: null },
    },
  });

  let processed = 0;
  let skipped = 0;

  for (const asset of assets) {
    // Check if already depreciated for this period
    const existing = await db.assetDepreciation.findUnique({
      where: { fixedAssetId_period: { fixedAssetId: asset.id, period } },
    });
    if (existing) { skipped++; continue; }

    if (asset.currentValue <= asset.salvageValue) { skipped++; continue; }

    let depreciationAmount = 0;
    const usefulLife = asset.usefulLifeYears!;

    switch (asset.depreciationMethod) {
      case "STRAIGHT_LINE": {
        // Annual depreciation = (Purchase Price - Salvage Value) / Useful Life
        const annualDep = (asset.purchasePrice - asset.salvageValue) / usefulLife;
        depreciationAmount = annualDep;
        break;
      }
      case "REDUCING_BALANCE": {
        // Rate = 1 - (Salvage / Purchase)^(1/Life)
        const rate = 1 - Math.pow(asset.salvageValue / Math.max(asset.purchasePrice, 1), 1 / usefulLife);
        depreciationAmount = asset.currentValue * rate;
        break;
      }
    }

    // Don't depreciate below salvage value
    const maxDepreciation = asset.currentValue - asset.salvageValue;
    depreciationAmount = Math.min(depreciationAmount, maxDepreciation);
    depreciationAmount = Math.round(depreciationAmount * 100) / 100;

    if (depreciationAmount <= 0) { skipped++; continue; }

    const closingValue = asset.currentValue - depreciationAmount;

    await db.$transaction(async (tx) => {
      await tx.assetDepreciation.create({
        data: {
          fixedAssetId: asset.id,
          period,
          openingValue: asset.currentValue,
          depreciationAmount,
          closingValue,
        },
      });

      await tx.fixedAsset.update({
        where: { id: asset.id },
        data: { currentValue: closingValue },
      });
    });

    processed++;
  }

  await audit({ userId: session.user.id!, action: "CREATE", entity: "AssetDepreciation", entityId: period, module: "inventory", description: `Ran depreciation for period ${period}: ${processed} assets processed, ${skipped} skipped` });

  return { data: { processed, skipped, total: assets.length } };
}

export async function getDepreciationScheduleAction(assetId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const asset = await db.fixedAsset.findUnique({
    where: { id: assetId },
    include: { depreciationRecords: { orderBy: { period: "asc" } } },
  });

  if (!asset) return { error: "Asset not found" };

  return {
    data: {
      asset: { id: asset.id, name: asset.name, assetNumber: asset.assetNumber, purchasePrice: asset.purchasePrice, currentValue: asset.currentValue, salvageValue: asset.salvageValue, depreciationMethod: asset.depreciationMethod, usefulLifeYears: asset.usefulLifeYears },
      records: asset.depreciationRecords,
      totalDepreciation: asset.purchasePrice - asset.currentValue,
    },
  };
}

export async function getDepreciationSummaryAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const assets = await db.fixedAsset.findMany({
    where: { schoolId: school.id, status: "ACTIVE", depreciationMethod: { not: "NONE" } },
    include: {
      category: { select: { name: true } },
      depreciationRecords: { orderBy: { period: "desc" }, take: 1 },
    },
  });

  const data = assets.map((a) => ({
    id: a.id,
    assetNumber: a.assetNumber,
    name: a.name,
    categoryName: a.category.name,
    purchasePrice: a.purchasePrice,
    currentValue: a.currentValue,
    salvageValue: a.salvageValue,
    accumulatedDepreciation: a.purchasePrice - a.currentValue,
    depreciationMethod: a.depreciationMethod,
    usefulLifeYears: a.usefulLifeYears,
    lastDepreciationPeriod: a.depreciationRecords[0]?.period ?? null,
    percentDepreciated: a.purchasePrice > 0 ? ((a.purchasePrice - a.currentValue) / a.purchasePrice) * 100 : 0,
  }));

  const totalPurchaseValue = data.reduce((sum, a) => sum + a.purchasePrice, 0);
  const totalCurrentValue = data.reduce((sum, a) => sum + a.currentValue, 0);
  const totalAccumulated = data.reduce((sum, a) => sum + a.accumulatedDepreciation, 0);

  return {
    data: {
      assets: data,
      summary: { totalPurchaseValue, totalCurrentValue, totalAccumulated, assetCount: data.length },
    },
  };
}
