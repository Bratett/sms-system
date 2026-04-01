"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const categories = await db.accountCategory.findMany({
    where: { schoolId: school.id },
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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const where: Record<string, unknown> = { schoolId: school.id };
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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createAccountCategorySchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const category = await db.accountCategory.create({
    data: { schoolId: school.id, ...parsed.data },
  });

  await audit({ userId: session.user.id!, action: "CREATE", entity: "AccountCategory", entityId: category.id, module: "accounting", description: `Created account category "${parsed.data.name}"` });

  return { data: category };
}

export async function createAccountAction(data: CreateAccountInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createAccountSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  // Check unique code
  const existing = await db.account.findUnique({
    where: { schoolId_code: { schoolId: school.id, code: parsed.data.code } },
  });
  if (existing) return { error: `Account code "${parsed.data.code}" already exists` };

  const account = await db.account.create({
    data: { schoolId: school.id, ...parsed.data },
  });

  await audit({ userId: session.user.id!, action: "CREATE", entity: "Account", entityId: account.id, module: "accounting", description: `Created account "${parsed.data.code} - ${parsed.data.name}"` });

  return { data: account };
}

export async function updateAccountAction(accountId: string, data: UpdateAccountInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = updateAccountSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "Account not found" };

  const updated = await db.account.update({ where: { id: accountId }, data: parsed.data });

  await audit({ userId: session.user.id!, action: "UPDATE", entity: "Account", entityId: accountId, module: "accounting", description: `Updated account "${updated.code} - ${updated.name}"` });

  return { data: updated };
}

export async function seedDefaultChartOfAccountsAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  // Check if already seeded
  const existingCategories = await db.accountCategory.count({ where: { schoolId: school.id } });
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
        data: { schoolId: school.id, name: cat.name, type: cat.type, sortOrder: cat.sortOrder },
      });
      for (const acc of cat.accounts) {
        await tx.account.create({
          data: { schoolId: school.id, categoryId: category.id, code: acc.code, name: acc.name, normalBalance: acc.normalBalance, isSystemAccount: true },
        });
      }
    }
  });

  await audit({ userId: session.user.id!, action: "CREATE", entity: "Account", entityId: school.id, module: "accounting", description: "Seeded default Ghana-standard Chart of Accounts" });

  return { data: { success: true, message: "Default Chart of Accounts created with Ghana-standard accounts" } };
}
