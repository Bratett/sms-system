"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import {
  generateReportSchema,
  type GenerateReportInput,
} from "@/modules/accounting/schemas/financial-reports.schema";
import { ACCOUNTS } from "@/modules/accounting/lib/account-codes";

const EPS = 0.005;

/**
 * Net ledger balance per account as-of a date. Computed from POSTED journal
 * entries (not live `currentBalance`) so historical statements are reproducible.
 * Returns a map accountId → signed balance on the account's NORMAL side.
 */
async function computeNetBalances(
  schoolId: string,
  periodEnd: Date,
  opts?: { fundId?: string; periodStart?: Date },
): Promise<Map<string, number>> {
  // Include both POSTED and REVERSED journals. A reversal creates a new POSTED
  // counter-entry; the original is flagged REVERSED but its entries persist as
  // an audit trail. Including both lets them cancel correctly; excluding one
  // while including the other would leave the report out of sync with the
  // live Account.currentBalance and with Σdebits=Σcredits.
  const entries = await db.journalEntry.findMany({
    where: {
      schoolId,
      ...(opts?.fundId ? { fundId: opts.fundId } : {}),
      journalTransaction: {
        status: { in: ["POSTED", "REVERSED"] },
        date: {
          ...(opts?.periodStart ? { gte: opts.periodStart } : {}),
          lte: periodEnd,
        },
      },
    },
    select: { accountId: true, side: true, amount: true },
  });

  const accounts = await db.account.findMany({
    where: { schoolId },
    select: { id: true, normalBalance: true },
  });
  const normalBySide = new Map(accounts.map((a) => [a.id, a.normalBalance]));

  const net = new Map<string, number>();
  for (const e of entries) {
    const normal = normalBySide.get(e.accountId);
    if (!normal) continue;
    const delta = e.side === normal ? toNum(e.amount) : -toNum(e.amount);
    net.set(e.accountId, (net.get(e.accountId) ?? 0) + delta);
  }
  return net;
}

export async function generateTrialBalanceAction(periodEnd: Date, opts?: { fundId?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.FINANCIAL_STATEMENTS_GENERATE);
  if (permErr) return permErr;

  const accounts = await db.account.findMany({
    where: { schoolId: ctx.schoolId, isActive: true },
    include: { category: { select: { name: true, type: true } } },
    orderBy: { code: "asc" },
  });

  const net = await computeNetBalances(ctx.schoolId, periodEnd, opts);

  let totalDebits = 0;
  let totalCredits = 0;
  const lines = accounts
    .filter((acc) => acc.category.type !== "BUDGETARY") // exclude encumbrance accounts from proprietary TB
    .map((acc) => {
      const balance = net.get(acc.id) ?? 0;
      // Positive balance = shown on its normal side; negative = shown on opposite side
      const onNormal = Math.max(balance, 0);
      const onOpposite = Math.max(-balance, 0);
      const debit = acc.normalBalance === "DEBIT" ? onNormal : onOpposite;
      const credit = acc.normalBalance === "CREDIT" ? onNormal : onOpposite;
      totalDebits += debit;
      totalCredits += credit;
      return {
        accountCode: acc.code,
        accountName: acc.name,
        categoryName: acc.category.name,
        categoryType: acc.category.type,
        normalBalance: acc.normalBalance,
        debit,
        credit,
      };
    });

  return {
    data: {
      asOf: periodEnd,
      lines,
      totalDebits,
      totalCredits,
      difference: totalDebits - totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < EPS,
    },
  };
}

/**
 * Statement of Financial Position (IPSAS 1 — same data model as Balance Sheet).
 */
