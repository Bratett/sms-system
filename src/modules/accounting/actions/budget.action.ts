"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  createBudgetSchema,
  type CreateBudgetInput,
} from "@/modules/accounting/schemas/budget.schema";

export async function getBudgetsAction(filters?: { academicYearId?: string; status?: string }) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const where: Record<string, unknown> = { schoolId: school.id };
  if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters?.status) where.status = filters.status;

  const budgets = await db.budget.findMany({
    where,
    include: {
      lines: { include: { expenseCategory: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const ayIds = [...new Set(budgets.map((b) => b.academicYearId))];
  const termIds = budgets.map((b) => b.termId).filter(Boolean) as string[];
  const [academicYears, terms] = await Promise.all([
    db.academicYear.findMany({ where: { id: { in: ayIds } }, select: { id: true, name: true } }),
    termIds.length > 0 ? db.term.findMany({ where: { id: { in: termIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const ayMap = new Map(academicYears.map((ay) => [ay.id, ay.name]));
  const termMap = new Map(terms.map((t) => [t.id, t.name]));

  const data = budgets.map((b) => {
    const totalAllocated = b.lines.reduce((sum, l) => sum + l.allocatedAmount, 0);
    const totalSpent = b.lines.reduce((sum, l) => sum + l.spentAmount, 0);
    return {
      ...b,
      academicYearName: ayMap.get(b.academicYearId) ?? "Unknown",
      termName: b.termId ? termMap.get(b.termId) ?? null : null,
      totalAllocated,
      totalSpent,
      utilization: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0,
    };
  });

  return { data };
}

export async function createBudgetAction(data: CreateBudgetInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createBudgetSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const totalAmount = parsed.data.lines.reduce((sum, l) => sum + l.allocatedAmount, 0);

  const budget = await db.$transaction(async (tx) => {
    const created = await tx.budget.create({
      data: {
        schoolId: school.id,
        name: parsed.data.name,
        academicYearId: parsed.data.academicYearId,
        termId: parsed.data.termId,
        totalAmount,
        createdBy: session.user.id!,
      },
    });

    await tx.budgetLine.createMany({
      data: parsed.data.lines.map((l) => ({
        budgetId: created.id,
        expenseCategoryId: l.expenseCategoryId,
        departmentId: l.departmentId,
        allocatedAmount: l.allocatedAmount,
        description: l.description,
      })),
    });

    return created;
  });

  await audit({ userId: session.user.id!, action: "CREATE", entity: "Budget", entityId: budget.id, module: "accounting", description: `Created budget "${parsed.data.name}" (GHS ${totalAmount})` });

  return { data: budget };
}

export async function approveBudgetAction(budgetId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const budget = await db.budget.findUnique({ where: { id: budgetId } });
  if (!budget) return { error: "Budget not found" };
  if (budget.status !== "DRAFT") return { error: "Only draft budgets can be approved" };

  await db.budget.update({
    where: { id: budgetId },
    data: { status: "ACTIVE", approvedBy: session.user.id!, approvedAt: new Date() },
  });

  await audit({ userId: session.user.id!, action: "UPDATE", entity: "Budget", entityId: budgetId, module: "accounting", description: `Approved budget "${budget.name}"` });

  return { data: { success: true } };
}

export async function getBudgetVsActualAction(budgetId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const budget = await db.budget.findUnique({
    where: { id: budgetId },
    include: {
      lines: { include: { expenseCategory: { select: { name: true, code: true } } } },
    },
  });
  if (!budget) return { error: "Budget not found" };

  const data = budget.lines.map((line) => ({
    category: line.expenseCategory.name,
    categoryCode: line.expenseCategory.code,
    allocated: line.allocatedAmount,
    spent: line.spentAmount,
    remaining: line.allocatedAmount - line.spentAmount,
    utilization: line.allocatedAmount > 0 ? (line.spentAmount / line.allocatedAmount) * 100 : 0,
    variance: line.allocatedAmount - line.spentAmount,
    isOverBudget: line.spentAmount > line.allocatedAmount,
  }));

  return {
    data: {
      budget: { id: budget.id, name: budget.name, totalAmount: budget.totalAmount, status: budget.status },
      lines: data,
      totalAllocated: data.reduce((sum, l) => sum + l.allocated, 0),
      totalSpent: data.reduce((sum, l) => sum + l.spent, 0),
    },
  };
}
