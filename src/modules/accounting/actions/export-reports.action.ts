"use server";

import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { generateExport } from "@/lib/export";
import {
  generateTrialBalanceAction,
  generateBalanceSheetAction,
  generateIncomeStatementAction,
  generateCashFlowAction,
  generateChangesInNetAssetsAction,
  generateBudgetVsActualAction,
  generateReceivablesAgingAction,
  generateFundStatementAction,
} from "./financial-reports.action";
import { getGeneralLedgerAction } from "./journal.action";

type ExportFormat = "xlsx" | "csv";

export async function exportTrialBalanceAction(periodEnd: Date, format: ExportFormat = "xlsx") {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const result = await generateTrialBalanceAction(periodEnd);
  if ("error" in result) return { error: result.error };

  const data = result.data.lines
    .filter((l) => l.debit > 0 || l.credit > 0)
    .map((l) => ({
      accountCode: l.accountCode,
      accountName: l.accountName,
      category: l.categoryName,
      debit: l.debit,
      credit: l.credit,
    }));

  const buffer = generateExport({
    filename: `trial-balance-${new Date(periodEnd).toISOString().split("T")[0]}`,
    format,
    sheetName: "Trial Balance",
    columns: [
      { key: "accountCode", header: "Account Code" },
      { key: "accountName", header: "Account Name" },
      { key: "category", header: "Category" },
      { key: "debit", header: "Debit (GHS)", transform: (v) => Number(v).toFixed(2) },
      { key: "credit", header: "Credit (GHS)", transform: (v) => Number(v).toFixed(2) },
    ],
    data: data as Record<string, unknown>[],
  });

  return { data: { buffer: buffer.toString("base64"), filename: `trial-balance.${format}`, format } };
}

export async function exportBalanceSheetAction(periodEnd: Date, format: ExportFormat = "xlsx") {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const result = await generateBalanceSheetAction(periodEnd);
  if ("error" in result) return { error: result.error };

  const rows: Record<string, unknown>[] = [];

  rows.push({ section: "ASSETS", account: "", code: "", balance: "" });
  for (const a of result.data.assets.accounts) {
    rows.push({ section: "", account: a.name, code: a.code, balance: a.balance });
  }
  rows.push({ section: "", account: "Total Assets", code: "", balance: result.data.assets.total });

  rows.push({ section: "LIABILITIES", account: "", code: "", balance: "" });
  for (const a of result.data.liabilities.accounts) {
    rows.push({ section: "", account: a.name, code: a.code, balance: a.balance });
  }
  rows.push({ section: "", account: "Total Liabilities", code: "", balance: result.data.liabilities.total });

  rows.push({ section: "NET ASSETS / EQUITY", account: "", code: "", balance: "" });
  for (const a of result.data.netAssets.accounts) {
    rows.push({ section: "", account: a.name, code: a.code, balance: a.balance });
  }
  if (result.data.netAssets.currentPeriodSurplus !== 0) {
    rows.push({ section: "", account: "Current Period Surplus / (Deficit)", code: "", balance: result.data.netAssets.currentPeriodSurplus });
  }
  rows.push({ section: "", account: "Total Liabilities & Net Assets", code: "", balance: result.data.totalLiabilitiesAndEquity });

  const buffer = generateExport({
    filename: `balance-sheet-${new Date(periodEnd).toISOString().split("T")[0]}`,
    format,
    sheetName: "Balance Sheet",
    columns: [
      { key: "section", header: "Section" },
      { key: "code", header: "Code" },
      { key: "account", header: "Account" },
      { key: "balance", header: "Balance (GHS)", transform: (v) => v ? Number(v).toFixed(2) : "" },
    ],
    data: rows,
  });

  return { data: { buffer: buffer.toString("base64"), filename: `balance-sheet.${format}`, format } };
}

