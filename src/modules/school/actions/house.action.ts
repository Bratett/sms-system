"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

export async function getHousesAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOUSES_READ);
  if (denied) return denied;

  const houses = await db.house.findMany({
    where: { schoolId: ctx.schoolId },
    orderBy: { name: "asc" },
    include: {
      housemaster: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const data = houses.map((house) => ({
    id: house.id,
    name: house.name,
    color: house.color,
    motto: house.motto,
    description: house.description,
    status: house.status,
    housemasterId: house.housemasterId,
    housemaster: house.housemaster
      ? {
          id: house.housemaster.id,
          firstName: house.housemaster.firstName,
          lastName: house.housemaster.lastName,
        }
      : null,
    createdAt: house.createdAt,
    updatedAt: house.updatedAt,
  }));

  return { data };
}

/**
 * Returns staff eligible to be assigned as housemasters for the caller's school.
 * Filters to active staff with a linked portal user (so the housemaster can
 * actually receive messaging counterparts / portal notifications).
 *
 * @no-audit Read-only lookup; no mutation performed.
 */
export async function getEligibleHousemastersAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOUSES_READ);
  if (denied) return denied;

  const staff = await db.staff.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "ACTIVE",
      deletedAt: null,
      userId: { not: null },
    },
    select: { id: true, firstName: true, lastName: true, userId: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return { data: staff };
}

export async function createHouseAction(data: {
  name: string;
  color?: string;
  motto?: string;
  description?: string;
  housemasterId?: string | null;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOUSES_CREATE);
  if (denied) return denied;

  // Check for duplicate name
  const existing = await db.house.findUnique({
    where: {
      schoolId_name: {
        schoolId: ctx.schoolId,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { error: `A house named "${data.name}" already exists.` };
  }

  // Normalize empty string to null so the admin can clear the relation.
  const housemasterId =
    data.housemasterId === undefined || data.housemasterId === ""
      ? null
      : data.housemasterId;

  // If a housemaster is provided, verify it matches the same filter applied
  // by getEligibleHousemastersAction: active + linked to a portal user. This
  // prevents admins from assigning staff who wouldn't appear in the picker.
  if (housemasterId) {
    const staff = await db.staff.findFirst({
      where: {
        id: housemasterId,
        schoolId: ctx.schoolId,
        deletedAt: null,
        status: "ACTIVE",
        userId: { not: null },
      },
      select: { id: true },
    });
    if (!staff) {
      return {
        error:
          "Selected housemaster is not eligible (must be active staff with a linked portal user).",
      };
    }
  }

  const house = await db.house.create({
    data: {
      schoolId: ctx.schoolId,
      name: data.name,
      color: data.color || null,
      motto: data.motto || null,
      description: data.description || null,
      housemasterId,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "House",
    entityId: house.id,
    module: "school",
    description: `Created house "${house.name}"`,
    newData: house,
  });

  return { data: house };
}

export async function updateHouseAction(
  id: string,
  data: {
    name?: string;
    color?: string;
    motto?: string;
    description?: string;
    status?: "ACTIVE" | "INACTIVE";
    housemasterId?: string | null;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOUSES_UPDATE);
  if (denied) return denied;

  const existing = await db.house.findUnique({
    where: { id },
  });

  if (!existing) {
    return { error: "House not found." };
  }

  // Check for duplicate name if name is being changed
  if (data.name && data.name !== existing.name) {
    const duplicate = await db.house.findUnique({
      where: {
        schoolId_name: {
          schoolId: ctx.schoolId,
          name: data.name,
        },
      },
    });

    if (duplicate) {
      return { error: `A house named "${data.name}" already exists.` };
    }
  }

  // Normalize empty string to null so the admin can clear the relation.
  let housemasterId: string | null | undefined;
  if (data.housemasterId === undefined) {
    housemasterId = undefined; // no change
  } else if (data.housemasterId === "" || data.housemasterId === null) {
    housemasterId = null;
  } else {
    const staff = await db.staff.findFirst({
      where: {
        id: data.housemasterId,
        schoolId: ctx.schoolId,
        deletedAt: null,
        status: "ACTIVE",
        userId: { not: null },
      },
      select: { id: true },
    });
    if (!staff) {
      return {
        error:
          "Selected housemaster is not eligible (must be active staff with a linked portal user).",
      };
    }
    housemasterId = data.housemasterId;
  }

  const previousData = { ...existing };

  const updated = await db.house.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      color: data.color !== undefined ? data.color || null : existing.color,
      motto: data.motto !== undefined ? data.motto || null : existing.motto,
      description: data.description !== undefined ? data.description || null : existing.description,
      status: data.status ?? existing.status,
      ...(housemasterId !== undefined ? { housemasterId } : {}),
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "House",
    entityId: id,
    module: "school",
    description: `Updated house "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteHouseAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.HOUSES_UPDATE);
  if (denied) return denied;

  const house = await db.house.findUnique({
    where: { id },
  });

  if (!house) {
    return { error: "House not found." };
  }

  await db.house.delete({
    where: { id },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "DELETE",
    entity: "House",
    entityId: id,
    module: "school",
    description: `Deleted house "${house.name}"`,
    previousData: house,
  });

  return { success: true };
}
