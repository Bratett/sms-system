"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

export async function getSystemSettingsAction(module?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SCHOOL_SETTINGS_READ);
  if (denied) return denied;

  const where = module ? { module } : {};
  const settings = await db.systemSetting.findMany({
    where,
    orderBy: [{ module: "asc" }, { key: "asc" }],
  });

  return { settings };
}

export async function updateSystemSettingAction(key: string, value: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SCHOOL_SETTINGS_UPDATE);
  if (denied) return denied;

  const existing = await db.systemSetting.findUnique({ where: { key } });

  const setting = await db.systemSetting.upsert({
    where: { key },
    update: { value },
    create: {
      key,
      value,
      type: "string",
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: existing ? "UPDATE" : "CREATE",
    entity: "SystemSetting",
    entityId: setting.id,
    module: "school",
    description: `${existing ? "Updated" : "Created"} system setting: ${key}`,
    previousData: existing ? { value: existing.value } : undefined,
    newData: { value },
  });

  return { success: true, setting };
}

export async function deleteSystemSettingAction(key: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SCHOOL_SETTINGS_UPDATE);
  if (denied) return denied;

  const existing = await db.systemSetting.findUnique({ where: { key } });
  if (!existing) return { error: "Setting not found" };

  await db.systemSetting.delete({ where: { key } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "SystemSetting",
    entityId: existing.id,
    module: "school",
    description: `Deleted system setting: ${key}`,
    previousData: { key, value: existing.value },
  });

  return { success: true };
}
