"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";

// ─── List Supplier Contracts ────────────────────────────────────────

export async function getSupplierContractsAction(supplierId?: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const contracts = await db.supplierContract.findMany({
    where: {
      ...(supplierId && { supplierId }),
    },
    include: {
      supplier: { select: { id: true, name: true } },
    },
    orderBy: { endDate: "asc" },
  });

  const data = contracts.map((c) => ({
    id: c.id,
    supplierId: c.supplierId,
    supplierName: c.supplier.name,
    contractNumber: c.contractNumber,
    startDate: c.startDate,
    endDate: c.endDate,
    terms: c.terms,
    value: c.value ? toNum(c.value) : null,
    status: c.status,
    documentUrl: c.documentUrl,
    createdAt: c.createdAt,
  }));

  return { data };
}

// ─── Create Supplier Contract ───────────────────────────────────────

export async function createSupplierContractAction(data: {
  supplierId: string;
  contractNumber?: string;
  startDate: string;
  endDate: string;
  terms?: string;
  value?: number;
  documentUrl?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const supplier = await db.supplier.findUnique({ where: { id: data.supplierId } });
  if (!supplier) return { error: "Supplier not found." };

  const contract = await db.supplierContract.create({
    data: {
      supplierId: data.supplierId,
      contractNumber: data.contractNumber || null,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      terms: data.terms || null,
      value: data.value ?? null,
      documentUrl: data.documentUrl || null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "SupplierContract",
    entityId: contract.id,
    module: "inventory",
    description: `Created contract for supplier "${supplier.name}"${data.contractNumber ? ` (${data.contractNumber})` : ""}`,
    newData: contract,
  });

  return { data: contract };
}

// ─── Update Supplier Contract ───────────────────────────────────────

export async function updateSupplierContractAction(
  id: string,
  data: {
    contractNumber?: string;
    startDate?: string;
    endDate?: string;
    terms?: string;
    value?: number;
    status?: string;
    documentUrl?: string;
  },
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const contract = await db.supplierContract.findUnique({ where: { id } });
  if (!contract) return { error: "Contract not found." };

  const updated = await db.supplierContract.update({
    where: { id },
    data: {
      ...(data.contractNumber !== undefined && { contractNumber: data.contractNumber }),
      ...(data.startDate && { startDate: new Date(data.startDate) }),
      ...(data.endDate && { endDate: new Date(data.endDate) }),
      ...(data.terms !== undefined && { terms: data.terms }),
      ...(data.value !== undefined && { value: data.value }),
      ...(data.status && { status: data.status as any }),
      ...(data.documentUrl !== undefined && { documentUrl: data.documentUrl }),
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "SupplierContract",
    entityId: id,
    module: "inventory",
    description: `Updated supplier contract ${contract.contractNumber ?? id}`,
    previousData: contract,
    newData: updated,
  });

  return { data: updated };
}

// ─── Expiring Contracts ─────────────────────────────────────────────

export async function getExpiringContractsAction(withinDays: number = 90) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + withinDays);

  const contracts = await db.supplierContract.findMany({
    where: {
      status: "ACTIVE",
      endDate: { lte: cutoffDate },
    },
    include: {
      supplier: { select: { id: true, name: true } },
    },
    orderBy: { endDate: "asc" },
  });

  const now = new Date();
  const data = contracts.map((c) => {
    const daysUntilExpiry = Math.ceil((c.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: c.id,
      supplierId: c.supplierId,
      supplierName: c.supplier.name,
      contractNumber: c.contractNumber,
      endDate: c.endDate,
      value: c.value ? toNum(c.value) : null,
      daysUntilExpiry,
      isExpired: daysUntilExpiry < 0,
      urgency: daysUntilExpiry < 0 ? "expired" : daysUntilExpiry <= 30 ? "critical" : daysUntilExpiry <= 60 ? "warning" : "info",
    };
  });

  return { data };
}
