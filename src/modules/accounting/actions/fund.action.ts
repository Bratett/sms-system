"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import type { FundType } from "@prisma/client";

export async function getFundsAction(filters?: { type?: FundType; isActive?: boolean }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.JOURNAL_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.type) where.type = filters.type;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  const funds = await db.fund.findMany({
    where,
    orderBy: [{ isDefault: "desc" }, { code: "asc" }],
  });
  return { data: funds };
}

export async function createFundAction(data: {
  code: string;
  name: string;
  type: FundType;
  description?: string;
  parentFundId?: string | null;
  isDefault?: boolean;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FUND_MANAGE);
  if (denied) return denied;

  const existing = await db.fund.findUnique({ where: { schoolId_code: { schoolId: ctx.schoolId, code: data.code } } });
  if (existing) return { error: `Fund code "${data.code}" already exists` };

  const fund = await db.$transaction(async (tx) => {
    // Only one default fund per school — demote the previous default if a new one is flagged
    if (data.isDefault) {
      await tx.fund.updateMany({
        where: { schoolId: ctx.schoolId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.fund.create({
      data: {
        schoolId: ctx.schoolId,
        code: data.code,
        name: data.name,
        type: data.type,
        description: data.description,
        parentFundId: data.parentFundId,
        isDefault: data.isDefault ?? false,
      },
    });
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Fund",
    entityId: fund.id,
    module: "accounting",
    description: `Created fund ${fund.code} "${fund.name}"`,
  });

  return { data: fund };
}

export async function updateFundAction(fundId: string, data: {
  name?: string;
  description?: string;
  isActive?: boolean;
  isDefault?: boolean;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.FUND_MANAGE);
  if (denied) return denied;

  const fund = await db.fund.findUnique({ where: { id: fundId } });
  if (!fund) return { error: "Fund not found" };
  if (fund.schoolId !== ctx.schoolId) return { error: "Access denied" };

  const updated = await db.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.fund.updateMany({
        where: { schoolId: ctx.schoolId, isDefault: true, id: { not: fundId } },
        data: { isDefault: false },
      });
    }
    return tx.fund.update({ where: { id: fundId }, data });
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "Fund",
    entityId: fundId,
    module: "accounting",
    description: `Updated fund ${fund.code}`,
  });

  return { data: updated };
}
