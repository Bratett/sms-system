"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  getWaiversAction,
  approveFeeWaiverAction,
  rejectFeeWaiverAction,
} from "@/modules/finance/actions/fee-waiver.action";

import type { Monetary } from "@/lib/monetary";
interface Waiver {
  id: string;
  studentBillId: string;
  studentName: string;
  studentIdNumber: string;
  className: string;
  waiverType: string;
  value: Monetary;
  calculatedAmount: Monetary;
  reason: string;
  status: string;
  requestedBy: string;
  requestedByName: string;
  approvedBy: string | null;
  approvedByName: string | null;
  requestedAt: Date | string;
  reviewedAt: Date | string | null;
  notes: string | null;
}

type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

const ITEMS_PER_PAGE = 20;

const WAIVER_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PERCENTAGE: { bg: "bg-blue-100", text: "text-blue-700", label: "Percentage" },
  FIXED_AMOUNT: { bg: "bg-green-100", text: "text-green-700", label: "Fixed Amount" },
  FULL_WAIVER: { bg: "bg-red-100", text: "text-red-700", label: "Full Waiver" },
  STAFF_CHILD_DISCOUNT: { bg: "bg-purple-100", text: "text-purple-700", label: "Staff Child" },
  SIBLING_DISCOUNT: { bg: "bg-orange-100", text: "text-orange-700", label: "Sibling Discount" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "bg-yellow-100", text: "text-yellow-700" },
  APPROVED: { bg: "bg-green-100", text: "text-green-700" },
  REJECTED: { bg: "bg-red-100", text: "text-red-700" },
};

function formatCurrency(amount: Monetary): string {
  return `GHS ${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function WaiversClient({ waivers }: { waivers: Waiver[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedWaiver, setSelectedWaiver] = useState<Waiver | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  const filteredWaivers = useMemo(() => {
    if (statusFilter === "ALL") return waivers;
    return waivers.filter((w) => w.status === statusFilter);
  }, [waivers, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredWaivers.length / ITEMS_PER_PAGE));
  const paginatedWaivers = filteredWaivers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const summary = useMemo(() => {
    const pending = waivers.filter((w) => w.status === "PENDING").length;
    const approved = waivers.filter((w) => w.status === "APPROVED").length;
    const totalWaived = waivers
      .filter((w) => w.status === "APPROVED")
      .reduce((sum, w) => sum + Number(w.calculatedAmount), 0);
    return { pending, approved, totalWaived };
  }, [waivers]);

  function handleStatusFilterChange(filter: StatusFilter) {
    setStatusFilter(filter);
    setCurrentPage(1);
  }

  function handleApproveOpen(waiver: Waiver) {
    setSelectedWaiver(waiver);
    setActionNotes("");
    setShowApproveModal(true);
  }

  function handleRejectOpen(waiver: Waiver) {
    setSelectedWaiver(waiver);
    setActionNotes("");
    setShowRejectModal(true);
  }

  function handleApproveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedWaiver) return;
    startTransition(async () => {
      const result = await approveFeeWaiverAction(selectedWaiver.id, actionNotes || undefined);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Waiver approved successfully");
      setShowApproveModal(false);
      setSelectedWaiver(null);
      setActionNotes("");
      router.refresh();
    });
  }

  function handleRejectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedWaiver || !actionNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    startTransition(async () => {
      const result = await rejectFeeWaiverAction(selectedWaiver!.id, actionNotes);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Waiver rejected");
      setShowRejectModal(false);
      setSelectedWaiver(null);
      setActionNotes("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Waivers"
        description="Review and manage fee waiver requests for students."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Pending</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600">{summary.pending}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Approved (This Term)</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{summary.approved}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Waived Amount</p>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(summary.totalWaived)}</p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2">
        {(["ALL", "PENDING", "APPROVED", "REJECTED"] as StatusFilter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => handleStatusFilterChange(filter)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === filter
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {filter === "ALL" ? "All" : filter.charAt(0) + filter.slice(1).toLowerCase()}
            {filter === "PENDING" && summary.pending > 0 && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                {summary.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Waivers Table */}
      {filteredWaivers.length === 0 ? (
        <EmptyState
          title="No waivers found"
          description={
            statusFilter === "ALL"
              ? "No fee waiver requests have been submitted yet."
              : `No ${statusFilter.toLowerCase()} waivers found.`
          }
        />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">Student</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Class</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Waiver Type</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Value</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Calculated Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Reason</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Requested By</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedWaivers.map((waiver) => {
                  const typeStyle = WAIVER_TYPE_STYLES[waiver.waiverType] ?? {
                    bg: "bg-gray-100",
                    text: "text-gray-700",
                    label: waiver.waiverType,
                  };
                  const statusStyle = STATUS_STYLES[waiver.status] ?? {
                    bg: "bg-gray-100",
                    text: "text-gray-700",
                  };

                  return (
                    <tr key={waiver.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{waiver.studentName}</div>
                        <div className="text-xs text-muted-foreground">{waiver.studentIdNumber}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{waiver.className}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeStyle.bg} ${typeStyle.text}`}
                        >
                          {typeStyle.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {waiver.waiverType === "PERCENTAGE"
                          ? `${waiver.value}%`
                          : waiver.waiverType === "FULL_WAIVER"
                            ? "100%"
                            : formatCurrency(waiver.value)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatCurrency(waiver.calculatedAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                        {waiver.reason || "---"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                        >
                          {waiver.status.charAt(0) + waiver.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{waiver.requestedBy}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(waiver.requestedAt).toLocaleDateString("en-GH", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {waiver.status === "PENDING" ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApproveOpen(waiver)}
                              disabled={isPending}
                              className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectOpen(waiver)}
                              disabled={isPending}
                              className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">---</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredWaivers.length)} of{" "}
                {filteredWaivers.length} waivers
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isPending}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (page) =>
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) <= 1
                  )
                  .map((page, idx, arr) => (
                    <span key={page} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span className="px-1 text-muted-foreground">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        disabled={isPending}
                        className={`rounded-md px-3 py-1.5 text-sm ${
                          page === currentPage
                            ? "bg-primary text-primary-foreground"
                            : "border border-border hover:bg-accent"
                        } disabled:opacity-50`}
                      >
                        {page}
                      </button>
                    </span>
                  ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isPending}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedWaiver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Approve Fee Waiver</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Approve waiver for <span className="font-medium">{selectedWaiver.studentName}</span> -{" "}
              {formatCurrency(selectedWaiver.calculatedAmount)}
            </p>
            <form onSubmit={handleApproveSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Notes (Optional)
                </label>
                <textarea
                  placeholder="Add any notes for this approval..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowApproveModal(false);
                    setSelectedWaiver(null);
                    setActionNotes("");
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Approving..." : "Approve Waiver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedWaiver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Reject Fee Waiver</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Reject waiver for <span className="font-medium">{selectedWaiver.studentName}</span> -{" "}
              {formatCurrency(selectedWaiver.calculatedAmount)}
            </p>
            <form onSubmit={handleRejectSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Provide a reason for rejecting this waiver..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedWaiver(null);
                    setActionNotes("");
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? "Rejecting..." : "Reject Waiver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