export async function generateBalanceSheetAction(periodEnd: Date, opts?: { fundId?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.FINANCIAL_STATEMENTS_GENERATE);
  if (permErr) return permErr;

  const accounts = await db.account.findMany({
    where: { schoolId: ctx.schoolId, isActive: true },
    include: { category: { select: { name: true, type: true } } },
    orderBy: { code: "asc" },
  });

  const net = await computeNetBalances(ctx.schoolId, periodEnd, opts);

  const signed = (acc: (typeof accounts)[number]): number => {
    const bal = net.get(acc.id) ?? 0;
    return acc.isContra ? -bal : bal;
  };

  const assets = accounts.filter((a) => a.category.type === "ASSET");
  const liabilities = accounts.filter((a) => a.category.type === "LIABILITY");
  const equity = accounts.filter((a) => a.category.type === "EQUITY");
  const revenue = accounts.filter((a) => a.category.type === "REVENUE");
  const expenses = accounts.filter((a) => a.category.type === "EXPENSE");

  const totalAssets = assets.reduce((s, a) => s + signed(a), 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + (net.get(a.id) ?? 0), 0);
  // Exclude Income Summary (3900) from the main equity list — it should be zero except during close
  const equityReal = equity.filter((a) => a.code !== ACCOUNTS.INCOME_SUMMARY);
  const totalEquityPosted = equityReal.reduce((s, a) => s + (net.get(a.id) ?? 0), 0);

  // Surplus/Deficit for the period (accumulates in Equity when closing entries run)
  const totalRevenue = revenue.reduce((s, a) => s + (net.get(a.id) ?? 0), 0);
  const totalExpenses = expenses.reduce((s, a) => s + (net.get(a.id) ?? 0), 0);
  const currentSurplus = totalRevenue - totalExpenses;

  const mapAccounts = (accs: typeof accounts) =>
    accs
      .map((a) => ({ code: a.code, name: a.name, balance: signed(a), isContra: a.isContra }))
      .filter((a) => Math.abs(a.balance) > EPS);

  const totalNetAssets = totalEquityPosted + currentSurplus;
  const totalLiabAndEquity = totalLiabilities + totalNetAssets;

  return {
    data: {
      asOf: periodEnd,
      assets: { accounts: mapAccounts(assets), total: totalAssets },
      liabilities: { accounts: mapAccounts(liabilities), total: totalLiabilities },
      netAssets: {
        accounts: mapAccounts(equityReal),
        postedBalance: totalEquityPosted,
        currentPeriodSurplus: currentSurplus,
        total: totalNetAssets,
      },
      totalLiabilitiesAndEquity: totalLiabAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabAndEquity) < EPS,
    },
  };
}

/**
 * Statement of Financial Performance (IPSAS 1 — same as Income Statement).
 */
export async function generateIncomeStatementAction(periodStart: Date, periodEnd: Date, opts?: { fundId?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.FINANCIAL_STATEMENTS_GENERATE);
  if (permErr) return permErr;

  const net = await computeNetBalances(ctx.schoolId, periodEnd, { ...opts, periodStart });

  const accounts = await db.account.findMany({
    where: { schoolId: ctx.schoolId, isActive: true, category: { type: { in: ["REVENUE", "EXPENSE"] } } },
    include: { category: { select: { type: true } } },
    orderBy: { code: "asc" },
  });

  const revenueLines = accounts
    .filter((a) => a.category.type === "REVENUE")
    .map((a) => ({ code: a.code, name: a.name, total: net.get(a.id) ?? 0 }))
    .filter((l) => Math.abs(l.total) > EPS);

  const expenseLines = accounts
    .filter((a) => a.category.type === "EXPENSE")
    .map((a) => ({ code: a.code, name: a.name, total: net.get(a.id) ?? 0 }))
    .filter((l) => Math.abs(l.total) > EPS);

  const totalRevenue = revenueLines.reduce((s, r) => s + r.total, 0);
  const totalExpenses = expenseLines.reduce((s, e) => s + e.total, 0);

  return {
    data: {
      periodStart,
      periodEnd,
      revenue: { lines: revenueLines, total: totalRevenue },
      expenses: { lines: expenseLines, total: totalExpenses },
      surplus: totalRevenue - totalExpenses,
      surplusMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
    },
  };
}

