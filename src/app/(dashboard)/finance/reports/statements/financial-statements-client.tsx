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
} from "@/modules/accounting/actions/financial-reports.action";

type ReportTab = "trial_balance" | "balance_sheet" | "income_statement" | "cash_flow" | "board_summary";

interface Account { id: string; code: string; name: string; currentBalance: number; category: { name: string; type: string }; }

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FinancialStatementsClient({ accounts }: { accounts: Account[] }) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<ReportTab>("trial_balance");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reportData, setReportData] = useState<any>(null);
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split("T")[0]);
  const [periodStart, setPeriodStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);

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
        case "board_summary":
          result = await generateBoardSummaryAction(new Date(periodStart), new Date(periodEnd));
          break;
      }
      if (result?.error) { toast.error(result.error); return; }
      setReportData(result?.data);
      toast.success("Report generated");
    });
  }

  const tabs: { key: ReportTab; label: string }[] = [
    { key: "trial_balance", label: "Trial Balance" },
    { key: "balance_sheet", label: "Balance Sheet" },
    { key: "income_statement", label: "Income Statement" },
    { key: "cash_flow", label: "Cash Flow" },
    { key: "board_summary", label: "Board Summary" },
  ];

  const needsDateRange = activeTab !== "trial_balance" && activeTab !== "balance_sheet";

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
      <div className="flex items-end gap-3">
        {needsDateRange && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Period Start</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
        )}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{needsDateRange ? "Period End" : "As of Date"}</label>
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <button onClick={handleGenerate} disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {isPending ? "Generating..." : "Generate Report"}
        </button>
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
      {renderSection("Equity", data.equity.accounts, data.equity.total)}
      {data.equity.netIncome !== 0 && (
        <div className="flex justify-between text-sm py-1 px-4 italic"><span>Net Income (Current Period)</span><span>{formatCurrency(data.equity.netIncome)}</span></div>
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

      <div className={`flex justify-between text-base font-bold py-2 px-4 border-t-2 border-border mt-6 ${data.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
        <span>Net {data.netIncome >= 0 ? "Surplus" : "Deficit"}</span><span>{formatCurrency(Math.abs(data.netIncome))}</span>
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
      <div className={`flex justify-between text-base font-bold py-2 px-4 border-t-2 border-border ${data.netChange >= 0 ? "text-green-600" : "text-red-600"}`}>
        <span>Net Change in Cash</span><span>{formatCurrency(data.netChange)}</span>
      </div>
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
