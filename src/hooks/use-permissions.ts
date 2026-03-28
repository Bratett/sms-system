"use client";

import { useSession } from "next-auth/react";
import type { Permission } from "@/lib/permissions";

export function usePermissions() {
  const { data: session } = useSession();

  const permissions = (session?.user as Record<string, unknown>)?.permissions as
    | string[]
    | undefined;
  const roles = (session?.user as Record<string, unknown>)?.roles as string[] | undefined;

  function hasPermission(permission: Permission): boolean {
    if (!permissions) return false;
    if (roles?.includes("super_admin")) return true;
    return permissions.includes(permission);
  }

  function hasAnyPermission(perms: Permission[]): boolean {
    return perms.some((p) => hasPermission(p));
  }

  function hasAllPermissions(perms: Permission[]): boolean {
    return perms.every((p) => hasPermission(p));
  }

  function hasRole(role: string): boolean {
    return roles?.includes(role) ?? false;
  }

  return { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, permissions, roles };
}
