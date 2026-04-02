"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { toNum } from "@/lib/decimal";
import {
  createFeeStructureSchema,
  updateFeeStructureSchema,
  addFeeItemSchema,
  type CreateFeeStructureInput,
  type UpdateFeeStructureInput,
  type AddFeeItemInput,
} from "@/modules/finance/schemas/fee-structure.schema";

export async function getFeeStructuresAction(filters?: {
  academicYearId?: string;
  termId?: string;
  status?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FEE_STRUCTURES_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters?.termId) where.termId = filters.termId;
  if (filters?.status) where.status = filters.status;

  const feeStructures = await db.feeStructure.findMany({
    where,
    include: {
      feeItems: true,
      _count: {
        select: { bills: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch term and academic year names
  const termIds = [...new Set(feeStructures.map((fs) => fs.termId))];
  const academicYearIds = [...new Set(feeStructures.map((fs) => fs.academicYearId))];
  const programmeIds = feeStructures.map((fs) => fs.programmeId).filter(Boolean) as string[];

  const [terms, academicYears, programmes] = await Promise.all([
    db.term.findMany({
      where: { id: { in: termIds } },
      select: { id: true, name: true },
    }),
    db.academicYear.findMany({
      where: { id: { in: academicYearIds } },
      select: { id: true, name: true },
    }),
    programmeIds.length > 0
      ? db.programme.findMany({
          where: { id: { in: programmeIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const termMap = new Map(terms.map((t) => [t.id, t.name]));
  const yearMap = new Map(academicYears.map((ay) => [ay.id, ay.name]));
  const progMap = new Map(programmes.map((p) => [p.id, p.name]));

  const data = feeStructures.map((fs) => ({
    ...fs,
    termName: termMap.get(fs.termId) ?? "Unknown",
    academicYearName: yearMap.get(fs.academicYearId) ?? "Unknown",
    programmeName: fs.programmeId ? progMap.get(fs.programmeId) ?? "Unknown" : null,
    totalAmount: fs.feeItems.reduce((sum, item) => sum + toNum(item.amount), 0),
    itemCount: fs.feeItems.length,
    billCount: fs._count.bills,
  }));

  return { data };
}

export async function getFeeStructureAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FEE_STRUCTURES_READ);
  if (denied) return denied;

  const feeStructure = await db.feeStructure.findUnique({
    where: { id },
    include: {
      feeItems: {
        orderBy: { name: "asc" },
      },
      _count: {
        select: { bills: true },
      },
    },
  });

  if (!feeStructure) {
    return { error: "Fee structure not found" };
  }

  // Fetch related names
  const [term, academicYear, programme] = await Promise.all([
    db.term.findUnique({
      where: { id: feeStructure.termId },
      select: { id: true, name: true, termNumber: true },
    }),
    db.academicYear.findUnique({
      where: { id: feeStructure.academicYearId },
      select: { id: true, name: true },
    }),
    feeStructure.programmeId
      ? db.programme.findUnique({
          where: { id: feeStructure.programmeId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  const totalAmount = feeStructure.feeItems.reduce((sum, item) => sum + toNum(item.amount), 0);
  const optionalTotal = feeStructure.feeItems
    .filter((item) => item.isOptional)
    .reduce((sum, item) => sum + toNum(item.amount), 0);

  return {
    data: {
      ...feeStructure,
      termName: term?.name ?? "Unknown",
      termNumber: term?.termNumber ?? 0,
      academicYearName: academicYear?.name ?? "Unknown",
      programmeName: programme?.name ?? null,
      totalAmount,
      optionalTotal,
      billCount: feeStructure._count.bills,
    },
  };
}

export async function createFeeStructureAction(data: CreateFeeStructureInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FEE_STRUCTURES_CREATE);
  if (denied) return denied;

  const parsed = createFeeStructureSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const { feeItems, ...structureData } = parsed.data;

  const feeStructure = await db.$transaction(async (tx) => {
    const structure = await tx.feeStructure.create({
      data: {
        schoolId: ctx.schoolId,
        name: structureData.name,
        academicYearId: structureData.academicYearId,
        termId: structureData.termId,
        programmeId: structureData.programmeId || null,
        boardingStatus: structureData.boardingStatus || null,
        status: "DRAFT",
        feeItems: {
          create: feeItems.map((item) => ({
            schoolId: ctx.schoolId,
            name: item.name,
            code: item.code || null,
            amount: item.amount,
            isOptional: item.isOptional ?? false,
            description: item.description || null,
          })),
        },
      },
      include: {
        feeItems: true,
      },
    });
    return structure;
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "FeeStructure",
    entityId: feeStructure.id,
    module: "finance",
    description: `Created fee structure "${feeStructure.name}" with ${feeItems.length} fee items`,
    newData: feeStructure,
  });

  return { data: feeStructure };
}

export async function updateFeeStructureAction(id: string, data: UpdateFeeStructureInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FEE_STRUCTURES_UPDATE);
  if (denied) return denied;

  const parsed = updateFeeStructureSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.feeStructure.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Fee structure not found" };
  }

  if (existing.status !== "DRAFT") {
    return { error: "Can only update fee structures in DRAFT status" };
  }

  const previousData = { ...existing };

  const updated = await db.feeStructure.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.programmeId !== undefined && { programmeId: parsed.data.programmeId || null }),
      ...(parsed.data.boardingStatus !== undefined && {
        boardingStatus: parsed.data.boardingStatus || null,
      }),
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "FeeStructure",
    entityId: id,
    module: "finance",
    description: `Updated fee structure "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function addFeeItemAction(feeStructureId: string, data: AddFeeItemInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FEE_STRUCTURES_UPDATE);
  if (denied) return denied;

  const parsed = addFeeItemSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const feeStructure = await db.feeStructure.findUnique({ where: { id: feeStructureId } });
  if (!feeStructure) {
    return { error: "Fee structure not found" };
  }

  if (feeStructure.status !== "DRAFT") {
    return { error: "Can only add items to fee structures in DRAFT status" };
  }

  const feeItem = await db.feeItem.create({
    data: {
      schoolId: ctx.schoolId,
      feeStructureId,
      name: parsed.data.name,
      code: parsed.data.code || null,
      amount: parsed.data.amount,
      isOptional: parsed.data.isOptional ?? false,
      description: parsed.data.description || null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "FeeItem",
    entityId: feeItem.id,
    module: "finance",
    description: `Added fee item "${feeItem.name}" to fee structure "${feeStructure.name}"`,
    newData: feeItem,
  });

  return { data: feeItem };
}

export async function removeFeeItemAction(feeItemId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FEE_STRUCTURES_DELETE);
  if (denied) return denied;

  const feeItem = await db.feeItem.findUnique({
    where: { id: feeItemId },
    include: { feeStructure: true },
  });

  if (!feeItem) {
    return { error: "Fee item not found" };
  }

  if (feeItem.feeStructure.status !== "DRAFT") {
    return { error: "Can only remove items from fee structures in DRAFT status" };
  }

  await db.feeItem.delete({ where: { id: feeItemId } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "FeeItem",
    entityId: feeItemId,
    module: "finance",
    description: `Removed fee item "${feeItem.name}" from fee structure "${feeItem.feeStructure.name}"`,
    previousData: feeItem,
  });

  return { success: true };
}

export async function activateFeeStructureAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FEE_STRUCTURES_APPROVE);
  if (denied) return denied;

  const feeStructure = await db.feeStructure.findUnique({
    where: { id },
    include: { feeItems: true },
  });

  if (!feeStructure) {
    return { error: "Fee structure not found" };
  }

  if (feeStructure.status !== "DRAFT") {
    return { error: "Can only activate fee structures in DRAFT status" };
  }

  if (feeStructure.feeItems.length === 0) {
    return { error: "Cannot activate a fee structure with no fee items" };
  }

  const updated = await db.feeStructure.update({
    where: { id },
    data: {
      status: "ACTIVE",
      approvedBy: ctx.session.user.id,
      approvedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "FeeStructure",
    entityId: id,
    module: "finance",
    description: `Activated fee structure "${feeStructure.name}"`,
    previousData: { status: "DRAFT" },
    newData: { status: "ACTIVE" },
  });

  return { data: updated };
}

export async function deleteFeeStructureAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FEE_STRUCTURES_DELETE);
  if (denied) return denied;

  const feeStructure = await db.feeStructure.findUnique({
    where: { id },
    include: { _count: { select: { bills: true } } },
  });

  if (!feeStructure) {
    return { error: "Fee structure not found" };
  }

  if (feeStructure.status !== "DRAFT") {
    return { error: "Can only delete fee structures in DRAFT status" };
  }

  if (feeStructure._count.bills > 0) {
    return { error: "Cannot delete fee structure that has generated bills" };
  }

  await db.feeStructure.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "FeeStructure",
    entityId: id,
    module: "finance",
    description: `Deleted fee structure "${feeStructure.name}"`,
    previousData: feeStructure,
  });

  return { success: true };
}
