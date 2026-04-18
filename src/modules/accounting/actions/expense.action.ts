"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import {
  createExpenseSchema,
  createExpenseCategorySchema,
  type CreateExpenseInput,
  type CreateExpenseCategoryInput,
} from "@/modules/accounting/schemas/expense.schema";
import {
  postJournalTransaction,
  reverseJournalTransaction,
  findAccountByCode,
  LedgerError,
} from "@/modules/accounting/lib/ledger";
import { ACCOUNTS, accountCodeForPaymentMethod, type AccountCode } from "@/modules/accounting/lib/account-codes";

export async function getExpenseCategoriesAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const categories = await db.expenseCategory.findMany({
    where: { schoolId: ctx.schoolId, parentId: null },
    include: { children: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  return { data: categories };
}

export async function createExpenseCategoryAction(data: CreateExpenseCategoryInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const parsed = createExpenseCategorySchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  const category = await db.expenseCategory.create({
    data: { schoolId: ctx.schoolId, ...parsed.data },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "ExpenseCategory",
    entityId: category.id,
    module: "accounting",
    description: `Created expense category ${category.name}`,
    newData: category,
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
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXPENSES_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
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
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXPENSES_CREATE);
  if (denied) return denied;

  const parsed = createExpenseSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  const expense = await db.expense.create({
    data: { schoolId: ctx.schoolId, submittedBy: ctx.session.user.id, ...parsed.data },
  });

  await audit({ userId: ctx.session.user.id, action: "CREATE", entity: "Expense", entityId: expense.id, module: "accounting", description: `Created expense "${parsed.data.description}" (GHS ${parsed.data.amount})` });

  return { data: expense };
}

/**
 * Resolve the Chart-of-Accounts Account to debit for an expense. Priority:
 *   1) ExpenseCategory.accountId if set
 *   2) Ghana COA expense code mapped from category name keyword heuristics
 *   3) Miscellaneous (5990)
 */
async function resolveExpenseAccountId(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  schoolId: string,
  categoryId: string,
): Promise<string | null> {
  const cat = await tx.expenseCategory.findUnique({ where: { id: categoryId }, select: { name: true, accountId: true } });
  if (!cat) return null;
  if (cat.accountId) {
    const acc = await tx.account.findUnique({ where: { id: cat.accountId }, select: { id: true } });
    if (acc) return acc.id;
  }
  const n = cat.name.toLowerCase();
  let code: AccountCode = ACCOUNTS.EXPENSE_MISC;
  if (n.includes("salary") || n.includes("wage") || n.includes("payroll")) code = ACCOUNTS.EXPENSE_SALARIES;
  else if (n.includes("ssnit")) code = ACCOUNTS.EXPENSE_SSNIT_EMPLOYER;
  else if (n.includes("train")) code = ACCOUNTS.EXPENSE_TRAINING;
  else if (n.includes("electric") || n.includes("power")) code = ACCOUNTS.EXPENSE_UTILITIES_ELECTRICITY;
  else if (n.includes("water")) code = ACCOUNTS.EXPENSE_UTILITIES_WATER;
  else if (n.includes("internet") || n.includes("telephone") || n.includes("comms")) code = ACCOUNTS.EXPENSE_UTILITIES_INTERNET;
  else if (n.includes("suppl") || n.includes("material")) code = ACCOUNTS.EXPENSE_SUPPLIES;
  else if (n.includes("repair") || n.includes("maintenan")) code = ACCOUNTS.EXPENSE_REPAIRS;
  else if (n.includes("transport") || n.includes("fuel") || n.includes("vehicle")) code = ACCOUNTS.EXPENSE_TRANSPORT;
  else if (n.includes("feed") || n.includes("cater")) code = ACCOUNTS.EXPENSE_FEEDING;
  else if (n.includes("station") || n.includes("print")) code = ACCOUNTS.EXPENSE_STATIONERY;
  else if (n.includes("insuran")) code = ACCOUNTS.EXPENSE_INSURANCE;
  else if (n.includes("bank")) code = ACCOUNTS.EXPENSE_BANK_CHARGES;
  else if (n.includes("depreciat")) code = ACCOUNTS.EXPENSE_DEPRECIATION;
  const acc = await findAccountByCode(tx, schoolId, code);
  return acc?.id ?? null;
}

/**
 * Approve expense — posts accrual journal: Dr Expense / Cr Accounts Payable.
 * If the expense liquidates a Budget Commitment, the encumbrance is reversed first.
 */
export async function approveExpenseAction(expenseId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXPENSES_APPROVE);
  if (denied) return denied;

  const expense = await db.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return { error: "Expense not found" };
  if (expense.schoolId !== ctx.schoolId) return { error: "Access denied" };
  if (expense.status !== "PENDING") return { error: "Only pending expenses can be approved" };

  try {
    await db.$transaction(async (tx) => {
      // If the expense liquidates a budget commitment, reverse the encumbrance journal first
      if (expense.budgetCommitmentId) {
        const commitment = await tx.budgetCommitment.findUnique({
          where: { id: expense.budgetCommitmentId },
          include: { encumbrances: { where: { status: "ACTIVE" } } },
        });
        if (commitment?.encumbrances[0]?.journalTransactionId) {
          await reverseJournalTransaction(tx, commitment.encumbrances[0].journalTransactionId, {
            schoolId: ctx.schoolId,
            reversedBy: ctx.session.user.id,
            description: `Encumbrance liquidated by expense ${expenseId.slice(-8)}`,
          });
          await tx.encumbrance.update({
            where: { id: commitment.encumbrances[0].id },
            data: { status: "LIQUIDATED", liquidatedAt: new Date(), liquidationJournalId: null },
          });
          const newLiquidated = toNum(commitment.liquidatedAmount) + toNum(expense.amount);
          const isFull = newLiquidated >= toNum(commitment.totalAmount);
          await tx.budgetCommitment.update({
            where: { id: commitment.id },
            data: {
              liquidatedAmount: newLiquidated,
              status: isFull ? "LIQUIDATED" : "PARTIALLY_LIQUIDATED",
              fulfilledAt: isFull ? new Date() : null,
            },
          });
          if (commitment.budgetLineId) {
            await tx.budgetLine.update({
              where: { id: commitment.budgetLineId },
              data: { committedAmount: { decrement: expense.amount } },
            });
          }
        }
      }

      const expenseAccountId = await resolveExpenseAccountId(tx, ctx.schoolId, expense.expenseCategoryId);
      const ap = await findAccountByCode(tx, ctx.schoolId, ACCOUNTS.ACCOUNTS_PAYABLE);
      let accrualJournalId: string | null = null;
      if (expenseAccountId && ap) {
        const posted = await postJournalTransaction(tx, {
          schoolId: ctx.schoolId,
          date: expense.date,
          description: `Expense approved — ${expense.description}`,
          referenceType: "Expense",
          referenceId: expense.id,
          createdBy: ctx.session.user.id,
          isAutoGenerated: true,
          lines: [
            { accountId: expenseAccountId, side: "DEBIT", amount: toNum(expense.amount), narration: expense.description, fundId: expense.fundId ?? undefined },
            { accountId: ap.id, side: "CREDIT", amount: toNum(expense.amount), narration: expense.payee ?? expense.description, fundId: expense.fundId ?? undefined },
          ],
        });
        accrualJournalId = posted.journalTransactionId;
      }

      await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: "APPROVED",
          approvedBy: ctx.session.user.id,
          approvedAt: new Date(),
          accrualJournalId,
        },
      });

      // Update BudgetLine.spentAmount for budget-vs-actual reports
      const line = await tx.budgetLine.findFirst({
        where: { schoolId: ctx.schoolId, expenseCategoryId: expense.expenseCategoryId, budget: { status: { in: ["APPROVED", "ACTIVE"] } } },
      });
      if (line) {
        await tx.budgetLine.update({
          where: { id: line.id },
          data: { spentAmount: { increment: expense.amount } },
        });
      }
    });

    await audit({ userId: ctx.session.user.id, action: "UPDATE", entity: "Expense", entityId: expenseId, module: "accounting", description: `Approved expense (GHS ${expense.amount})` });
    return { data: { success: true } };
  } catch (err) {
    if (err instanceof LedgerError) return { error: `Ledger posting failed: ${err.message}` };
    throw err;
  }
}