/**
 * Cash Flow Statement — direct method (IPSAS 2 preferred).
 *
 * Walks every journal line involving a Cash/Bank/MoMo account in the period and
 * classifies the movement by the counterparty account type:
 *   - Counterparty REVENUE/EXPENSE/AR/AP → Operating
 *   - Counterparty PPE/Investment → Investing
 *   - Counterparty EQUITY/Long-term Liability → Financing
 */
export async function generateCashFlowAction(periodStart: Date, periodEnd: Date, opts?: { fundId?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.FINANCIAL_STATEMENTS_GENERATE);
  if (permErr) return permErr;

  const CASH_CODES = new Set([
    ACCOUNTS.CASH_ON_HAND,
    ACCOUNTS.BANK_GCB,
    ACCOUNTS.BANK_ECOBANK,
    ACCOUNTS.BANK_STANBIC,
    ACCOUNTS.MOMO_MTN,
    ACCOUNTS.MOMO_VODAFONE,
    ACCOUNTS.MOMO_AIRTELTIGO,
    ACCOUNTS.PETTY_CASH,
  ]);

  const cashAccounts = await db.account.findMany({
    where: { schoolId: ctx.schoolId, code: { in: Array.from(CASH_CODES) } },
    select: { id: true, code: true, name: true },
  });
  const cashIds = new Set(cashAccounts.map((a) => a.id));

  // Pull all journal transactions in the period that touch a cash account.
  // Include POSTED + REVERSED so reversed cash flows + their counter-entries
  // both contribute and net to zero, matching currentBalance.
  const transactions = await db.journalTransaction.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: { in: ["POSTED", "REVERSED"] },
      date: { gte: periodStart, lte: periodEnd },
      entries: { some: { accountId: { in: Array.from(cashIds) }, ...(opts?.fundId ? { fundId: opts.fundId } : {}) } },
    },
    include: {
      entries: { include: { account: { include: { category: { select: { type: true } } } } } },
    },
  });

  type Bucket = { inflows: number; outflows: number; lines: Array<{ date: Date; description: string; amount: number; direction: "IN" | "OUT"; account: string }> };
  const operating: Bucket = { inflows: 0, outflows: 0, lines: [] };
  const investing: Bucket = { inflows: 0, outflows: 0, lines: [] };
  const financing: Bucket = { inflows: 0, outflows: 0, lines: [] };

  for (const txn of transactions) {
    const cashLines = txn.entries.filter((e) => cashIds.has(e.accountId));
    const nonCashLines = txn.entries.filter((e) => !cashIds.has(e.accountId));
    if (nonCashLines.length === 0) continue;

    // Classify by dominant non-cash account type (first non-cash line is usually representative)
    const refType = txn.referenceType?.toLowerCase() ?? "";
    const nonCashType = nonCashLines[0]?.account.category.type;
    const nonCashCode = nonCashLines[0]?.account.code ?? "";

    let bucket: Bucket = operating;
    if (refType.includes("encumbrance") || refType.includes("ppe") || nonCashType === "ASSET" && (nonCashCode.startsWith("17") || nonCashCode.startsWith("12"))) {
      bucket = investing;
    } else if (nonCashType === "EQUITY" || (nonCashType === "LIABILITY" && nonCashCode.startsWith("28"))) {
      bucket = financing;
    }

    for (const cashLine of cashLines) {
      const amt = toNum(cashLine.amount);
      if (cashLine.side === "DEBIT") {
        bucket.inflows += amt;
        bucket.lines.push({ date: txn.date, description: txn.description, amount: amt, direction: "IN", account: cashLine.account.code });
      } else {
        bucket.outflows += amt;
        bucket.lines.push({ date: txn.date, description: txn.description, amount: amt, direction: "OUT", account: cashLine.account.code });
      }
    }
  }

  const netOperating = operating.inflows - operating.outflows;
  const netInvesting = investing.inflows - investing.outflows;
  const netFinancing = financing.inflows - financing.outflows;

  return {
    data: {
      periodStart,
      periodEnd,
      method: "direct" as const,
      operating: { inflows: operating.inflows, outflows: operating.outflows, net: netOperating, lines: operating.lines },
      investing: { inflows: investing.inflows, outflows: investing.outflows, net: netInvesting, lines: investing.lines },
      financing: { inflows: financing.inflows, outflows: financing.outflows, net: netFinancing, lines: financing.lines },
      netChange: netOperating + netInvesting + netFinancing,
    },
  };
}