export async function exportIncomeStatementAction(periodStart: Date, periodEnd: Date, format: ExportFormat = "xlsx") {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const result = await generateIncomeStatementAction(periodStart, periodEnd);
  if ("error" in result) return { error: result.error };

  const rows: Record<string, unknown>[] = [];

  rows.push({ section: "REVENUE", code: "", account: "", amount: "" });
  for (const l of result.data.revenue.lines) {
    rows.push({ section: "", code: l.code, account: l.name, amount: l.total });
  }
  rows.push({ section: "", code: "", account: "Total Revenue", amount: result.data.revenue.total });

  rows.push({ section: "EXPENSES", code: "", account: "", amount: "" });
  for (const l of result.data.expenses.lines) {
    rows.push({ section: "", code: l.code, account: l.name, amount: l.total });
  }
  rows.push({ section: "", code: "", account: "Total Expenses", amount: result.data.expenses.total });

  rows.push({ section: "", code: "", account: `Net ${result.data.surplus >= 0 ? "Surplus" : "Deficit"}`, amount: Math.abs(result.data.surplus) });

  const buffer = generateExport({
    filename: `income-statement`,
    format,
    sheetName: "Income Statement",
    columns: [
      { key: "section", header: "Section" },
      { key: "code", header: "Code" },
      { key: "account", header: "Account" },
      { key: "amount", header: "Amount (GHS)", transform: (v) => v ? Number(v).toFixed(2) : "" },
    ],
    data: rows,
  });

  return { data: { buffer: buffer.toString("base64"), filename: `income-statement.${format}`, format } };
}

export async function exportCashFlowAction(periodStart: Date, periodEnd: Date, format: ExportFormat = "xlsx") {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const result = await generateCashFlowAction(periodStart, periodEnd);
  if ("error" in result) return { error: result.error };

  const rows: Record<string, unknown>[] = [
    { category: "Operating Activities", item: "Inflows", amount: result.data.operating.inflows },
    { category: "", item: "Outflows", amount: -result.data.operating.outflows },
    { category: "", item: "Net Operating", amount: result.data.operating.net },
    { category: "Investing Activities", item: "Inflows", amount: result.data.investing.inflows },
    { category: "", item: "Outflows", amount: -result.data.investing.outflows },
    { category: "", item: "Net Investing", amount: result.data.investing.net },
    { category: "", item: "Net Change in Cash", amount: result.data.netChange },
  ];

  const buffer = generateExport({
    filename: `cash-flow-statement`,
    format,
    sheetName: "Cash Flow",
    columns: [
      { key: "category", header: "Category" },
      { key: "item", header: "Item" },
      { key: "amount", header: "Amount (GHS)", transform: (v) => Number(v).toFixed(2) },
    ],
    data: rows,
  });

  return { data: { buffer: buffer.toString("base64"), filename: `cash-flow.${format}`, format } };
}

export async function exportChangesInNetAssetsAction(periodStart: Date, periodEnd: Date, format: ExportFormat = "xlsx") {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const result = await generateChangesInNetAssetsAction(periodStart, periodEnd);
  if ("error" in result) return { error: result.error };

  const rows = result.data.lines.map((l) => ({
    code: l.code,
    name: l.name,
    opening: l.opening,
    movement: l.movement,
    closing: l.closing,
  }));
  rows.push({ code: "", name: "Surplus/(Deficit) for period", opening: 0, movement: result.data.surplus, closing: 0 });
  rows.push({ code: "", name: "Totals", opening: result.data.totalOpening, movement: result.data.surplus, closing: result.data.totalClosing });

  const buffer = generateExport({
    filename: `changes-in-net-assets-${new Date(periodEnd).toISOString().split("T")[0]}`,
    format,
    sheetName: "Changes in Net Assets",
    columns: [
      { key: "code", header: "Code" },
      { key: "name", header: "Account" },
      { key: "opening", header: "Opening (GHS)", transform: (v) => Number(v).toFixed(2) },
      { key: "movement", header: "Movement (GHS)", transform: (v) => Number(v).toFixed(2) },
      { key: "closing", header: "Closing (GHS)", transform: (v) => Number(v).toFixed(2) },
    ],
    data: rows as Record<string, unknown>[],
  });

  return { data: { buffer: buffer.toString("base64"), filename: `changes-in-net-assets.${format}`, format } };
}

