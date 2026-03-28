"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/modules/auth/schemas/user.schema";

export async function getUsersAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const users = await db.user.findMany({
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = users.map((user) => ({
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    roles: user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      displayName: ur.role.displayName,
    })),
  }));

  return { data: mapped };
}

export async function createUserAction(data: CreateUserInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.user.findFirst({
    where: {
      OR: [{ email: parsed.data.email }, { username: parsed.data.username }],
    },
  });

  if (existing) {
    if (existing.email === parsed.data.email) {
      return { error: "A user with this email already exists" };
    }
    return { error: "A user with this username already exists" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await db.user.create({
    data: {
      username: parsed.data.username,
      email: parsed.data.email,
      passwordHash,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone || null,
      userRoles: {
        create: parsed.data.roleIds.map((roleId) => ({
          roleId,
          assignedBy: session.user.id,
        })),
      },
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "User",
    entityId: user.id,
    module: "admin",
    description: `Created user "${user.username}" (${user.email})`,
    newData: { username: user.username, email: user.email, firstName: user.firstName, lastName: user.lastName },
  });

  return { data: user };
}

export async function updateUserAction(id: string, data: UpdateUserInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = updateUserSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) {
    return { error: "User not found" };
  }

  const duplicate = await db.user.findFirst({
    where: {
      OR: [{ email: parsed.data.email }, { username: parsed.data.username }],
      NOT: { id },
    },
  });

  if (duplicate) {
    if (duplicate.email === parsed.data.email) {
      return { error: "A user with this email already exists" };
    }
    return { error: "A user with this username already exists" };
  }

  const updateData: Record<string, unknown> = {
    username: parsed.data.username,
    email: parsed.data.email,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone || null,
  };

  if (parsed.data.password && parsed.data.password.length > 0) {
    updateData.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  }

  const user = await db.user.update({
    where: { id },
    data: updateData,
  });

  // Sync roles: delete existing and recreate
  await db.userRole.deleteMany({ where: { userId: id } });
  await db.userRole.createMany({
    data: parsed.data.roleIds.map((roleId) => ({
      userId: id,
      roleId,
      assignedBy: session.user.id,
    })),
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    module: "admin",
    description: `Updated user "${user.username}"`,
    previousData: { username: existing.username, email: existing.email },
    newData: { username: user.username, email: user.email },
  });

  return { data: user };
}

export async function deleteUserAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  if (id === session.user.id) {
    return { error: "You cannot deactivate your own account" };
  }

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    return { error: "User not found" };
  }

  await db.user.update({
    where: { id },
    data: { status: "INACTIVE" },
  });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "User",
    entityId: id,
    module: "admin",
    description: `Deactivated user "${user.username}"`,
    previousData: { status: user.status },
    newData: { status: "INACTIVE" },
  });

  return { success: true };
}