/**
 * Statement of Changes in Net Assets / Equity (IPSAS 1).
 * Opening balance per equity component + surplus + transfers = closing balance.
 */
export async function generateChangesInNetAssetsAction(periodStart: Date, periodEnd: Date) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.FINANCIAL_STATEMENTS_GENERATE);
  if (permErr) return permErr;

  const equity = await db.account.findMany({
    where: { schoolId: ctx.schoolId, category: { type: "EQUITY" }, isActive: true },
    orderBy: { code: "asc" },
  });

  const opening = await computeNetBalances(ctx.schoolId, new Date(periodStart.getTime() - 1));
  const closing = await computeNetBalances(ctx.schoolId, periodEnd);

  // Surplus for the period from Revenue/Expense
  const revenueExpense = await db.account.findMany({
    where: { schoolId: ctx.schoolId, category: { type: { in: ["REVENUE", "EXPENSE"] } } },
    include: { category: { select: { type: true } } },
  });
  const netForPeriod = await computeNetBalances(ctx.schoolId, periodEnd, { periodStart });
  const totalRevenue = revenueExpense.filter((a) => a.category.type === "REVENUE").reduce((s, a) => s + (netForPeriod.get(a.id) ?? 0), 0);
  const totalExpenses = revenueExpense.filter((a) => a.category.type === "EXPENSE").reduce((s, a) => s + (netForPeriod.get(a.id) ?? 0), 0);
  const surplus = totalRevenue - totalExpenses;

  const lines = equity.map((acc) => {
    const o = opening.get(acc.id) ?? 0;
    const c = closing.get(acc.id) ?? 0;
    return {
      code: acc.code,
      name: acc.name,
      opening: o,
      movement: c - o,
      closing: c,
    };
  });

  return {
    data: {
      periodStart,
      periodEnd,
      lines,
      surplus,
      totalOpening: lines.reduce((s, l) => s + l.opening, 0),
      totalClosing: lines.reduce((s, l) => s + l.closing, 0),
    },
  };
}

/**
 * Statement of Comparison of Budget and Actual Amounts (IPSAS 24).
 * Original Budget, Final Budget, Actual, Variance, Variance %.
 */
export async function generateBudgetVsActualAction(budgetId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.FINANCIAL_STATEMENTS_GENERATE);
  if (permErr) return permErr;

  const budget = await db.budget.findUnique({
    where: { id: budgetId },
    include: {
      lines: {
        include: {
          expenseCategory: { select: { name: true, code: true, accountId: true } },
        },
      },
    },
  });
  if (!budget) return { error: "Budget not found" };
  if (budget.schoolId !== ctx.schoolId) return { error: "Access denied" };

  const lines = budget.lines.map((l) => {
    const original = toNum(l.originalAmount) || toNum(l.allocatedAmount);
    const final = toNum(l.allocatedAmount);
    const committed = toNum(l.committedAmount);
    const actual = toNum(l.spentAmount);
    const variance = final - (committed + actual);
    const variancePct = final > 0 ? (variance / final) * 100 : 0;
    return {
      category: l.expenseCategory.name,
      code: l.expenseCategory.code,
      originalBudget: original,
      finalBudget: final,
      committed,
      actual,
      available: variance,
      variance,
      variancePct,
    };
  });

  return {
    data: {
      budgetId: budget.id,
      budgetName: budget.name,
      totalOriginal: lines.reduce((s, l) => s + l.originalBudget, 0),
      totalFinal: lines.reduce((s, l) => s + l.finalBudget, 0),
      totalCommitted: lines.reduce((s, l) => s + l.committed, 0),
      totalActual: lines.reduce((s, l) => s + l.actual, 0),
      totalVariance: lines.reduce((s, l) => s + l.variance, 0),
      lines,
    },
  };
}

