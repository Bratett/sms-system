"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  generateTrialBalanceAction,
  generateBalanceSheetAction,
  generateIncomeStatementAction,
  generateCashFlowAction,
  generateBoardSummaryAction,
  generateChangesInNetAssetsAction,
  generateBudgetVsActualAction,
  generateReceivablesAgingAction,
  generateFundStatementAction,
} from "@/modules/accounting/actions/financial-reports.action";
import {
  exportTrialBalanceAction,
  exportBalanceSheetAction,
  exportIncomeStatementAction,
  exportCashFlowAction,
} from "@/modules/accounting/actions/export-reports.action";

type ReportTab =
  | "trial_balance"
  | "balance_sheet"
  | "income_statement"
  | "cash_flow"
  | "changes_in_net_assets"
  | "budget_vs_actual"
  | "receivables_aging"
  | "fund_statement"
  | "board_summary";

import type { Monetary } from "@/lib/monetary";
interface Account { id: string; code: string; name: string; currentBalance: Monetary; category: { name: string; type: string }; }

function formatCurrency(amount: Monetary): string {
  return `GHS ${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Budget { id: string; name: string; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FinancialStatementsClient({ accounts, budgets = [] }: { accounts: Account[]; budgets?: Budget[] }) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<ReportTab>("trial_balance");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reportData, setReportData] = useState<any>(null);
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split("T")[0]);
  const [periodStart, setPeriodStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
  const [budgetId, setBudgetId] = useState<string>(budgets[0]?.id ?? "");

  function handleGenerate() {
    startTransition(async () => {
      let result;
      switch (activeTab) {
        case "trial_balance":
          result = await generateTrialBalanceAction(new Date(periodEnd));
          break;
        case "balance_sheet":
          result = await generateBalanceSheetAction(new Date(periodEnd));
          break;
        case "income_statement":
          result = await generateIncomeStatementAction(new Date(periodStart), new Date(periodEnd));
          break;
        case "cash_flow":
          result = await generateCashFlowAction(new Date(periodStart), new Date(periodEnd));
          break;
        case "changes_in_net_assets":
          result = await generateChangesInNetAssetsAction(new Date(periodStart), new Date(periodEnd));
          break;
        case "budget_vs_actual":
          if (!budgetId) { toast.error("Select a budget first"); return; }
          result = await generateBudgetVsActualAction(budgetId);
          break;
        case "receivables_aging":
          result = await generateReceivablesAgingAction(new Date(periodEnd));
          break;
        case "fund_statement":
          result = await generateFundStatementAction(new Date(periodStart), new Date(periodEnd));
          break;
        case "board_summary":
          result = await generateBoardSummaryAction(new Date(periodStart), new Date(periodEnd));
          break;
      }
      if (result && "error" in result) { toast.error(result.error); return; }
      setReportData(result && "data" in result ? result.data : undefined);
      toast.success("Report generated");
    });
  }

  function handleExportExcel() {
    startTransition(async () => {
      let result;
      switch (activeTab) {
        case "trial_balance":
          result = await exportTrialBalanceAction(new Date(periodEnd));
          break;
        case "balance_sheet":
          result = await exportBalanceSheetAction(new Date(periodEnd));
          break;
        case "income_statement":
          result = await exportIncomeStatementAction(new Date(periodStart), new Date(periodEnd));
          break;
        case "cash_flow":
          result = await exportCashFlowAction(new Date(periodStart), new Date(periodEnd));
          break;
        default:
          return;
      }
      if (!result || "error" in result) { toast.error(("error" in (result ?? {}) ? (result as { error: string }).error : undefined) ?? "Export failed"); return; }

      // Download the file
      const bytes = Uint8Array.from(atob(result.data.buffer), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report exported");
    });
  }

  const tabs: { key: ReportTab; label: string }[] = [
    { key: "trial_balance", label: "Trial Balance" },
    { key: "balance_sheet", label: "Balance Sheet" },
    { key: "income_statement", label: "Income Statement" },
    { key: "cash_flow", label: "Cash Flow" },
    { key: "changes_in_net_assets", label: "Changes in Net Assets" },
    { key: "budget_vs_actual", label: "Budget vs Actual" },
    { key: "receivables_aging", label: "Receivables Aging" },
    { key: "fund_statement", label: "Fund Statement" },
    { key: "board_summary", label: "Board Summary" },
  ];

  const asOfOnly = activeTab === "trial_balance" || activeTab === "balance_sheet" || activeTab === "receivables_aging";
  const needsDateRange = !asOfOnly && activeTab !== "budget_vs_actual";
  const needsBudget = activeTab === "budget_vs_actual";

  return (
    <div className="space-y-6">
      <PageHeader title="Financial Statements" description="Generate standard financial statements for reporting and compliance" />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setReportData(null); }}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${activeTab === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Period Selector + Generate */}
      <div className="flex items-end gap-3 flex-wrap">
        {needsDateRange && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Period Start</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
        )}
        {!needsBudget && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{needsDateRange ? "Period End" : "As of Date"}</label>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
        )}
        {needsBudget && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Budget</label>
            <select value={budgetId} onChange={(e) => setBudgetId(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {budgets.length === 0 ? <option value="">No budgets</option> : budgets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        <button onClick={handleGenerate} disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {isPending ? "Generating..." : "Generate Report"}
        </button>
        {reportData && (activeTab === "trial_balance" || activeTab === "balance_sheet" || activeTab === "income_statement" || activeTab === "cash_flow") && (
          <button onClick={handleExportExcel} disabled={isPending} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
            Export Excel
          </button>
        )}
      </div>

      {/* Report Output */}
      {!reportData ? (
        <EmptyState title="Select a report" description="Choose a report type, set the period, and click Generate." />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 print:border-0 print:shadow-none print:p-0">
          {activeTab === "trial_balance" && <TrialBalanceReport data={reportData} />}
          {activeTab === "balance_sheet" && <BalanceSheetReport data={reportData} />}
          {activeTab === "income_statement" && <IncomeStatementReport data={reportData} />}
          {activeTab === "cash_flow" && <CashFlowReport data={reportData} />}
          {activeTab === "changes_in_net_assets" && <ChangesInNetAssetsReport data={reportData} />}
          {activeTab === "budget_vs_actual" && <BudgetVsActualReport data={reportData} />}
          {activeTab === "receivables_aging" && <ReceivablesAgingReport data={reportData} />}
          {activeTab === "fund_statement" && <FundStatementReport data={reportData} />}
          {activeTab === "board_summary" && <BoardSummaryReport data={reportData} />}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TrialBalanceReport({ data }: { data: any }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-center mb-1">Trial Balance</h2>
      <p className="text-sm text-muted-foreground text-center mb-4">As at {new Date(data.asOf).toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" })}</p>
      <table className="min-w-full divide-y divide-border">
        <thead>
          <tr className="text-left text-xs font-medium uppercase text-muted-foreground">
            <th className="px-4 py-2">Code</th><th className="px-4 py-2">Account</th><th className="px-4 py-2">Category</th><th className="px-4 py-2 text-right">Debit</th><th className="px-4 py-2 text-right">Credit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.lines.filter((l: { debit: number; credit: number }) => l.debit > 0 || l.credit > 0).map((line: { accountCode: string; accountName: string; categoryName: string; debit: number; credit: number }) => (
            <tr key={line.accountCode}>
              <td className="px-4 py-2 text-sm font-mono">{line.accountCode}</td>
              <td className="px-4 py-2 text-sm">{line.accountName}</td>
              <td className="px-4 py-2 text-sm text-muted-foreground">{line.categoryName}</td>
              <td className="px-4 py-2 text-sm text-right">{line.debit > 0 ? formatCurrency(line.debit) : ""}</td>
              <td className="px-4 py-2 text-sm text-right">{line.credit > 0 ? formatCurrency(line.credit) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-bold">
            <td colSpan={3} className="px-4 py-2 text-sm">Totals</td>
            <td className="px-4 py-2 text-sm text-right">{formatCurrency(data.totalDebits)}</td>
            <td className="px-4 py-2 text-sm text-right">{formatCurrency(data.totalCredits)}</td>
          </tr>
        </tfoot>
      </table>
      <p className={`text-sm mt-3 text-center font-medium ${data.isBalanced ? "text-green-600" : "text-red-600"}`}>
        {data.isBalanced ? "Trial balance is balanced" : `Out of balance by ${formatCurrency(Math.abs(data.difference))}`}
      </p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BalanceSheetReport({ data }: { data: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderSection = (title: string, accounts: any[], total: number) => (
    <div className="mb-6">
      <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2">{title}</h3>
      {accounts.map((a: { code: string; name: string; balance: number }) => (
        <div key={a.code} className="flex justify-between text-sm py-1 px-4">
          <span>{a.code} - {a.name}</span><span>{formatCurrency(a.balance)}</span>
        </div>
      ))}
      <div className="flex justify-between text-sm font-bold py-1 px-4 border-t border-border mt-1">
        <span>Total {title}</span><span>{formatCurrency(total)}</span>
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="text-lg font-bold text-center mb-1">Balance Sheet</h2>
      <p className="text-sm text-muted-foreground text-center mb-4">As at {new Date(data.asOf).toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" })}</p>
      {renderSection("Assets", data.assets.accounts, data.assets.total)}
      {renderSection("Liabilities", data.liabilities.accounts, data.liabilities.total)}
      {renderSection("Net Assets / Equity", data.netAssets.accounts, data.netAssets.postedBalance)}
      {data.netAssets.currentPeriodSurplus !== 0 && (
        <div className="flex justify-between text-sm py-1 px-4 italic"><span>Current Period Surplus / (Deficit)</span><span>{formatCurrency(data.netAssets.currentPeriodSurplus)}</span></div>
      )}
      <div className="flex justify-between text-base font-bold py-2 px-4 border-t-2 border-border mt-4">
        <span>Total Liabilities & Equity</span><span>{formatCurrency(data.totalLiabilitiesAndEquity)}</span>
      </div>
      <p className={`text-sm mt-3 text-center font-medium ${data.isBalanced ? "text-green-600" : "text-red-600"}`}>
        {data.isBalanced ? "Balance sheet is balanced (A = L + E)" : "Balance sheet is NOT balanced"}
      </p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function IncomeStatementReport({ data }: { data: any }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-center mb-1">Income Statement</h2>
      <p className="text-sm text-muted-foreground text-center mb-4">
        {new Date(data.periodStart).toLocaleDateString("en-GH")} to {new Date(data.periodEnd).toLocaleDateString("en-GH")}
      </p>
      <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2">Revenue</h3>
      {data.revenue.lines.map((l: { code: string; name: string; total: number }) => (
        <div key={l.code} className="flex justify-between text-sm py-1 px-4"><span>{l.code} - {l.name}</span><span>{formatCurrency(l.total)}</span></div>
      ))}
      <div className="flex justify-between text-sm font-bold py-1 px-4 border-t border-border"><span>Total Revenue</span><span className="text-green-600">{formatCurrency(data.revenue.total)}</span></div>

      <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2 mt-6">Expenses</h3>
      {data.expenses.lines.map((l: { code: string; name: string; total: number }) => (
        <div key={l.code} className="flex justify-between text-sm py-1 px-4"><span>{l.code} - {l.name}</span><span>{formatCurrency(l.total)}</span></div>
      ))}
      <div className="flex justify-between text-sm font-bold py-1 px-4 border-t border-border"><span>Total Expenses</span><span className="text-red-600">{formatCurrency(data.expenses.total)}</span></div>

      <div className={`flex justify-between text-base font-bold py-2 px-4 border-t-2 border-border mt-6 ${data.surplus >= 0 ? "text-green-600" : "text-red-600"}`}>
        <span>Net {data.surplus >= 0 ? "Surplus" : "Deficit"}</span><span>{formatCurrency(Math.abs(data.surplus))}</span>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CashFlowReport({ data }: { data: any }) {
  const renderSection = (title: string, section: { inflows: number; outflows: number; net: number }) => (
    <div className="mb-6">
      <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2">{title}</h3>
      <div className="flex justify-between text-sm py-1 px-4"><span>Inflows</span><span className="text-green-600">{formatCurrency(section.inflows)}</span></div>
      <div className="flex justify-between text-sm py-1 px-4"><span>Outflows</span><span className="text-red-600">({formatCurrency(section.outflows)})</span></div>
      <div className="flex justify-between text-sm font-bold py-1 px-4 border-t border-border">
        <span>Net {title}</span><span className={section.net >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(section.net)}</span>
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="text-lg font-bold text-center mb-1">Cash Flow Statement</h2>
      <p className="text-sm text-muted-foreground text-center mb-4">
        {new Date(data.periodStart).toLocaleDateString("en-GH")} to {new Date(data.periodEnd).toLocaleDateString("en-GH")}
      </p>
      {renderSection("Operating Activities", data.operating)}
      {renderSection("Investing Activities", data.investing)}
      {data.financing && renderSection("Financing Activities", data.financing)}
      <div className={`flex justify-between text-base font-bold py-2 px-4 border-t-2 border-border ${data.netChange >= 0 ? "text-green-600" : "text-red-600"}`}>
        <span>Net Change in Cash</span><span>{formatCurrency(data.netChange)}</span>
      </div>
      {data.method && <p className="text-xs text-muted-foreground text-center mt-3">Direct-method presentation (IPSAS 2 preferred)</p>}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BoardSummaryReport({ data }: { data: any }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-center mb-1">Board Financial Summary</h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        {new Date(data.periodStart).toLocaleDateString("en-GH")} to {new Date(data.periodEnd).toLocaleDateString("en-GH")}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Fee Collection Rate</p>
          <p className="text-2xl font-bold">{data.feeCollection.rate.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(data.feeCollection.collected)} of {formatCurrency(data.feeCollection.billed)}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Outstanding Fees</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(data.feeCollection.outstanding)}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Expenses</p>
          <p className="text-2xl font-bold">{formatCurrency(data.expenses.total)}</p>
          <p className="text-xs text-muted-foreground">{data.expenses.count} transactions</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Gov. Subsidies Received</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(data.subsidies.received)}</p>
          <p className="text-xs text-muted-foreground">Gap: {formatCurrency(data.subsidies.gap)}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Budget Utilization</p>
          <p className="text-2xl font-bold">{data.budget.utilization.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(data.budget.spent)} of {formatCurrency(data.budget.allocated)}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Net Financial Position</p>
          <p className={`text-2xl font-bold ${data.netPosition >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(data.netPosition)}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── IPSAS Reports ─────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChangesInNetAssetsReport({ data }: { data: any }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-center mb-1">Statement of Changes in Net Assets / Equity</h2>
      <p className="text-sm text-muted-foreground text-center mb-4">
        {new Date(data.periodStart).toLocaleDateString("en-GH")} to {new Date(data.periodEnd).toLocaleDateString("en-GH")} &middot; IPSAS 1
      </p>
      <table className="min-w-full divide-y divide-border">
        <thead>
          <tr className="text-left text-xs font-medium uppercase text-muted-foreground">
            <th className="px-4 py-2">Code</th>
            <th className="px-4 py-2">Account</th>
            <th className="px-4 py-2 text-right">Opening</th>
            <th className="px-4 py-2 text-right">Movement</th>
            <th className="px-4 py-2 text-right">Closing</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.lines.map((l: { code: string; name: string; opening: number; movement: number; closing: number }) => (
            <tr key={l.code}>
              <td className="px-4 py-2 text-sm font-mono">{l.code}</td>
              <td className="px-4 py-2 text-sm">{l.name}</td>
              <td className="px-4 py-2 text-sm text-right">{formatCurrency(l.opening)}</td>
              <td className={`px-4 py-2 text-sm text-right ${l.movement >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(l.movement)}</td>
              <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(l.closing)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-bold">
            <td colSpan={2} className="px-4 py-2 text-sm">Totals</td>
            <td className="px-4 py-2 text-sm text-right">{formatCurrency(data.totalOpening)}</td>
            <td className={`px-4 py-2 text-sm text-right ${data.surplus >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(data.surplus)}</td>
            <td className="px-4 py-2 text-sm text-right">{formatCurrency(data.totalClosing)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="text-sm mt-3 text-center text-muted-foreground">
        Surplus / (Deficit) for period: <span className={`font-medium ${data.surplus >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(data.surplus)}</span>
      </p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BudgetVsActualReport({ data }: { data: any }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-center mb-1">Statement of Comparison of Budget and Actual Amounts</h2>
      <p className="text-sm text-muted-foreground text-center mb-4">Budget: {data.budgetName} &middot; IPSAS 24</p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr className="text-left text-xs font-medium uppercase text-muted-foreground">
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2 text-right">Original</th>
              <th className="px-4 py-2 text-right">Final</th>
              <th className="px-4 py-2 text-right">Committed</th>
              <th className="px-4 py-2 text-right">Actual</th>
              <th className="px-4 py-2 text-right">Variance</th>
              <th className="px-4 py-2 text-right">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.lines.map((l: { category: string; code: string | null; originalBudget: number; finalBudget: number; committed: number; actual: number; variance: number; variancePct: number }, i: number) => (
              <tr key={`${l.code ?? ""}-${i}`}>
                <td className="px-4 py-2 text-sm">{l.category}</td>
                <td className="px-4 py-2 text-sm text-right">{formatCurrency(l.originalBudget)}</td>
                <td className="px-4 py-2 text-sm text-right">{formatCurrency(l.finalBudget)}</td>
                <td className="px-4 py-2 text-sm text-right">{formatCurrency(l.committed)}</td>
                <td className="px-4 py-2 text-sm text-right">{formatCurrency(l.actual)}</td>
                <td className={`px-4 py-2 text-sm text-right ${l.variance >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(l.variance)}</td>
                <td className="px-4 py-2 text-sm text-right">{l.variancePct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-bold">
              <td className="px-4 py-2 text-sm">Totals</td>
              <td className="px-4 py-2 text-sm text-right">{formatCurrency(data.totalOriginal)}</td>
              <td className="px-4 py-2 text-sm text-right">{formatCurrency(data.totalFinal)}</td>
              <td className="px-4 py-2 text-sm text-right">{formatCurrency(data.totalCommitted)}</td>
              <td className="px-4 py-2 text-sm text-right">{formatCurrency(data.totalActual)}</td>
              <td className={`px-4 py-2 text-sm text-right ${data.totalVariance >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(data.totalVariance)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReceivablesAgingReport({ data }: { data: any }) {
  const buckets: Array<[string, string]> = [
    ["b0_30", "0\u201330 days"],
    ["b31_60", "31\u201360 days"],
    ["b61_90", "61\u201390 days"],
    ["b91_180", "91\u2013180 days"],
    ["b180_plus", "180+ days"],
  ];
  return (
    <div>
      <h2 className="text-lg font-bold text-center mb-1">Receivables Aging Report</h2>
      <p className="text-sm text-muted-foreground text-center mb-4">
        As at {new Date(data.asOfDate).toLocaleDateString("en-GH")} &middot; IPSAS 29/41 expected credit loss
      </p>
      <table className="min-w-full divide-y divide-border mb-4">
        <thead>
          <tr className="text-left text-xs font-medium uppercase text-muted-foreground">
            <th className="px-4 py-2">Bucket</th>
            <th className="px-4 py-2 text-right">Outstanding</th>
            <th className="px-4 py-2 text-right">ECL Rate</th>
            <th className="px-4 py-2 text-right">Allowance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {buckets.map(([key, label]) => (
            <tr key={key}>
              <td className="px-4 py-2 text-sm">{label}</td>
              <td className="px-4 py-2 text-sm text-right">{formatCurrency(data.buckets[key])}</td>
              <td className="px-4 py-2 text-sm text-right text-muted-foreground">{data.eclRates[key]}%</td>
              <td className="px-4 py-2 text-sm text-right">{formatCurrency(data.allowancePerBucket[key])}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-bold">
            <td className="px-4 py-2 text-sm">Totals ({data.billCount} bills)</td>
            <td className="px-4 py-2 text-sm text-right">{formatCurrency(data.totalReceivables)}</td>
            <td></td>
            <td className="px-4 py-2 text-sm text-right text-red-600">{formatCurrency(data.totalAllowance)}</td>
          </tr>
          <tr>
            <td colSpan={3} className="px-4 py-2 text-sm text-right">Net Receivables (Gross \u2212 Allowance)</td>
            <td className="px-4 py-2 text-sm text-right font-bold text-green-600">{formatCurrency(data.netReceivables)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FundStatementReport({ data }: { data: any }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-center mb-1">Fund Statement</h2>
      <p className="text-sm text-muted-foreground text-center mb-4">
        {new Date(data.periodStart).toLocaleDateString("en-GH")} to {new Date(data.periodEnd).toLocaleDateString("en-GH")}
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr className="text-left text-xs font-medium uppercase text-muted-foreground">
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Fund</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2 text-right">Revenue</th>
              <th className="px-4 py-2 text-right">Expenses</th>
              <th className="px-4 py-2 text-right">Surplus</th>
              <th className="px-4 py-2 text-right">Opening NA</th>
              <th className="px-4 py-2 text-right">Closing NA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.funds.map((f: { fundCode: string; fundName: string; fundType: string; revenue: number; expenses: number; surplus: number; netAssetsOpening: number; netAssetsClosing: number }) => (
              <tr key={f.fundCode}>
                <td className="px-4 py-2 text-sm font-mono">{f.fundCode}</td>
                <td className="px-4 py-2 text-sm font-medium">{f.fundName}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{f.fundType}</td>
                <td className="px-4 py-2 text-sm text-right">{formatCurrency(f.revenue)}</td>
                <td className="px-4 py-2 text-sm text-right">{formatCurrency(f.expenses)}</td>
                <td className={`px-4 py-2 text-sm text-right ${f.surplus >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(f.surplus)}</td>
                <td className="px-4 py-2 text-sm text-right">{formatCurrency(f.netAssetsOpening)}</td>
                <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(f.netAssetsClosing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