export async function exportBudgetVsActualAction(budgetId: string, format: ExportFormat = "xlsx") {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const result = await generateBudgetVsActualAction(budgetId);
  if ("error" in result) return { error: result.error };

  const rows = result.data.lines.map((l) => ({
    category: l.category,
    original: l.originalBudget,
    final: l.finalBudget,
    committed: l.committed,
    actual: l.actual,
    variance: l.variance,
    variancePct: l.variancePct,
  }));
  rows.push({
    category: "TOTALS",
    original: result.data.totalOriginal,
    final: result.data.totalFinal,
    committed: result.data.totalCommitted,
    actual: result.data.totalActual,
    variance: result.data.totalVariance,
    variancePct: 0,
  });

  const buffer = generateExport({
    filename: `budget-vs-actual-${result.data.budgetName.replace(/\s+/g, "-").toLowerCase()}`,
    format,
    sheetName: "Budget vs Actual (IPSAS 24)",
    columns: [
      { key: "category", header: "Category" },
      { key: "original", header: "Original (GHS)", transform: (v) => Number(v).toFixed(2) },
      { key: "final", header: "Final (GHS)", transform: (v) => Number(v).toFixed(2) },
      { key: "committed", header: "Committed (GHS)", transform: (v) => Number(v).toFixed(2) },
      { key: "actual", header: "Actual (GHS)", transform: (v) => Number(v).toFixed(2) },
      { key: "variance", header: "Variance (GHS)", transform: (v) => Number(v).toFixed(2) },
      { key: "variancePct", header: "Variance %", transform: (v) => `${Number(v).toFixed(1)}%` },
    ],
    data: rows as Record<string, unknown>[],
  });

  return { data: { buffer: buffer.toString("base64"), filename: `budget-vs-actual.${format}`, format } };
}

export async function exportReceivablesAgingAction(asOfDate: Date = new Date(), format: ExportFormat = "xlsx") {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const result = await generateReceivablesAgingAction(asOfDate);
  if ("error" in result) return { error: result.error };

  const bucketLabels: Record<string, string> = {
    b0_30: "0-30 days",
    b31_60: "31-60 days",
    b61_90: "61-90 days",
    b91_180: "91-180 days",
    b180_plus: "180+ days",
  };

  const rows: Record<string, unknown>[] = [];
  for (const key of Object.keys(bucketLabels)) {
    const k = key as keyof typeof result.data.buckets;
    rows.push({
      bucket: bucketLabels[key],
      outstanding: result.data.buckets[k],
      eclRate: `${result.data.eclRates[k]}%`,
      allowance: result.data.allowancePerBucket[k],
    });
  }
  rows.push({
    bucket: `TOTAL (${result.data.billCount} bills)`,
    outstanding: result.data.totalReceivables,
    eclRate: "",
    allowance: result.data.totalAllowance,
  });
  rows.push({
    bucket: "NET RECEIVABLES",
    outstanding: result.data.netReceivables,
    eclRate: "",
    allowance: 0,
  });

  const buffer = generateExport({
    filename: `receivables-aging-${asOfDate.toISOString().split("T")[0]}`,
    format,
    sheetName: "Receivables Aging (IPSAS 29/41)",
    columns: [
      { key: "bucket", header: "Bucket" },
      { key: "outstanding", header: "Outstanding (GHS)", transform: (v) => typeof v === "number" ? v.toFixed(2) : String(v) },
      { key: "eclRate", header: "ECL Rate" },
      { key: "allowance", header: "Allowance (GHS)", transform: (v) => typeof v === "number" ? v.toFixed(2) : String(v) },
    ],
    data: rows,
  });

  return { data: { buffer: buffer.toString("base64"), filename: `receivables-aging.${format}`, format } };
}

