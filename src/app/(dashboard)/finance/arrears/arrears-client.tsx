"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { getArrearsAction, getArrearsReportAction } from "@/modules/finance/actions/arrears.action";

interface Term {
  id: string;
  name: string;
  isCurrent: boolean;
  academicYear: { id: string; name: string };
}

interface ArrearsRecord {
  studentDbId: string;
  studentId: string;
  studentName: string;
  className: string;
  totalBilled: number;
  totalPaid: number;
  balanceAmount: number;
  terms: string[];
}

interface ArrearsReport {
  totalOutstanding: number;
  totalStudents: number;
  averageArrears: number;
  byClass: Array<{ className: string; count: number; outstanding: number }>;
  byProgramme: Array<{ programmeName: string; count: number; outstanding: number }>;
  topDebtors: Array<{ studentId: string; name: string; className: string; outstanding: number }>;
}

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ArrearsClient({
  terms,
  initialArrears,
  initialReport,
}: {
  terms: Term[];
  initialArrears: ArrearsRecord[];
  initialReport: ArrearsReport | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [arrears, setArrears] = useState<ArrearsRecord[]>(initialArrears);
  const [report, setReport] = useState<ArrearsReport | null>(initialReport);

  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [minBalance, setMinBalance] = useState<string>("");

  const summary = useMemo(() => {
    return {
      totalStudents: arrears.length,
      totalOutstanding: arrears.reduce((sum, a) => sum + a.balanceAmount, 0),
      averageArrears:
        arrears.length > 0
          ? arrears.reduce((sum, a) => sum + a.balanceAmount, 0) / arrears.length
          : 0,
    };
  }, [arrears]);

  function handleFilter() {
    startTransition(async () => {
      const filters: { termId?: string; minBalance?: number } = {};
      if (selectedTermId) filters.termId = selectedTermId;
      if (minBalance && parseFloat(minBalance) > 0) filters.minBalance = parseFloat(minBalance);

      const [arrearsResult, reportResult] = await Promise.all([
        getArrearsAction(filters),
        getArrearsReportAction(selectedTermId || undefined),
      ]);

      if ("error" in arrearsResult) {
        toast.error(arrearsResult.error);
        return;
      }

      setArrears("data" in arrearsResult ? arrearsResult.data : []);
      setReport("data" in reportResult ? reportResult.data : null);
    });
  }

  function handleClearFilters() {
    setSelectedTermId("");
    setMinBalance("");
    startTransition(async () => {
      const [arrearsResult, reportResult] = await Promise.all([
        getArrearsAction(),
        getArrearsReportAction(),
      ]);
      setArrears("data" in arrearsResult ? arrearsResult.data : []);
      setReport("data" in reportResult ? reportResult.data : null);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Arrears Tracking"
        description="Track outstanding student fee balances and arrears."
        actions={
          <button
            disabled
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed"
            title="Export coming soon"
          >
            Export
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Term</label>
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Terms</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} - {t.academicYear.name} {t.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Minimum Balance (GHS)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 100"
            value={minBalance}
            onChange={(e) => setMinBalance(e.target.value)}
            className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleFilter}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Apply Filters"}
          </button>
          <button
            onClick={handleClearFilters}
            disabled={isPending}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Students with Arrears</p>
          <p className="mt-1 text-2xl font-bold">{summary.totalStudents}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Outstanding</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {formatCurrency(summary.totalOutstanding)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Average Arrears</p>
          <p className="mt-1 text-2xl font-bold">
            {formatCurrency(summary.averageArrears)}
          </p>
        </div>
      </div>

      {/* Arrears Table */}
      {arrears.length === 0 ? (
        <EmptyState
          title="No arrears found"
          description="No students have outstanding fee balances matching your filters."
        />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Student ID</th>
                  <th className="px-4 py-3 text-left font-medium">Student Name</th>
                  <th className="px-4 py-3 text-left font-medium">Class</th>
                  <th className="px-4 py-3 text-right font-medium">Total Billed</th>
                  <th className="px-4 py-3 text-right font-medium">Total Paid</th>
                  <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {arrears.map((record) => (
                  <tr
                    key={record.studentDbId}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{record.studentId}</td>
                    <td className="px-4 py-3 font-medium">{record.studentName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{record.className}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(record.totalBilled)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(record.totalPaid)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">
                      {formatCurrency(record.balanceAmount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => router.push(`/students/${record.studentDbId}`)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Student
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
