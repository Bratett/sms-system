"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { getGeneralLedgerAction } from "@/modules/accounting/actions/journal.action";
import { exportGeneralLedgerAction } from "@/modules/accounting/actions/export-reports.action";
import type { Monetary } from "@/lib/monetary";

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" | "BUDGETARY";

interface Account {
  id: string;
  code: string;
  name: string;
  currentBalance: Monetary;
  normalBalance: "DEBIT" | "CREDIT";
  category: { name: string; type: AccountType };
}

interface Fund {
  id: string;
  code: string;
  name: string;
}

interface GLEntry {
  id: string;
  date: Date | string;
  transactionNumber: string;
  transactionId: string;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  status: "DRAFT" | "POSTED" | "REVERSED";
  side: "DEBIT" | "CREDIT";
  debit: number;
  credit: number;
  narration: string | null;
  fund: { code: string; name: string } | null;
  runningBalance: number;
  allEntries: Array<{
    id: string;
    side: "DEBIT" | "CREDIT";
    amount: number;
    narration: string | null;
    accountCode: string;
    accountName: string;
    fund: { code: string; name: string } | null;
  }>;
}

interface GLData {
  account: Account;
  openingBalance: number;
  periodDebits: number;
  periodCredits: number;
  netMovement: number;
  closingBalance: number;
  entries: GLEntry[];
  filters: { dateFrom: string | null; dateTo: string | null; fundId: string | null };
}

const TYPE_ORDER: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE", "BUDGETARY"];
const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Net Assets / Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expenses",
  BUDGETARY: "Budgetary",
};

