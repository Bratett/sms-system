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

  // Check if already seeded
  const existingCategories = await db.accountCategory.count({ where: { schoolId: ctx.schoolId } });
  if (existingCategories > 0) return { error: "Chart of accounts already exists for this school" };

  const defaultCoA = [
    { name: "Assets", type: "ASSET" as const, sortOrder: 1, accounts: [
      { code: "1000", name: "Cash on Hand", normalBalance: "DEBIT" as const },
      { code: "1010", name: "Bank - GCB", normalBalance: "DEBIT" as const },
      { code: "1020", name: "Bank - Ecobank", normalBalance: "DEBIT" as const },
      { code: "1030", name: "Mobile Money Accounts", normalBalance: "DEBIT" as const },
      { code: "1100", name: "Accounts Receivable - Fees", normalBalance: "DEBIT" as const },
      { code: "1200", name: "Prepaid Expenses", normalBalance: "DEBIT" as const },
      { code: "1300", name: "Inventory - Supplies", normalBalance: "DEBIT" as const },
      { code: "1500", name: "Fixed Assets", normalBalance: "DEBIT" as const },
      { code: "1510", name: "Accumulated Depreciation", normalBalance: "CREDIT" as const },
    ]},
    { name: "Liabilities", type: "LIABILITY" as const, sortOrder: 2, accounts: [
      { code: "2000", name: "Accounts Payable", normalBalance: "CREDIT" as const },
      { code: "2100", name: "Salaries Payable", normalBalance: "CREDIT" as const },
      { code: "2200", name: "SSNIT Payable", normalBalance: "CREDIT" as const },
      { code: "2300", name: "Tax Payable - PAYE", normalBalance: "CREDIT" as const },
      { code: "2400", name: "Fees Received in Advance", normalBalance: "CREDIT" as const },
      { code: "2500", name: "Government Subsidy Payable", normalBalance: "CREDIT" as const },
    ]},
    { name: "Equity", type: "EQUITY" as const, sortOrder: 3, accounts: [
      { code: "3000", name: "School Fund Balance", normalBalance: "CREDIT" as const },
      { code: "3100", name: "Retained Surplus", normalBalance: "CREDIT" as const },
    ]},
    { name: "Revenue", type: "REVENUE" as const, sortOrder: 4, accounts: [
      { code: "4000", name: "Tuition Fees", normalBalance: "CREDIT" as const },
      { code: "4010", name: "Boarding Fees", normalBalance: "CREDIT" as const },
      { code: "4020", name: "PTA Dues", normalBalance: "CREDIT" as const },
      { code: "4030", name: "Examination Fees", normalBalance: "CREDIT" as const },
      { code: "4040", name: "Extracurricular Fees", normalBalance: "CREDIT" as const },
      { code: "4100", name: "Government Subsidies - Free SHS", normalBalance: "CREDIT" as const },
      { code: "4110", name: "Capitation Grants", normalBalance: "CREDIT" as const },
      { code: "4200", name: "Donations & Grants", normalBalance: "CREDIT" as const },
      { code: "4300", name: "Interest Income", normalBalance: "CREDIT" as const },
      { code: "4900", name: "Other Income", normalBalance: "CREDIT" as const },
    ]},
    { name: "Expenses", type: "EXPENSE" as const, sortOrder: 5, accounts: [
      { code: "5000", name: "Salaries & Wages", normalBalance: "DEBIT" as const },
      { code: "5010", name: "SSNIT Contributions", normalBalance: "DEBIT" as const },
      { code: "5100", name: "Teaching Materials", normalBalance: "DEBIT" as const },
      { code: "5110", name: "Laboratory Supplies", normalBalance: "DEBIT" as const },
      { code: "5200", name: "Utilities - Electricity", normalBalance: "DEBIT" as const },
      { code: "5210", name: "Utilities - Water", normalBalance: "DEBIT" as const },
      { code: "5300", name: "Feeding & Catering", normalBalance: "DEBIT" as const },
      { code: "5400", name: "Maintenance & Repairs", normalBalance: "DEBIT" as const },
      { code: "5500", name: "Transport", normalBalance: "DEBIT" as const },
      { code: "5600", name: "Stationery & Office Supplies", normalBalance: "DEBIT" as const },
      { code: "5700", name: "Depreciation Expense", normalBalance: "DEBIT" as const },
      { code: "5800", name: "Insurance", normalBalance: "DEBIT" as const },
      { code: "5900", name: "Bank Charges", normalBalance: "DEBIT" as const },
      { code: "5950", name: "Miscellaneous Expenses", normalBalance: "DEBIT" as const },
    ]},
  ];

  await db.$transaction(async (tx) => {
    for (const cat of defaultCoA) {
      const category = await tx.accountCategory.create({
        data: { schoolId: ctx.schoolId, name: cat.name, type: cat.type, sortOrder: cat.sortOrder },
      });
      for (const acc of cat.accounts) {
        await tx.account.create({
          data: { schoolId: ctx.schoolId, categoryId: category.id, code: acc.code, name: acc.name, normalBalance: acc.normalBalance, isSystemAccount: true },
        });
      }
    }
  });

  await audit({ userId: ctx.session.user.id, action: "CREATE", entity: "Account", entityId: ctx.schoolId, module: "accounting", description: "Seeded default Ghana-standard Chart of Accounts" });

  return { data: { success: true, message: "Default Chart of Accounts created with Ghana-standard accounts" } };
}
