"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  createAccountCategorySchema,
  createAccountSchema,
  updateAccountSchema,
  type CreateAccountCategoryInput,
  type CreateAccountInput,
  type UpdateAccountInput,
} from "@/modules/accounting/schemas/chart-of-accounts.schema";

export async function getAccountCategoriesAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const categories = await db.accountCategory.findMany({
    where: { schoolId: ctx.schoolId },
    include: {
      accounts: {
        where: { parentId: null },
        include: {
          children: { orderBy: { code: "asc" } },
        },
        orderBy: { code: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return { data: categories };
}

export async function getAccountsAction(filters?: { categoryId?: string; isActive?: boolean }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COA_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.categoryId) where.categoryId = filters.categoryId;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  const accounts = await db.account.findMany({
    where,
    include: {
      category: { select: { name: true, type: true } },
      parent: { select: { code: true, name: true } },
      _count: { select: { children: true } },
    },
    orderBy: { code: "asc" },
  });

  return { data: accounts };
}

export async function createAccountCategoryAction(data: CreateAccountCategoryInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const parsed = createAccountCategorySchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  const category = await db.accountCategory.create({
    data: { schoolId: ctx.schoolId, ...parsed.data },
  });

  await audit({ userId: ctx.session.user.id, action: "CREATE", entity: "AccountCategory", entityId: category.id, module: "accounting", description: `Created account category "${parsed.data.name}"` });

  return { data: category };
}

export async function createAccountAction(data: CreateAccountInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COA_CREATE);
  if (denied) return denied;

  const parsed = createAccountSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  // Check unique code
  const existing = await db.account.findUnique({
    where: { schoolId_code: { schoolId: ctx.schoolId, code: parsed.data.code } },
  });
  if (existing) return { error: `Account code "${parsed.data.code}" already exists` };

  const account = await db.account.create({
    data: { schoolId: ctx.schoolId, ...parsed.data },
  });

  await audit({ userId: ctx.session.user.id, action: "CREATE", entity: "Account", entityId: account.id, module: "accounting", description: `Created account "${parsed.data.code} - ${parsed.data.name}"` });

  return { data: account };
}

export async function updateAccountAction(accountId: string, data: UpdateAccountInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COA_UPDATE);
  if (denied) return denied;

  const parsed = updateAccountSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "Account not found" };

  const updated = await db.account.update({ where: { id: accountId }, data: parsed.data });

  await audit({ userId: ctx.session.user.id, action: "UPDATE", entity: "Account", entityId: accountId, module: "accounting", description: `Updated account "${updated.code} - ${updated.name}"` });

  return { data: updated };
}

export async function seedDefaultChartOfAccountsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.COA_CREATE);
  if (denied) return denied;

  const { seedGhanaPublicSectorCoa } = await import("@/modules/accounting/seed/ghana-public-sector-coa");

  const result = await db.$transaction(async (tx) => {
    return seedGhanaPublicSectorCoa(tx, ctx.schoolId);
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Account",
    entityId: ctx.schoolId,
    module: "accounting",
    description: `Seeded Ghana public-sector COA: ${result.categoriesCreated} categories, ${result.accountsCreated} accounts, ${result.fundsCreated} funds`,
  });

  return {
    data: {
      success: true,
      message: `Seeded Ghana public-sector Chart of Accounts (${result.accountsCreated} new accounts, ${result.fundsCreated} new funds).`,
      ...result,
    },
  };
}
