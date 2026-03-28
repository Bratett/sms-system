"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  createRoleSchema,
  updateRoleSchema,
  type CreateRoleInput,
  type UpdateRoleInput,
} from "@/modules/auth/schemas/role.schema";

export async function getRolesAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const roles = await db.role.findMany({
    include: {
      _count: {
        select: {
          rolePermissions: true,
          userRoles: true,
        },
      },
      rolePermissions: {
        include: {
          permission: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const mapped = roles.map((role) => ({
    id: role.id,
    name: role.name,
    displayName: role.displayName,
    description: role.description,
    isSystem: role.isSystem,
    permissionCount: role._count.rolePermissions,
    userCount: role._count.userRoles,
    permissionIds: role.rolePermissions.map((rp) => rp.permissionId),
    createdAt: role.createdAt,
  }));

  return { data: mapped };
}

export async function getPermissionsAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const permissions = await db.permission.findMany({
    orderBy: [{ module: "asc" }, { action: "asc" }],
  });

  return { data: permissions };
}

export async function createRoleAction(data: CreateRoleInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = createRoleSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.role.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return { error: "A role with this name already exists" };
  }

  const role = await db.role.create({
    data: {
      name: parsed.data.name,
      displayName: parsed.data.displayName,
      description: parsed.data.description || null,
      rolePermissions: {
        create: parsed.data.permissionIds.map((permissionId) => ({
          permissionId,
        })),
      },
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Role",
    entityId: role.id,
    module: "admin",
    description: `Created role "${role.displayName}" with ${parsed.data.permissionIds.length} permissions`,
    newData: { name: role.name, displayName: role.displayName, permissionCount: parsed.data.permissionIds.length },
  });

  return { data: role };
}

export async function updateRoleAction(id: string, data: UpdateRoleInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = updateRoleSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.role.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Role not found" };
  }

  const duplicate = await db.role.findFirst({
    where: { name: parsed.data.name, NOT: { id } },
  });
  if (duplicate) {
    return { error: "A role with this name already exists" };
  }

  const role = await db.role.update({
    where: { id },
    data: {
      name: parsed.data.name,
      displayName: parsed.data.displayName,
      description: parsed.data.description || null,
    },
  });

  // Sync permissions: delete existing and recreate
  await db.rolePermission.deleteMany({ where: { roleId: id } });
  if (parsed.data.permissionIds.length > 0) {
    await db.rolePermission.createMany({
      data: parsed.data.permissionIds.map((permissionId) => ({
        roleId: id,
        permissionId,
      })),
    });
  }

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Role",
    entityId: role.id,
    module: "admin",
    description: `Updated role "${role.displayName}" with ${parsed.data.permissionIds.length} permissions`,
    previousData: { name: existing.name, displayName: existing.displayName },
    newData: { name: role.name, displayName: role.displayName, permissionCount: parsed.data.permissionIds.length },
  });

  return { data: role };
}

export async function deleteRoleAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const role = await db.role.findUnique({
    where: { id },
    include: { _count: { select: { userRoles: true } } },
  });

  if (!role) {
    return { error: "Role not found" };
  }

  if (role.isSystem) {
    return { error: "System roles cannot be deleted" };
  }

  if (role._count.userRoles > 0) {
    return { error: `Cannot delete role "${role.displayName}" because it is assigned to ${role._count.userRoles} user(s)` };
  }

  await db.rolePermission.deleteMany({ where: { roleId: id } });
  await db.role.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "Role",
    entityId: id,
    module: "admin",
    description: `Deleted role "${role.displayName}"`,
    previousData: { name: role.name, displayName: role.displayName },
  });

  return { success: true };
}
