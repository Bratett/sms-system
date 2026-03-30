"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  getAllModules,
  getModule,
  getEnabledModules,
  getNavigationForModules,
  checkDependencies,
} from "@/lib/plugins/registry";
import type { SchoolModuleConfig } from "@/lib/plugins/types";

/**
 * Get all available modules with their enabled/disabled state for the current school.
 */
export async function getModulesAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const allModules = getAllModules();

  // Get school's module config from system settings
  const setting = await db.systemSetting.findUnique({
    where: { key: `school:${school.id}:modules` },
  });

  const schoolConfig: SchoolModuleConfig[] = setting
    ? (JSON.parse(setting.value) as SchoolModuleConfig[])
    : [];

  const configMap = new Map(schoolConfig.map((c) => [c.moduleId, c]));

  const modules = allModules.map((mod) => ({
    ...mod,
    enabled: mod.isCore || (configMap.get(mod.id)?.enabled ?? true), // Default enabled
    config: configMap.get(mod.id)?.config ?? {},
  }));

  return { data: modules };
}

/**
 * Enable or disable a module for the current school.
 */
export async function toggleModuleAction(moduleId: string, enabled: boolean) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const mod = getModule(moduleId);
  if (!mod) return { error: "Module not found" };
  if (mod.isCore) return { error: "Core modules cannot be disabled" };

  // Check dependencies when enabling
  if (enabled && mod.dependencies) {
    const setting = await db.systemSetting.findUnique({
      where: { key: `school:${school.id}:modules` },
    });
    const currentConfig: SchoolModuleConfig[] = setting
      ? (JSON.parse(setting.value) as SchoolModuleConfig[])
      : [];
    const enabledIds = new Set(
      currentConfig.filter((c) => c.enabled).map((c) => c.moduleId),
    );
    enabledIds.add(moduleId);

    const deps = checkDependencies(moduleId, enabledIds);
    if (!deps.satisfied) {
      return { error: `Missing required modules: ${deps.missing.join(", ")}` };
    }
  }

  // Get current config
  const settingKey = `school:${school.id}:modules`;
  const existing = await db.systemSetting.findUnique({ where: { key: settingKey } });
  const config: SchoolModuleConfig[] = existing
    ? (JSON.parse(existing.value) as SchoolModuleConfig[])
    : [];

  // Update or add module config
  const idx = config.findIndex((c) => c.moduleId === moduleId);
  if (idx >= 0) {
    config[idx].enabled = enabled;
  } else {
    config.push({ moduleId, enabled });
  }

  await db.systemSetting.upsert({
    where: { key: settingKey },
    create: {
      key: settingKey,
      value: JSON.stringify(config),
      type: "json",
      module: "admin",
      description: "School module configuration",
    },
    update: { value: JSON.stringify(config) },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "ModuleConfig",
    module: "admin",
    description: `${enabled ? "Enabled" : "Disabled"} module "${mod.name}"`,
    metadata: { moduleId, enabled },
  });

  return { success: true };
}

/**
 * Get navigation items for the current school's enabled modules.
 */
export async function getSchoolNavigationAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const setting = await db.systemSetting.findUnique({
    where: { key: `school:${school.id}:modules` },
  });

  const schoolConfig: SchoolModuleConfig[] = setting
    ? (JSON.parse(setting.value) as SchoolModuleConfig[])
    : [];

  const enabledModules = getEnabledModules(schoolConfig);
  const navigation = getNavigationForModules(enabledModules);

  return { data: navigation };
}