/**
 * Mark expense paid — posts: Dr Accounts Payable / Cr Cash/Bank (by payment method).
 */
export async function markExpensePaidAction(expenseId: string, paymentMethod: "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "CHEQUE") {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXPENSES_APPROVE);
  if (denied) return denied;

  const expense = await db.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return { error: "Expense not found" };
  if (expense.schoolId !== ctx.schoolId) return { error: "Access denied" };
  if (expense.status !== "APPROVED") return { error: "Only APPROVED expenses can be paid" };

  try {
    await db.$transaction(async (tx) => {
      const ap = await findAccountByCode(tx, ctx.schoolId, ACCOUNTS.ACCOUNTS_PAYABLE);
      const cashCode = accountCodeForPaymentMethod(paymentMethod);
      const cash = await findAccountByCode(tx, ctx.schoolId, cashCode);
      let paymentJournalId: string | null = null;
      if (ap && cash) {
        const posted = await postJournalTransaction(tx, {
          schoolId: ctx.schoolId,
          date: new Date(),
          description: `Expense paid — ${expense.description}`,
          referenceType: "ExpensePayment",
          referenceId: expense.id,
          createdBy: ctx.session.user.id,
          isAutoGenerated: true,
          lines: [
            { accountId: ap.id, side: "DEBIT", amount: toNum(expense.amount), narration: expense.payee ?? expense.description, fundId: expense.fundId ?? undefined },
            { accountId: cash.id, side: "CREDIT", amount: toNum(expense.amount), narration: `Payment via ${paymentMethod}`, fundId: expense.fundId ?? undefined },
          ],
        });
        paymentJournalId = posted.journalTransactionId;
      }

      await tx.expense.update({
        where: { id: expenseId },
        data: { status: "PAID", paidAt: new Date(), paymentMethod, paymentJournalId },
      });
    });

    await audit({ userId: ctx.session.user.id, action: "UPDATE", entity: "Expense", entityId: expenseId, module: "accounting", description: `Paid expense (GHS ${expense.amount}) via ${paymentMethod}` });
    return { data: { success: true } };
  } catch (err) {
    if (err instanceof LedgerError) return { error: `Ledger posting failed: ${err.message}` };
    throw err;
  }
}

export async function rejectExpenseAction(expenseId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXPENSES_APPROVE);
  if (denied) return denied;

  const expense = await db.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return { error: "Expense not found" };
  if (expense.status !== "PENDING") return { error: "Only pending expenses can be rejected" };

  await db.expense.update({ where: { id: expenseId }, data: { status: "REJECTED" } });

  await audit({ userId: ctx.session.user.id, action: "UPDATE", entity: "Expense", entityId: expenseId, module: "accounting", description: `Rejected expense` });

  return { data: { success: true } };
}

export async function getExpenseSummaryAction(filters?: { termId?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId, status: { in: ["APPROVED", "PAID"] } };
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