export async function exportFundStatementAction(periodStart: Date, periodEnd: Date, format: ExportFormat = "xlsx") {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const result = await generateFundStatementAction(periodStart, periodEnd);
  if ("error" in result) return { error: result.error };

  const rows = result.data.funds.map((f) => ({
    code: f.fundCode,
    name: f.fundName,
    type: f.fundType,
    revenue: f.revenue,
    expenses: f.expenses,
    surplus: f.surplus,
    opening: f.netAssetsOpening,
    closing: f.netAssetsClosing,
  }));

  const buffer = generateExport({
    filename: `fund-statement-${new Date(periodEnd).toISOString().split("T")[0]}`,
    format,
    sheetName: "Fund Statement",
    columns: [
      { key: "code", header: "Code" },
      { key: "name", header: "Fund" },
      { key: "type", header: "Type" },
      { key: "revenue", header: "Revenue (GHS)", transform: (v) => Number(v).toFixed(2) },
      { key: "expenses", header: "Expenses (GHS)", transform: (v) => Number(v).toFixed(2) },
      { key: "surplus", header: "Surplus (GHS)", transform: (v) => Number(v).toFixed(2) },
      { key: "opening", header: "Opening NA (GHS)", transform: (v) => Number(v).toFixed(2) },
      { key: "closing", header: "Closing NA (GHS)", transform: (v) => Number(v).toFixed(2) },
    ],
    data: rows as Record<string, unknown>[],
  });

  return { data: { buffer: buffer.toString("base64"), filename: `fund-statement.${format}`, format } };
}

export async function exportGeneralLedgerAction(
  accountId: string,
  filters: { dateFrom?: string; dateTo?: string; fundId?: string } = {},
  format: ExportFormat = "xlsx",
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const result = await getGeneralLedgerAction(accountId, filters);
  if ("error" in result) return { error: result.error };

  const { account, openingBalance, periodDebits, periodCredits, closingBalance, entries } = result.data;

  const rows: Record<string, unknown>[] = [];
  rows.push({
    date: "",
    journal: "",
    description: "Opening Balance",
    reference: "",
    fund: "",
    debit: "",
    credit: "",
    runningBalance: openingBalance,
    narration: "",
  });
  for (const e of entries) {
    rows.push({
      date: new Date(e.date).toISOString().split("T")[0],
      journal: e.transactionNumber,
      description: e.description,
      reference: e.referenceType ?? "",
      fund: e.fund?.code ?? "",
      debit: e.debit > 0 ? e.debit : "",
      credit: e.credit > 0 ? e.credit : "",
      runningBalance: e.runningBalance,
      narration: e.narration ?? "",
    });
  }
  rows.push({
    date: "",
    journal: "",
    description: "Period Totals",
    reference: "",
    fund: "",
    debit: periodDebits,
    credit: periodCredits,
    runningBalance: "",
    narration: "",
  });
  rows.push({
    date: "",
    journal: "",
    description: "Closing Balance",
    reference: "",
    fund: "",
    debit: "",
    credit: "",
    runningBalance: closingBalance,
    narration: "",
  });

  const dateSuffix = filters.dateTo
    ? new Date(filters.dateTo).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const buffer = generateExport({
    filename: `general-ledger-${account.code}-${dateSuffix}`,
    format,
    sheetName: `GL ${account.code}`,
    columns: [
      { key: "date", header: "Date" },
      { key: "journal", header: "Journal #" },
      { key: "description", header: "Description" },
      { key: "reference", header: "Reference" },
      { key: "fund", header: "Fund" },
      { key: "debit", header: "Debit (GHS)", transform: (v) => (typeof v === "number" ? v.toFixed(2) : String(v ?? "")) },
      { key: "credit", header: "Credit (GHS)", transform: (v) => (typeof v === "number" ? v.toFixed(2) : String(v ?? "")) },
      { key: "runningBalance", header: "Running Balance (GHS)", transform: (v) => (typeof v === "number" ? v.toFixed(2) : String(v ?? "")) },
      { key: "narration", header: "Narration" },
    ],
    data: rows,
  });

  return { data: { buffer: buffer.toString("base64"), filename: `general-ledger-${account.code}.${format}`, format } };
}
