"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { generateBillsAction, getBillsAction } from "@/modules/finance/actions/billing.action";

interface FeeStructure {
  id: string;
  name: string;
  totalAmount: number;
  termName: string;
  status: string;
}

interface Term {
  id: string;
  name: string;
  isCurrent: boolean;
  academicYear: { id: string; name: string };
}

interface Bill {
  id: string;
  studentId: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  studentName: string;
  studentIdNumber: string;
  className: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function formatCurrency(amount: number): string {
  return `GHS ${amount.toFixed(2)}`;
}

const billStatusColors: Record<string, string> = {
  UNPAID: "bg-red-100 text-red-700",
  PARTIAL: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
  OVERPAID: "bg-blue-100 text-blue-700",
  WAIVED: "bg-gray-100 text-gray-500",
};

export function BillingClient({
  feeStructures,
  initialBills,
  initialPagination,
  terms,
}: {
  feeStructures: FeeStructure[];
  initialBills: Bill[];
  initialPagination: Pagination;
  terms: Term[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);

  // Generate bills form
  const [selectedFeeStructureId, setSelectedFeeStructureId] = useState("");

  // Filters
  const [filterTermId, setFilterTermId] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const activeFeeStructures = feeStructures.filter((fs) => fs.status === "ACTIVE");

  // Client-side search filter (name/ID)
  const filteredBills = useMemo(() => {
    if (!searchQuery.trim()) return bills;
    const q = searchQuery.toLowerCase();
    return bills.filter(
      (b) =>
        b.studentName.toLowerCase().includes(q) ||
        b.studentIdNumber.toLowerCase().includes(q)
    );
  }, [bills, searchQuery]);

  // Summary
  const summary = useMemo(() => {
    return filteredBills.reduce(
      (acc, bill) => ({
        totalBilled: acc.totalBilled + bill.totalAmount,
        totalPaid: acc.totalPaid + bill.paidAmount,
        totalOutstanding: acc.totalOutstanding + bill.balanceAmount,
      }),
      { totalBilled: 0, totalPaid: 0, totalOutstanding: 0 }
    );
  }, [filteredBills]);

  function handleGenerateBills() {
    if (!selectedFeeStructureId) {
      toast.error("Please select a fee structure");
      return;
    }

    startTransition(async () => {
      const result = await generateBillsAction({
        feeStructureId: selectedFeeStructureId,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      const data = result.data!;
      toast.success(
        `Bills generated: ${data.generated} new, ${data.skipped} skipped` +
          (data.errors.length > 0 ? `, ${data.errors.length} errors` : "")
      );

      if (data.errors.length > 0) {
        data.errors.slice(0, 3).forEach((err) => toast.error(err));
      }

      router.refresh();
    });
  }

  function handleFilterChange(termId: string, status: string) {
    startTransition(async () => {
      const filters: Record<string, unknown> = { page: 1, pageSize: 25 };
      if (termId !== "all") filters.termId = termId;
      if (status !== "all") filters.status = status;

      const result = await getBillsAction(filters as Parameters<typeof getBillsAction>[0]);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setBills(result.data ?? []);
      setPagination(result.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 });
    });
  }

  function handlePageChange(page: number) {
    startTransition(async () => {
      const filters: Record<string, unknown> = { page, pageSize: 25 };
      if (filterTermId !== "all") filters.termId = filterTermId;
      if (filterStatus !== "all") filters.status = filterStatus;

      const result = await getBillsAction(filters as Parameters<typeof getBillsAction>[0]);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setBills(result.data ?? []);
      setPagination(result.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 });
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Generate and manage student bills from active fee structures."
      />

      {/* Generate Bills Section */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-medium mb-3">Generate Bills</h3>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground mb-1">
              Fee Structure
            </label>
            <select
              value={selectedFeeStructureId}
              onChange={(e) => setSelectedFeeStructureId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select active fee structure</option>
              {activeFeeStructures.map((fs) => (
                <option key={fs.id} value={fs.id}>
                  {fs.name} - {fs.termName} ({formatCurrency(fs.totalAmount)})
                </option>
              ))}
            </select>
          </div>
          <ConfirmDialog
            title="Generate Bills"
            description="This will generate bills for all eligible students matching the fee structure criteria. Students who already have a bill for this fee structure will be skipped. Proceed?"
            onConfirm={handleGenerateBills}
            trigger={
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                disabled={!selectedFeeStructureId || isPending}
              >
                {isPending ? "Generating..." : "Generate Bills"}
              </button>
            }
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Term:</label>
          <select
            value={filterTermId}
            onChange={(e) => {
              setFilterTermId(e.target.value);
              handleFilterChange(e.target.value, filterStatus);
            }}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Terms</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.academicYear.name})
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              handleFilterChange(filterTermId, e.target.value);
            }}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIAL">Partial</option>
            <option value="PAID">Paid</option>
            <option value="OVERPAID">Overpaid</option>
            <option value="WAIVED">Waived</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Search:</label>
          <input
            type="text"
            placeholder="Student name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary w-64"
          />
        </div>
      </div>

      {/* Summary Row */}
      {filteredBills.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Billed</p>
            <p className="text-lg font-semibold">{formatCurrency(summary.totalBilled)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Paid</p>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(summary.totalPaid)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Outstanding</p>
            <p className="text-lg font-semibold text-red-600">
              {formatCurrency(summary.totalOutstanding)}
            </p>
          </div>
        </div>
      )}

      {/* Bills Table */}
      {filteredBills.length === 0 ? (
        <EmptyState
          title="No bills found"
          description="Generate bills from an active fee structure to see them here."
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
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Paid</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill) => (
                  <tr
                    key={bill.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-muted-foreground">{bill.studentIdNumber}</td>
                    <td className="px-4 py-3 font-medium">{bill.studentName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{bill.className}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(bill.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600">
                      {formatCurrency(bill.paidAmount)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {formatCurrency(bill.balanceAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          billStatusColors[bill.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/finance/payments?billId=${bill.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
                {pagination.total} bills
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || isPending}
                  className="rounded-md border border-border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || isPending}
                  className="rounded-md border border-border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