function formatCurrency(n: number | Monetary): string {
  return `GHS ${Number(n).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_STYLES: Record<GLEntry["status"], string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  POSTED: "bg-green-100 text-green-700",
  REVERSED: "bg-red-100 text-red-700",
};

export function GeneralLedgerClient({ accounts, funds }: { accounts: Account[]; funds: Fund[] }) {
  const [isPending, startTransition] = useTransition();
  const [accountId, setAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fundId, setFundId] = useState("");
  const [data, setData] = useState<GLData | null>(null);
  const [drillEntry, setDrillEntry] = useState<GLEntry | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<AccountType, Account[]>();
    for (const a of accounts) {
      const t = a.category.type;
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(a);
    }
    return TYPE_ORDER.filter((t) => map.has(t)).map((t) => ({ type: t, accounts: map.get(t)! }));
  }, [accounts]);

  function handleGenerate() {
    if (!accountId) {
      toast.error("Select an account first");
      return;
    }
    startTransition(async () => {
      const result = await getGeneralLedgerAction(accountId, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        fundId: fundId || undefined,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setData(result.data as GLData);
    });
  }

  function handleExport() {
    if (!accountId) return;
    startTransition(async () => {
      const result = await exportGeneralLedgerAction(
        accountId,
        { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, fundId: fundId || undefined },
        "xlsx",
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const bytes = Uint8Array.from(atob(result.data.buffer), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("General Ledger exported");
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="General Ledger"
        description="Per-account transaction register with running balance, period totals, and drill-through to source journals"
      />

      {/* Filter bar */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Account *</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select an account…</option>
              {grouped.map((g) => (
                <optgroup key={g.type} label={TYPE_LABELS[g.type]}>
                  {g.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Date from</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Date to</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Fund</label>
            <select
              value={fundId}
              onChange={(e) => setFundId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">All funds</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} — {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={isPending || !accountId}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Loading…" : "Generate"}
          </button>
          {data && (
            <button
              onClick={handleExport}
              disabled={isPending}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Export Excel
            </button>
          )}
        </div>
      </div>

      {!data ? (
        <EmptyState
          title="Pick an account"
          description="Choose an account from the dropdown and press Generate to see its transaction register."
        />
      ) : (
        <>
          {/* Account header */}
          <div className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Account</p>
              <p className="text-lg font-mono font-semibold">{data.account.code}</p>
              <p className="text-sm">{data.account.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="text-sm">{data.account.category.name}</p>
              <p className="text-xs text-muted-foreground">Normal: {data.account.normalBalance}</p>
            </div>
            <div className="ml-auto">
              <p className="text-xs text-muted-foreground">Live current balance</p>
              <p className="text-lg font-bold">{formatCurrency(data.account.currentBalance)}</p>
            </div>
          </div>

          {/* Period summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCard label="Opening Balance" value={data.openingBalance} />
            <SummaryCard label="Period Debits" value={data.periodDebits} tone="green" />
            <SummaryCard label="Period Credits" value={data.periodCredits} tone="red" />
            <SummaryCard
              label="Net Movement"
              value={data.netMovement}
              tone={data.netMovement >= 0 ? "green" : "red"}
            />
            <SummaryCard label="Closing Balance" value={data.closingBalance} />
          </div>

          {/* Transactions table */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Journal #</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Fund</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                    <th className="px-3 py-2 text-right">Running Balance</th>
                    <th className="px-3 py-2">Narration</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {/* Opening balance row */}
                  <tr className="bg-muted/30 italic">
                    <td className="px-3 py-2 text-sm">—</td>
                    <td className="px-3 py-2 text-sm">—</td>
                    <td className="px-3 py-2 text-sm">Opening Balance</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="px-3 py-2 text-sm text-right font-medium">{formatCurrency(data.openingBalance)}</td>
                    <td></td>
                    <td></td>
                  </tr>

                  {data.entries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No transactions in this period.
                      </td>
                    </tr>
                  ) : (
                    data.entries.map((e) => (
                      <tr key={e.id} className={`hover:bg-muted/30 ${e.status === "REVERSED" ? "opacity-60" : ""}`}>
                        <td className="px-3 py-2 text-sm whitespace-nowrap">{new Date(e.date).toLocaleDateString("en-GH")}</td>
                        <td className="px-3 py-2 text-sm">
                          <button onClick={() => setDrillEntry(e)} className="font-mono text-primary hover:underline">
                            {e.transactionNumber}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-sm max-w-xs truncate" title={e.description}>{e.description}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{e.referenceType ?? ""}</td>
                        <td className="px-3 py-2 text-xs">{e.fund?.code ?? "—"}</td>
                        <td className="px-3 py-2 text-sm text-right">{e.debit > 0 ? formatCurrency(e.debit) : ""}</td>
                        <td className="px-3 py-2 text-sm text-right">{e.credit > 0 ? formatCurrency(e.credit) : ""}</td>
                        <td className="px-3 py-2 text-sm text-right font-medium">{formatCurrency(e.runningBalance)}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate" title={e.narration ?? ""}>{e.narration ?? ""}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[e.status]}`}>
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Period totals */}
                  <tr className="bg-muted/40 border-t-2 border-border font-semibold">
                    <td colSpan={5} className="px-3 py-2 text-sm text-right">Period Totals</td>
                    <td className="px-3 py-2 text-sm text-right">{formatCurrency(data.periodDebits)}</td>
                    <td className="px-3 py-2 text-sm text-right">{formatCurrency(data.periodCredits)}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                  {/* Closing balance */}
                  <tr className="bg-muted/60 font-bold">
                    <td colSpan={7} className="px-3 py-2 text-sm text-right">Closing Balance</td>
                    <td className="px-3 py-2 text-sm text-right">{formatCurrency(data.closingBalance)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Drill-through modal */}
      {drillEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDrillEntry(null)}>
          <div className="w-full max-w-3xl rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold font-mono">{drillEntry.transactionNumber}</h2>
                <p className="text-sm text-muted-foreground">
                  {new Date(drillEntry.date).toLocaleDateString("en-GH")} · {drillEntry.description}
                </p>
                {drillEntry.referenceType && (
                  <p className="text-xs text-muted-foreground">Reference: {drillEntry.referenceType} {drillEntry.referenceId ? `· ${drillEntry.referenceId.slice(-12)}` : ""}</p>
                )}
              </div>
              <button onClick={() => setDrillEntry(null)} className="text-muted-foreground text-xl">&times;</button>
            </div>
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Fund</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  <th className="px-3 py-2">Narration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {drillEntry.allEntries.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2 text-sm">
                      <span className="font-mono text-xs">{line.accountCode}</span>{" "}
                      {line.accountName}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{line.fund?.code ?? "—"}</td>
                    <td className="px-3 py-2 text-sm text-right">{line.side === "DEBIT" ? formatCurrency(line.amount) : ""}</td>
                    <td className="px-3 py-2 text-sm text-right">{line.side === "CREDIT" ? formatCurrency(line.amount) : ""}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{line.narration ?? ""}</td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold border-t-2 border-border">
                  <td colSpan={2} className="px-3 py-2 text-sm text-right">Totals</td>
                  <td className="px-3 py-2 text-sm text-right">{formatCurrency(drillEntry.allEntries.filter((l) => l.side === "DEBIT").reduce((s, l) => s + l.amount, 0))}</td>
                  <td className="px-3 py-2 text-sm text-right">{formatCurrency(drillEntry.allEntries.filter((l) => l.side === "CREDIT").reduce((s, l) => s + l.amount, 0))}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "green" | "red" }) {
  const cls = tone === "green" ? "text-green-600" : tone === "red" ? "text-red-600" : "";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${cls}`}>{formatCurrency(value)}</p>
    </div>
  );
}
