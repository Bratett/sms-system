"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
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
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FEE_TEMPLATES_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
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
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FEE_TEMPLATES_READ);
  if (denied) return denied;

  const template = await db.feeTemplate.findUnique({
    where: { id: templateId },
    include: { items: true },
  });

  if (!template) return { error: "Fee template not found" };

  return { data: template };
}

export async function createFeeTemplateAction(data: CreateFeeTemplateInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FEE_TEMPLATES_CREATE);
  if (denied) return denied;

  const parsed = createFeeTemplateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const existing = await db.feeTemplate.findUnique({
    where: { schoolId_name: { schoolId: ctx.schoolId, name: parsed.data.name } },
  });
  if (existing) return { error: "A fee template with this name already exists" };

  const template = await db.$transaction(async (tx) => {
    const created = await tx.feeTemplate.create({
      data: {
        schoolId: ctx.schoolId,
        name: parsed.data.name,
        description: parsed.data.description,
        boardingStatus: parsed.data.boardingStatus,
        programmeId: parsed.data.programmeId,
      },
    });

    await tx.feeTemplateItem.createMany({
      data: parsed.data.items.map((item) => ({
        schoolId: ctx.schoolId,
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
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "FeeTemplate",
    entityId: template.id,
    module: "finance",
    description: `Created fee template "${parsed.data.name}"`,
  });

  return { data: template };
}

export async function updateFeeTemplateAction(templateId: string, data: UpdateFeeTemplateInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FEE_TEMPLATES_UPDATE);
  if (denied) return denied;

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
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "FeeTemplate",
    entityId: templateId,
    module: "finance",
    description: `Updated fee template "${updated.name}"`,
  });

  return { data: updated };
}

export async function deleteFeeTemplateAction(templateId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FEE_TEMPLATES_DELETE);
  if (denied) return denied;

  const template = await db.feeTemplate.findUnique({ where: { id: templateId } });
  if (!template) return { error: "Fee template not found" };

  await db.feeTemplate.delete({ where: { id: templateId } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "FeeTemplate",
    entityId: templateId,
    module: "finance",
    description: `Deleted fee template "${template.name}"`,
  });

  return { data: { success: true } };
}

export async function createFeeStructureFromTemplateAction(data: CreateFromTemplateInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FEE_TEMPLATES_CREATE);
  if (denied) return denied;

  const parsed = createFromTemplateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
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
        schoolId: ctx.schoolId,
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
        schoolId: ctx.schoolId,
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
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "FeeStructure",
    entityId: feeStructure.id,
    module: "finance",
    description: `Created fee structure "${parsed.data.name}" from template "${template.name}"`,
  });

  return { data: feeStructure };
}
