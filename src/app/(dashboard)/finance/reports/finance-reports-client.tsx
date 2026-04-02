"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  getCollectionSummaryAction,
  getRevenueByClassAction,
  getRevenueByFeeItemAction,
  getDebtorListAction,
} from "@/modules/finance/actions/finance-report.action";

interface Term {
  id: string;
  name: string;
  isCurrent: boolean;
  academicYear: { id: string; name: string };
}

interface CollectionSummary {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number;
  byMethod: Array<{ method: string; count: number; total: number }>;
  dailyTrend: Array<{ date: string; amount: number }>;
}

interface RevenueByClass {
  className: string;
  students: number;
  billed: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
}

interface RevenueByFeeItem {
  name: string;
  totalBilled: number;
  totalCollected: number;
  collectionRate: number;
}

interface Debtor {
  studentId: string;
  name: string;
  className: string;
  outstanding: number;
}

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMethodName(method: string): string {
  return method
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FinanceReportsClient({
  terms,
  initialCollection,
  initialRevenueByClass,
  initialRevenueByFeeItem,
  initialDebtors,
}: {
  terms: Term[];
  initialCollection: CollectionSummary | null;
  initialRevenueByClass: RevenueByClass[];
  initialRevenueByFeeItem: RevenueByFeeItem[];
  initialDebtors: Debtor[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"collection" | "revenue" | "debtors">("collection");

  const [collection, setCollection] = useState<CollectionSummary | null>(initialCollection);
  const [revenueByClass, setRevenueByClass] = useState<RevenueByClass[]>(initialRevenueByClass);
  const [revenueByFeeItem, setRevenueByFeeItem] = useState<RevenueByFeeItem[]>(initialRevenueByFeeItem);
  const [debtors, setDebtors] = useState<Debtor[]>(initialDebtors);

  function handleTermChange(termId: string) {
    setSelectedTermId(termId);
    startTransition(async () => {
      const tid = termId || undefined;
      const [collectionRes, classRes, feeItemRes, debtorRes] = await Promise.all([
        getCollectionSummaryAction(tid),
        getRevenueByClassAction(tid),
        getRevenueByFeeItemAction(tid),
        getDebtorListAction(tid, 20),
      ]);

      if ("error" in collectionRes) {
        toast.error(collectionRes.error);
        return;
      }

      setCollection(collectionRes.data ?? null);
      setRevenueByClass("data" in classRes ? classRes.data ?? [] : []);
      setRevenueByFeeItem("data" in feeItemRes ? feeItemRes.data ?? [] : []);
      setDebtors("data" in debtorRes ? debtorRes.data ?? [] : []);
    });
  }

  const tabs = [
    { key: "collection" as const, label: "Collection Summary" },
    { key: "revenue" as const, label: "Revenue Analysis" },
    { key: "debtors" as const, label: "Debtors" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Reports"
        description="View collection summaries, revenue analysis, and debtor reports."
      />

      {/* Term Selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground">Term:</label>
        <select
          value={selectedTermId}
          onChange={(e) => handleTermChange(e.target.value)}
          disabled={isPending}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        >
          <option value="">All Terms</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} - {t.academicYear.name} {t.isCurrent ? "(Current)" : ""}
            </option>
          ))}
        </select>
        {isPending && (
          <span className="text-xs text-muted-foreground">Loading...</span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Billed</p>
          <p className="mt-1 text-2xl font-bold">
            {formatCurrency(collection?.totalBilled ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Collected</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {formatCurrency(collection?.totalCollected ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Outstanding</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {formatCurrency(collection?.totalOutstanding ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Collection Rate</p>
          <p className="mt-1 text-2xl font-bold">
            {(collection?.collectionRate ?? 0).toFixed(1)}%
          </p>
          <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-green-500"
              style={{ width: `${Math.min(collection?.collectionRate ?? 0, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "collection" && (
        <div className="space-y-6">
          {/* Payment Method Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Payment Method Breakdown</h3>
              <button
                disabled
                className="text-xs text-muted-foreground cursor-not-allowed"
                title="Export coming soon"
              >
                Export
              </button>
            </div>
            {(collection?.byMethod ?? []).length === 0 ? (
              <EmptyState title="No payment data" description="No payments recorded for the selected period." />
            ) : (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Payment Method</th>
                      <th className="px-4 py-3 text-right font-medium">Count</th>
                      <th className="px-4 py-3 text-right font-medium">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(collection?.byMethod ?? []).map((m) => (
                      <tr key={m.method} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{formatMethodName(m.method)}</td>
                        <td className="px-4 py-3 text-right">{m.count}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(m.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Collection by Class */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Collection by Class</h3>
              <button
                disabled
                className="text-xs text-muted-foreground cursor-not-allowed"
                title="Export coming soon"
              >
                Export
              </button>
            </div>
            {revenueByClass.length === 0 ? (
              <EmptyState title="No class data" description="No billing data found for the selected period." />
            ) : (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Class</th>
                        <th className="px-4 py-3 text-right font-medium">Students</th>
                        <th className="px-4 py-3 text-right font-medium">Billed</th>
                        <th className="px-4 py-3 text-right font-medium">Collected</th>
                        <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                        <th className="px-4 py-3 text-right font-medium">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueByClass.map((c) => (
                        <tr key={c.className} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{c.className}</td>
                          <td className="px-4 py-3 text-right">{c.students}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(c.billed)}</td>
                          <td className="px-4 py-3 text-right font-mono text-green-600">{formatCurrency(c.collected)}</td>
                          <td className="px-4 py-3 text-right font-mono text-red-600">{formatCurrency(c.outstanding)}</td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                c.collectionRate >= 80
                                  ? "bg-green-100 text-green-700"
                                  : c.collectionRate >= 50
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {c.collectionRate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "revenue" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Revenue by Fee Item</h3>
            <button
              disabled
              className="text-xs text-muted-foreground cursor-not-allowed"
              title="Export coming soon"
            >
              Export
            </button>
          </div>
          {revenueByFeeItem.length === 0 ? (
            <EmptyState title="No fee item data" description="No billing data found for the selected period." />
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Fee Item</th>
                      <th className="px-4 py-3 text-right font-medium">Total Billed</th>
                      <th className="px-4 py-3 text-right font-medium">Total Collected</th>
                      <th className="px-4 py-3 text-right font-medium">Collection Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueByFeeItem.map((item) => (
                      <tr key={item.name} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(item.totalBilled)}</td>
                        <td className="px-4 py-3 text-right font-mono text-green-600">
                          {formatCurrency(item.totalCollected)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-2 w-16 rounded-full bg-gray-200">
                              <div
                                className="h-2 rounded-full bg-green-500"
                                style={{ width: `${Math.min(item.collectionRate, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {item.collectionRate.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "debtors" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Top Debtors</h3>
            <button
              disabled
              className="text-xs text-muted-foreground cursor-not-allowed"
              title="Export coming soon"
            >
              Export
            </button>
          </div>
          {debtors.length === 0 ? (
            <EmptyState title="No debtors" description="No outstanding debts found for the selected period." />
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-center font-medium">#</th>
                      <th className="px-4 py-3 text-left font-medium">Student ID</th>
                      <th className="px-4 py-3 text-left font-medium">Student Name</th>
                      <th className="px-4 py-3 text-left font-medium">Class</th>
                      <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debtors.map((debtor, index) => (
                      <tr key={debtor.studentId} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 text-center text-muted-foreground">{index + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs">{debtor.studentId}</td>
                        <td className="px-4 py-3 font-medium">{debtor.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{debtor.className}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">
                          {formatCurrency(debtor.outstanding)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
