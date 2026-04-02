"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { getFinanceDashboardAction } from "@/modules/finance/actions/finance-report.action";

interface DashboardData {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number;
  totalBills: number;
  byMethod: Array<{ method: string; count: number; total: number }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    method: string;
    date: Date;
    studentName: string;
    studentId: string;
  }>;
}

interface Term {
  id: string;
  name: string;
  isCurrent: boolean;
  academicYear: { id: string; name: string };
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

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const quickLinks = [
  { title: "Fee Structures", description: "Manage fee structures and items", href: "/finance/fee-structures" },
  { title: "Billing", description: "Generate and manage student bills", href: "/finance/billing" },
  { title: "Payments", description: "Record and track payments", href: "/finance/payments" },
  { title: "Receipts", description: "View and print receipts", href: "/finance/receipts" },
  { title: "Scholarships", description: "Manage scholarships and discounts", href: "/finance/scholarships" },
  { title: "Arrears", description: "Track outstanding balances", href: "/finance/arrears" },
  { title: "Reports", description: "Financial reports and analytics", href: "/finance/reports" },
];

export function FinanceDashboardClient({
  dashboard,
  terms,
}: {
  dashboard: DashboardData | null;
  terms: Term[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<DashboardData | null>(dashboard);
  const [selectedTermId, setSelectedTermId] = useState<string>("");

  function handleTermChange(termId: string) {
    setSelectedTermId(termId);
    startTransition(async () => {
      const result = await getFinanceDashboardAction(termId || undefined);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setData("data" in result ? result.data : null);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Overview"
        description="Financial management dashboard for the school."
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
          <option value="">Current Term</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} - {t.academicYear.name} {t.isCurrent ? "(Current)" : ""}
            </option>
          ))}
        </select>
        {isPending && <span className="text-xs text-muted-foreground">Loading...</span>}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total Billed</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(data?.totalBilled ?? 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{data?.totalBills ?? 0} bills generated</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total Collected</p>
          <p className="mt-2 text-2xl font-bold text-green-600">{formatCurrency(data?.totalCollected ?? 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(data?.byMethod ?? []).reduce((sum, m) => sum + m.count, 0)} payments
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Outstanding</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{formatCurrency(data?.totalOutstanding ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Collection Rate</p>
          <p className="mt-2 text-2xl font-bold">{(data?.collectionRate ?? 0).toFixed(1)}%</p>
          <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-green-500 transition-all"
              style={{ width: `${Math.min(data?.collectionRate ?? 0, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Payment Method Breakdown */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Payment Methods</h3>
          </div>
          <div className="p-4">
            {(data?.byMethod ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No payments recorded</p>
            ) : (
              <div className="space-y-3">
                {(data?.byMethod ?? []).map((m) => {
                  const percentage =
                    (data?.totalCollected ?? 0) > 0
                      ? (m.total / (data?.totalCollected ?? 1)) * 100
                      : 0;
                  return (
                    <div key={m.method}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{formatMethodName(m.method)}</span>
                        <span className="font-mono text-muted-foreground">
                          {formatCurrency(m.total)} ({m.count})
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent Payments</h3>
            <button
              onClick={() => router.push("/finance/payments")}
              className="text-xs text-primary hover:text-primary/80 font-medium"
            >
              View All
            </button>
          </div>
          <div className="p-4">
            {(data?.recentPayments ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent payments</p>
            ) : (
              <div className="space-y-3">
                {(data?.recentPayments ?? []).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.studentId} &middot; {formatMethodName(p.method)} &middot; {formatDate(p.date)}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-semibold text-green-600">
                      {formatCurrency(p.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className="rounded-lg border border-border bg-card p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <p className="text-sm font-medium">{link.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{link.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