/**
 * Receivables Aging Report with expected credit loss (IPSAS 29/41).
 */
export async function generateReceivablesAgingAction(asOfDate: Date = new Date()) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.FINANCIAL_STATEMENTS_GENERATE);
  if (permErr) return permErr;

  // Default ECL rates (percent) per aging bucket — schools should refine based on historical loss experience
  const ECL_RATES = { b0_30: 1, b31_60: 3, b61_90: 10, b91_180: 25, b180_plus: 60 };

  const bills = await db.studentBill.findMany({
    where: {
      schoolId: ctx.schoolId,
      balanceAmount: { gt: 0 },
      status: { in: ["UNPAID", "PARTIAL"] },
    },
    select: {
      id: true,
      studentId: true,
      balanceAmount: true,
      dueDate: true,
      generatedAt: true,
      termId: true,
    },
  });

  const buckets = { b0_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b180_plus: 0 };
  const details: Array<{ bucket: keyof typeof buckets; billId: string; studentId: string; days: number; amount: number }> = [];

  for (const b of bills) {
    const baseDate = b.dueDate ?? b.generatedAt;
    const days = Math.max(0, Math.floor((asOfDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)));
    const amount = toNum(b.balanceAmount);
    let bucket: keyof typeof buckets;
    if (days <= 30) bucket = "b0_30";
    else if (days <= 60) bucket = "b31_60";
    else if (days <= 90) bucket = "b61_90";
    else if (days <= 180) bucket = "b91_180";
    else bucket = "b180_plus";
    buckets[bucket] += amount;
    details.push({ bucket, billId: b.id, studentId: b.studentId, days, amount });
  }

  const totalReceivables = Object.values(buckets).reduce((s, v) => s + v, 0);
  const ecl = {
    b0_30: (buckets.b0_30 * ECL_RATES.b0_30) / 100,
    b31_60: (buckets.b31_60 * ECL_RATES.b31_60) / 100,
    b61_90: (buckets.b61_90 * ECL_RATES.b61_90) / 100,
    b91_180: (buckets.b91_180 * ECL_RATES.b91_180) / 100,
    b180_plus: (buckets.b180_plus * ECL_RATES.b180_plus) / 100,
  };
  const totalAllowance = Object.values(ecl).reduce((s, v) => s + v, 0);

  return {
    data: {
      asOfDate,
      buckets,
      eclRates: ECL_RATES,
      allowancePerBucket: ecl,
      totalReceivables,
      totalAllowance,
      netReceivables: totalReceivables - totalAllowance,
      billCount: bills.length,
      details,
    },
  };
}

/**
 * Fund Statement — balances and activity per Fund.
 */
export async function generateFundStatementAction(periodStart: Date, periodEnd: Date) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.FINANCIAL_STATEMENTS_GENERATE);
  if (permErr) return permErr;

  const funds = await db.fund.findMany({
    where: { schoolId: ctx.schoolId, isActive: true },
    orderBy: { code: "asc" },
  });

  const fundRows = [];
  for (const fund of funds) {
    const opening = await computeNetBalances(ctx.schoolId, new Date(periodStart.getTime() - 1), { fundId: fund.id });
    const closing = await computeNetBalances(ctx.schoolId, periodEnd, { fundId: fund.id });
    const periodActivity = await computeNetBalances(ctx.schoolId, periodEnd, { fundId: fund.id, periodStart });

    const accounts = await db.account.findMany({
      where: { schoolId: ctx.schoolId },
      include: { category: { select: { type: true } } },
    });
    const revenueForFund = accounts
      .filter((a) => a.category.type === "REVENUE")
      .reduce((s, a) => s + (periodActivity.get(a.id) ?? 0), 0);
    const expensesForFund = accounts
      .filter((a) => a.category.type === "EXPENSE")
      .reduce((s, a) => s + (periodActivity.get(a.id) ?? 0), 0);
    const netAssetsOpening = accounts
      .filter((a) => a.category.type === "EQUITY")
      .reduce((s, a) => s + (opening.get(a.id) ?? 0), 0);
    const netAssetsClosing = accounts
      .filter((a) => a.category.type === "EQUITY")
      .reduce((s, a) => s + (closing.get(a.id) ?? 0), 0);

    fundRows.push({
      fundCode: fund.code,
      fundName: fund.name,
      fundType: fund.type,
      revenue: revenueForFund,
      expenses: expensesForFund,
      surplus: revenueForFund - expensesForFund,
      netAssetsOpening,
      netAssetsClosing,
    });
  }

  return { data: { periodStart, periodEnd, funds: fundRows } };
}

