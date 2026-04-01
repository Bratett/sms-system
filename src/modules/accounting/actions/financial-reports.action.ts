"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  generateReportSchema,
  type GenerateReportInput,
} from "@/modules/accounting/schemas/financial-reports.schema";

export async function generateTrialBalanceAction(periodEnd: Date) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const accounts = await db.account.findMany({
    where: { schoolId: school.id, isActive: true },
    include: { category: { select: { name: true, type: true } } },
    orderBy: { code: "asc" },
  });

  let totalDebits = 0;
  let totalCredits = 0;

  const lines = accounts.map((acc) => {
    const isDebitNormal = acc.normalBalance === "DEBIT";
    const debitBalance = isDebitNormal && acc.currentBalance > 0 ? acc.currentBalance : (!isDebitNormal && acc.currentBalance < 0 ? Math.abs(acc.currentBalance) : 0);
    const creditBalance = !isDebitNormal && acc.currentBalance >= 0 ? acc.currentBalance : (isDebitNormal && acc.currentBalance < 0 ? Math.abs(acc.currentBalance) : 0);

    totalDebits += debitBalance;
    totalCredits += creditBalance;

    return {
      accountCode: acc.code,
      accountName: acc.name,
      categoryName: acc.category.name,
      categoryType: acc.category.type,
      debit: debitBalance,
      credit: creditBalance,
    };
  });

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return {
    data: {
      asOf: periodEnd,
      lines,
      totalDebits,
      totalCredits,
      difference: totalDebits - totalCredits,
      isBalanced,
    },
  };
}

export async function generateBalanceSheetAction(periodEnd: Date) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const accounts = await db.account.findMany({
    where: { schoolId: school.id, isActive: true },
    include: { category: { select: { name: true, type: true } } },
    orderBy: { code: "asc" },
  });

  const assets = accounts.filter((a) => a.category.type === "ASSET");
  const liabilities = accounts.filter((a) => a.category.type === "LIABILITY");
  const equity = accounts.filter((a) => a.category.type === "EQUITY");

  const totalAssets = assets.reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);
  const totalEquity = equity.reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);

  // Calculate net income for the period (Revenue - Expenses)
  const revenue = accounts.filter((a) => a.category.type === "REVENUE");
  const expenses = accounts.filter((a) => a.category.type === "EXPENSE");
  const totalRevenue = revenue.reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);
  const totalExpenses = expenses.reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);
  const netIncome = totalRevenue - totalExpenses;

  const mapAccounts = (accs: typeof accounts) =>
    accs.map((a) => ({ code: a.code, name: a.name, balance: Math.abs(a.currentBalance) }));

  return {
    data: {
      asOf: periodEnd,
      assets: { accounts: mapAccounts(assets), total: totalAssets },
      liabilities: { accounts: mapAccounts(liabilities), total: totalLiabilities },
      equity: { accounts: mapAccounts(equity), total: totalEquity, netIncome },
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity + netIncome,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncome)) < 0.01,
    },
  };
}

export async function generateIncomeStatementAction(periodStart: Date, periodEnd: Date) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  // Get journal entries for the period
  const entries = await db.journalEntry.findMany({
    where: {
      journalTransaction: {
        schoolId: school.id,
        status: "POSTED",
        date: { gte: periodStart, lte: periodEnd },
      },
    },
    include: {
      debitAccount: { include: { category: { select: { type: true } } } },
      creditAccount: { include: { category: { select: { type: true } } } },
    },
  });

  // Aggregate by account for revenue and expense accounts
  const accountTotals = new Map<string, { code: string; name: string; type: string; total: number }>();

  for (const entry of entries) {
    // Credit to revenue account = revenue
    if (entry.creditAccount.category.type === "REVENUE") {
      const key = entry.creditAccountId;
      const existing = accountTotals.get(key) ?? { code: entry.creditAccount.code, name: entry.creditAccount.name, type: "REVENUE", total: 0 };
      existing.total += entry.amount;
      accountTotals.set(key, existing);
    }
    // Debit to expense account = expense
    if (entry.debitAccount.category.type === "EXPENSE") {
      const key = entry.debitAccountId;
      const existing = accountTotals.get(key) ?? { code: entry.debitAccount.code, name: entry.debitAccount.name, type: "EXPENSE", total: 0 };
      existing.total += entry.amount;
      accountTotals.set(key, existing);
    }
  }

  const revenueLines = Array.from(accountTotals.values()).filter((a) => a.type === "REVENUE").sort((a, b) => a.code.localeCompare(b.code));
  const expenseLines = Array.from(accountTotals.values()).filter((a) => a.type === "EXPENSE").sort((a, b) => a.code.localeCompare(b.code));

  const totalRevenue = revenueLines.reduce((sum, r) => sum + r.total, 0);
  const totalExpenses = expenseLines.reduce((sum, e) => sum + e.total, 0);

  return {
    data: {
      periodStart,
      periodEnd,
      revenue: { lines: revenueLines, total: totalRevenue },
      expenses: { lines: expenseLines, total: totalExpenses },
      netIncome: totalRevenue - totalExpenses,
      netIncomeMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
    },
  };
}

