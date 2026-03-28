"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Suppliers ──────────────────────────────────────────────────────

export async function getSuppliersAction(search?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const suppliers = await db.supplier.findMany({
    where: {
      schoolId: school.id,
      status: "ACTIVE",
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { contactPerson: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      _count: { select: { purchaseOrders: true } },
    },
    orderBy: { name: "asc" },
  });

  const data = suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    status: supplier.status,
    purchaseOrderCount: supplier._count.purchaseOrders,
    createdAt: supplier.createdAt,
  }));

  return { data };
}

export async function createSupplierAction(data: {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const existing = await db.supplier.findUnique({
    where: {
      schoolId_name: {
        schoolId: school.id,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { error: `A supplier named "${data.name}" already exists.` };
  }

  const supplier = await db.supplier.create({
    data: {
      schoolId: school.id,
      name: data.name,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Supplier",
    entityId: supplier.id,
    module: "inventory",
    description: `Created supplier "${supplier.name}"`,
    newData: supplier,
  });

  return { data: supplier };
}

export async function updateSupplierAction(
  id: string,
  data: {
    name?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    status?: "ACTIVE" | "INACTIVE";
  },
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const existing = await db.supplier.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Supplier not found." };
  }

  if (data.name && data.name !== existing.name) {
    const duplicate = await db.supplier.findUnique({
      where: {
        schoolId_name: {
          schoolId: school.id,
          name: data.name,
        },
      },
    });
    if (duplicate) {
      return { error: `A supplier named "${data.name}" already exists.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.supplier.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      contactPerson: data.contactPerson !== undefined ? data.contactPerson || null : existing.contactPerson,
      phone: data.phone !== undefined ? data.phone || null : existing.phone,
      email: data.email !== undefined ? data.email || null : existing.email,
      address: data.address !== undefined ? data.address || null : existing.address,
      status: data.status ?? existing.status,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Supplier",
    entityId: id,
    module: "inventory",
    description: `Updated supplier "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteSupplierAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const supplier = await db.supplier.findUnique({
    where: { id },
    include: { _count: { select: { purchaseOrders: true } } },
  });

  if (!supplier) {
    return { error: "Supplier not found." };
  }

  if (supplier._count.purchaseOrders > 0) {
    return { error: "Cannot delete supplier with purchase orders. Deactivate it instead." };
  }

  await db.supplier.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "Supplier",
    entityId: id,
    module: "inventory",
    description: `Deleted supplier "${supplier.name}"`,
    previousData: supplier,
  });

  return { success: true };
}
