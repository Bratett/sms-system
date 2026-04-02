"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  recordMaintenanceSchema,
  type RecordMaintenanceInput,
} from "@/modules/inventory/schemas/fixed-asset.schema";

export async function recordMaintenanceAction(data: RecordMaintenanceInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ASSET_MAINTENANCE_CREATE);
  if (denied) return denied;

  const parsed = recordMaintenanceSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const asset = await db.fixedAsset.findUnique({ where: { id: parsed.data.fixedAssetId } });
  if (!asset) return { error: "Asset not found" };

  const maintenance = await db.assetMaintenance.create({
    data: { ...parsed.data, recordedBy: ctx.session.user.id },
  });

  await audit({ userId: ctx.session.user.id, action: "CREATE", entity: "AssetMaintenance", entityId: maintenance.id, module: "inventory", description: `Recorded ${parsed.data.type} for asset "${asset.name}" (${asset.assetNumber})` });

  return { data: maintenance };
}

export async function getMaintenanceHistoryAction(assetId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ASSET_MAINTENANCE_READ);
  if (denied) return denied;

  const records = await db.assetMaintenance.findMany({
    where: { fixedAssetId: assetId },
    orderBy: { date: "desc" },
  });

  const userIds = [...new Set(records.map((r) => r.recordedBy))];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } });
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = records.map((r) => ({ ...r, recordedByName: userMap.get(r.recordedBy) ?? "Unknown" }));
  return { data };
}

export async function getUpcomingMaintenanceAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ASSET_MAINTENANCE_READ);
  if (denied) return denied;

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const records = await db.assetMaintenance.findMany({
    where: {
      fixedAsset: { schoolId: ctx.schoolId, status: "ACTIVE" },
      nextDueDate: { lte: thirtyDaysFromNow, gte: new Date() },
    },
    include: {
      fixedAsset: { select: { id: true, name: true, assetNumber: true, location: true } },
    },
    orderBy: { nextDueDate: "asc" },
  });

  return { data: records };
}
