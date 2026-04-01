"use server";

import { auth } from "@/lib/auth";
import { generateExport } from "@/lib/export";
import {
  generateTrialBalanceAction,
  generateBalanceSheetAction,
  generateIncomeStatementAction,
  generateCashFlowAction,
} from "./financial-reports.action";

type ExportFormat = "xlsx" | "csv";

export async function exportTrialBalanceAction(periodEnd: Date, format: ExportFormat = "xlsx") {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const result = await generateTrialBalanceAction(periodEnd);
  if (result.error || !result.data) return { error: result.error ?? "Failed to generate report" };

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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const result = await generateBalanceSheetAction(periodEnd);
  if (result.error || !result.data) return { error: result.error ?? "Failed to generate report" };

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

  rows.push({ section: "EQUITY", account: "", code: "", balance: "" });
  for (const a of result.data.equity.accounts) {
    rows.push({ section: "", account: a.name, code: a.code, balance: a.balance });
  }
  if (result.data.equity.netIncome !== 0) {
    rows.push({ section: "", account: "Net Income", code: "", balance: result.data.equity.netIncome });
  }
  rows.push({ section: "", account: "Total Liabilities & Equity", code: "", balance: result.data.totalLiabilitiesAndEquity });

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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const result = await generateIncomeStatementAction(periodStart, periodEnd);
  if (result.error || !result.data) return { error: result.error ?? "Failed to generate report" };

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

  rows.push({ section: "", code: "", account: `Net ${result.data.netIncome >= 0 ? "Surplus" : "Deficit"}`, amount: Math.abs(result.data.netIncome) });

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
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const result = await generateCashFlowAction(periodStart, periodEnd);
  if (result.error || !result.data) return { error: result.error ?? "Failed to generate report" };

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