export async function generateCashFlowAction(periodStart: Date, periodEnd: Date) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  // Get cash/bank account IDs
  const cashAccounts = await db.account.findMany({
    where: {
      schoolId: school.id,
      code: { in: ["1000", "1010", "1020", "1030"] }, // Cash, Bank accounts
    },
    select: { id: true, code: true, name: true },
  });
  const cashAccountIds = cashAccounts.map((a) => a.id);

  // Get all posted journal entries involving cash accounts
  const entries = await db.journalEntry.findMany({
    where: {
      journalTransaction: {
        schoolId: school.id,
        status: "POSTED",
        date: { gte: periodStart, lte: periodEnd },
      },
      OR: [
        { debitAccountId: { in: cashAccountIds } },
        { creditAccountId: { in: cashAccountIds } },
      ],
    },
    include: {
      journalTransaction: { select: { date: true, description: true, referenceType: true } },
      debitAccount: { include: { category: { select: { type: true } } } },
      creditAccount: { include: { category: { select: { type: true } } } },
    },
  });

  let operatingInflows = 0;
  let operatingOutflows = 0;
  let investingInflows = 0;
  let investingOutflows = 0;

  for (const entry of entries) {
    const isCashDebit = cashAccountIds.includes(entry.debitAccountId);
    const refType = entry.journalTransaction.referenceType?.toLowerCase() ?? "";

    // Classify as operating or investing
    const isInvesting = refType.includes("asset") || refType.includes("depreciation") ||
      entry.debitAccount.category.type === "ASSET" || entry.creditAccount.category.type === "ASSET";

    if (isCashDebit) {
      // Cash coming in
      if (isInvesting) investingInflows += entry.amount;
      else operatingInflows += entry.amount;
    } else {
      // Cash going out
      if (isInvesting) investingOutflows += entry.amount;
      else operatingOutflows += entry.amount;
    }
  }

  const netOperating = operatingInflows - operatingOutflows;
  const netInvesting = investingInflows - investingOutflows;
  const netChange = netOperating + netInvesting;

  return {
    data: {
      periodStart,
      periodEnd,
      operating: { inflows: operatingInflows, outflows: operatingOutflows, net: netOperating },
      investing: { inflows: investingInflows, outflows: investingOutflows, net: netInvesting },
      netChange,
    },
  };
}

export async function generateBoardSummaryAction(periodStart: Date, periodEnd: Date) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  // Fee collection summary
  const bills = await db.studentBill.findMany({
    where: { feeStructure: { schoolId: school.id } },
  });
  const totalBilled = bills.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalCollected = bills.reduce((sum, b) => sum + b.paidAmount, 0);
  const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

  // Expense summary
  const expenses = await db.expense.findMany({
    where: { schoolId: school.id, status: { in: ["APPROVED", "PAID"] }, date: { gte: periodStart, lte: periodEnd } },
  });
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Government subsidies
  const subsidies = await db.governmentSubsidy.findMany({
    where: { schoolId: school.id },
  });
  const subsidyExpected = subsidies.reduce((sum, s) => sum + s.expectedAmount, 0);
  const subsidyReceived = subsidies.reduce((sum, s) => sum + s.receivedAmount, 0);

  // Budget utilization
  const activeBudgets = await db.budget.findMany({
    where: { schoolId: school.id, status: "ACTIVE" },
    include: { lines: true },
  });
  const budgetAllocated = activeBudgets.reduce((sum, b) => sum + b.totalAmount, 0);
  const budgetSpent = activeBudgets.reduce((sum, b) => b.lines.reduce((s, l) => s + l.spentAmount, 0) + sum, 0);

  return {
    data: {
      periodStart,
      periodEnd,
      feeCollection: { billed: totalBilled, collected: totalCollected, outstanding: totalBilled - totalCollected, rate: collectionRate },
      expenses: { total: totalExpenses, count: expenses.length },
      subsidies: { expected: subsidyExpected, received: subsidyReceived, gap: subsidyExpected - subsidyReceived },
      budget: { allocated: budgetAllocated, spent: budgetSpent, utilization: budgetAllocated > 0 ? (budgetSpent / budgetAllocated) * 100 : 0 },
      netPosition: totalCollected + subsidyReceived - totalExpenses,
    },
  };
}

export async function saveFinancialReportAction(input: GenerateReportInput, reportData: unknown) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = generateReportSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const report = await db.financialReport.create({
    data: {
      schoolId: school.id,
      reportType: parsed.data.reportType,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      generatedBy: session.user.id!,
      data: reportData as object,
    },
  });

  await audit({ userId: session.user.id!, action: "CREATE", entity: "FinancialReport", entityId: report.id, module: "accounting", description: `Generated ${parsed.data.reportType} report` });

  return { data: report };
}

export async function getSavedReportsAction(filters?: { reportType?: string }) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const where: Record<string, unknown> = { schoolId: school.id };
  if (filters?.reportType) where.reportType = filters.reportType;

  const reports = await db.financialReport.findMany({
    where,
    orderBy: { generatedAt: "desc" },
    take: 50,
  });

  const userIds = [...new Set(reports.map((r) => r.generatedBy))];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } });
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = reports.map((r) => ({ ...r, generatedByName: userMap.get(r.generatedBy) ?? "Unknown" }));

  return { data };
}