export async function generateBoardSummaryAction(periodStart: Date, periodEnd: Date) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.FINANCIAL_STATEMENTS_GENERATE);
  if (permErr) return permErr;

  const bills = await db.studentBill.findMany({
    where: { schoolId: ctx.schoolId },
  });
  const totalBilled = bills.reduce((sum, b) => sum + toNum(b.totalAmount), 0);
  const totalCollected = bills.reduce((sum, b) => sum + toNum(b.paidAmount), 0);
  const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

  const expenses = await db.expense.findMany({
    where: { schoolId: ctx.schoolId, status: { in: ["APPROVED", "PAID"] }, date: { gte: periodStart, lte: periodEnd } },
  });
  const totalExpenses = expenses.reduce((sum, e) => sum + toNum(e.amount), 0);

  const subsidies = await db.governmentSubsidy.findMany({ where: { schoolId: ctx.schoolId } });
  const subsidyExpected = subsidies.reduce((sum, s) => sum + toNum(s.expectedAmount), 0);
  const subsidyReceived = subsidies.reduce((sum, s) => sum + toNum(s.receivedAmount), 0);

  const activeBudgets = await db.budget.findMany({
    where: { schoolId: ctx.schoolId, status: "ACTIVE" },
    include: { lines: true },
  });
  const budgetAllocated = activeBudgets.reduce((sum, b) => sum + toNum(b.totalAmount), 0);
  const budgetSpent = activeBudgets.reduce((sum, b) => b.lines.reduce((s, l) => s + toNum(l.spentAmount), 0) + sum, 0);
  const budgetCommitted = activeBudgets.reduce((sum, b) => b.lines.reduce((s, l) => s + toNum(l.committedAmount), 0) + sum, 0);

  return {
    data: {
      periodStart,
      periodEnd,
      feeCollection: { billed: totalBilled, collected: totalCollected, outstanding: totalBilled - totalCollected, rate: collectionRate },
      expenses: { total: totalExpenses, count: expenses.length },
      subsidies: { expected: subsidyExpected, received: subsidyReceived, gap: subsidyExpected - subsidyReceived },
      budget: { allocated: budgetAllocated, committed: budgetCommitted, spent: budgetSpent, utilization: budgetAllocated > 0 ? ((budgetSpent + budgetCommitted) / budgetAllocated) * 100 : 0 },
      netPosition: totalCollected + subsidyReceived - totalExpenses,
    },
  };
}

export async function saveFinancialReportAction(input: GenerateReportInput, reportData: unknown) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const parsed = generateReportSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };
  const report = await db.financialReport.create({
    data: {
      schoolId: ctx.schoolId,
      reportType: parsed.data.reportType,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      generatedBy: ctx.session.user.id,
      data: reportData as object,
    },
  });

  await audit({ userId: ctx.session.user.id, action: "CREATE", entity: "FinancialReport", entityId: report.id, module: "accounting", description: `Generated ${parsed.data.reportType} report` });

  return { data: report };
}

export async function getSavedReportsAction(filters?: { reportType?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
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
