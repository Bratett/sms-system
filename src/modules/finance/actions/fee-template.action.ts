"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import {
  createFeeTemplateSchema,
  updateFeeTemplateSchema,
  createFromTemplateSchema,
  type CreateFeeTemplateInput,
  type UpdateFeeTemplateInput,
  type CreateFromTemplateInput,
} from "@/modules/finance/schemas/fee-template.schema";

export async function getFeeTemplatesAction(filters?: { isActive?: boolean }) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const where: Record<string, unknown> = { schoolId: school.id };
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  const templates = await db.feeTemplate.findMany({
    where,
    include: {
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const programmeIds = templates.map((t) => t.programmeId).filter(Boolean) as string[];
  const programmes =
    programmeIds.length > 0
      ? await db.programme.findMany({
          where: { id: { in: programmeIds } },
          select: { id: true, name: true },
        })
      : [];
  const progMap = new Map(programmes.map((p) => [p.id, p.name]));

  const data = templates.map((t) => ({
    ...t,
    programmeName: t.programmeId ? progMap.get(t.programmeId) ?? null : null,
    itemCount: t.items.length,
    totalAmount: t.items.reduce((sum, item) => sum + toNum(item.amount), 0),
  }));

  return { data };
}

export async function getFeeTemplateAction(templateId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const template = await db.feeTemplate.findUnique({
    where: { id: templateId },
    include: { items: true },
  });

  if (!template) return { error: "Fee template not found" };

  return { data: template };
}

export async function createFeeTemplateAction(data: CreateFeeTemplateInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createFeeTemplateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const existing = await db.feeTemplate.findUnique({
    where: { schoolId_name: { schoolId: school.id, name: parsed.data.name } },
  });
  if (existing) return { error: "A fee template with this name already exists" };

  const template = await db.$transaction(async (tx) => {
    const created = await tx.feeTemplate.create({
      data: {
        schoolId: school.id,
        name: parsed.data.name,
        description: parsed.data.description,
        boardingStatus: parsed.data.boardingStatus,
        programmeId: parsed.data.programmeId,
      },
    });

    await tx.feeTemplateItem.createMany({
      data: parsed.data.items.map((item) => ({
        feeTemplateId: created.id,
        name: item.name,
        code: item.code,
        amount: item.amount,
        isOptional: item.isOptional ?? false,
        description: item.description,
      })),
    });

    return created;
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "FeeTemplate",
    entityId: template.id,
    module: "finance",
    description: `Created fee template "${parsed.data.name}"`,
  });

  return { data: template };
}

export async function updateFeeTemplateAction(templateId: string, data: UpdateFeeTemplateInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = updateFeeTemplateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const template = await db.feeTemplate.findUnique({ where: { id: templateId } });
  if (!template) return { error: "Fee template not found" };

  const updated = await db.feeTemplate.update({
    where: { id: templateId },
    data: parsed.data,
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "FeeTemplate",
    entityId: templateId,
    module: "finance",
    description: `Updated fee template "${updated.name}"`,
  });

  return { data: updated };
}

export async function deleteFeeTemplateAction(templateId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const template = await db.feeTemplate.findUnique({ where: { id: templateId } });
  if (!template) return { error: "Fee template not found" };

  await db.feeTemplate.delete({ where: { id: templateId } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "FeeTemplate",
    entityId: templateId,
    module: "finance",
    description: `Deleted fee template "${template.name}"`,
  });

  return { data: { success: true } };
}

export async function createFeeStructureFromTemplateAction(data: CreateFromTemplateInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createFromTemplateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const template = await db.feeTemplate.findUnique({
    where: { id: parsed.data.feeTemplateId },
    include: { items: true },
  });
  if (!template) return { error: "Fee template not found" };

  // Build adjustment map
  const adjustmentMap = new Map(
    (parsed.data.adjustments ?? []).map((a) => [a.itemName, a.newAmount])
  );

  const feeStructure = await db.$transaction(async (tx) => {
    const structure = await tx.feeStructure.create({
      data: {
        schoolId: school.id,
        name: parsed.data.name,
        academicYearId: parsed.data.academicYearId,
        termId: parsed.data.termId,
        programmeId: template.programmeId,
        boardingStatus: template.boardingStatus,
        status: "DRAFT",
      },
    });

    await tx.feeItem.createMany({
      data: template.items.map((item) => ({
        feeStructureId: structure.id,
        name: item.name,
        code: item.code,
        amount: adjustmentMap.get(item.name) ?? toNum(item.amount),
        isOptional: item.isOptional,
        description: item.description,
      })),
    });

    return structure;
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "FeeStructure",
    entityId: feeStructure.id,
    module: "finance",
    description: `Created fee structure "${parsed.data.name}" from template "${template.name}"`,
  });

  return { data: feeStructure };
}
