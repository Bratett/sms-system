"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import {
  createExpenseSchema,
  createExpenseCategorySchema,
  type CreateExpenseInput,
  type CreateExpenseCategoryInput,
} from "@/modules/accounting/schemas/expense.schema";

export async function getExpenseCategoriesAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const categories = await db.expenseCategory.findMany({
    where: { schoolId: school.id, parentId: null },
    include: { children: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  return { data: categories };
}

export async function createExpenseCategoryAction(data: CreateExpenseCategoryInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createExpenseCategorySchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const category = await db.expenseCategory.create({
    data: { schoolId: school.id, ...parsed.data },
  });

  return { data: category };
}

export async function getExpensesAction(filters?: {
  status?: string;
  expenseCategoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: school.id };
  if (filters?.status) where.status = filters.status;
  if (filters?.expenseCategoryId) where.expenseCategoryId = filters.expenseCategoryId;
  if (filters?.dateFrom || filters?.dateTo) {
    where.date = {};
    if (filters?.dateFrom) (where.date as Record<string, unknown>).gte = new Date(filters.dateFrom);
    if (filters?.dateTo) (where.date as Record<string, unknown>).lte = new Date(filters.dateTo);
  }

  const [expenses, total] = await Promise.all([
    db.expense.findMany({
      where,
      include: { expenseCategory: { select: { name: true, code: true } } },
      orderBy: { date: "desc" },
      skip,
      take: pageSize,
    }),
    db.expense.count({ where }),
  ]);

  const userIds = [...new Set([...expenses.map((e) => e.submittedBy), ...expenses.map((e) => e.approvedBy).filter(Boolean) as string[]])];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } });
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = expenses.map((e) => ({
    ...e,
    categoryName: e.expenseCategory.name,
    submittedByName: userMap.get(e.submittedBy) ?? "Unknown",
    approvedByName: e.approvedBy ? userMap.get(e.approvedBy) ?? null : null,
  }));

  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function createExpenseAction(data: CreateExpenseInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createExpenseSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const expense = await db.expense.create({
    data: { schoolId: school.id, submittedBy: session.user.id!, ...parsed.data },
  });

  await audit({ userId: session.user.id!, action: "CREATE", entity: "Expense", entityId: expense.id, module: "accounting", description: `Created expense "${parsed.data.description}" (GHS ${parsed.data.amount})` });

  return { data: expense };
}

export async function approveExpenseAction(expenseId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const expense = await db.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return { error: "Expense not found" };
  if (expense.status !== "PENDING") return { error: "Only pending expenses can be approved" };

  await db.expense.update({
    where: { id: expenseId },
    data: { status: "APPROVED", approvedBy: session.user.id!, approvedAt: new Date() },
  });

  await audit({ userId: session.user.id!, action: "UPDATE", entity: "Expense", entityId: expenseId, module: "accounting", description: `Approved expense (GHS ${expense.amount})` });

  return { data: { success: true } };
}

export async function rejectExpenseAction(expenseId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const expense = await db.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return { error: "Expense not found" };
  if (expense.status !== "PENDING") return { error: "Only pending expenses can be rejected" };

  await db.expense.update({ where: { id: expenseId }, data: { status: "REJECTED" } });

  await audit({ userId: session.user.id!, action: "UPDATE", entity: "Expense", entityId: expenseId, module: "accounting", description: `Rejected expense` });

  return { data: { success: true } };
}

export async function getExpenseSummaryAction(filters?: { termId?: string }) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const where: Record<string, unknown> = { schoolId: school.id, status: { in: ["APPROVED", "PAID"] } };
  if (filters?.termId) where.termId = filters.termId;

  const expenses = await db.expense.findMany({
    where,
    include: { expenseCategory: { select: { name: true } } },
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + toNum(e.amount), 0);

  const byCategory = new Map<string, { category: string; total: number; count: number }>();
  for (const e of expenses) {
    const cat = e.expenseCategory.name;
    const entry = byCategory.get(cat) ?? { category: cat, total: 0, count: 0 };
    entry.total += toNum(e.amount);
    entry.count++;
    byCategory.set(cat, entry);
  }

  return {
    data: {
      totalExpenses,
      count: expenses.length,
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.total - a.total),
    },
  };
}
