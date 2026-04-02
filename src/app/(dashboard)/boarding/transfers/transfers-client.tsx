"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getTransfersAction,
  approveTransferAction,
  executeTransferAction,
  rejectTransferAction,
} from "@/modules/boarding/actions/transfer.action";

// ─── Types ──────────────────────────────────────────────────────────

interface TransferRow {
  id: string;
  transferNumber: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  fromBedId: string;
  fromBedNumber: string;
  fromDormitoryName: string;
  fromHostelName: string;
  toBedId: string;
  toBedNumber: string;
  toDormitoryName: string;
  toHostelName: string;
  reason: string;
  reasonDetails: string | null;
  status: string;
  requestedBy: string;
  requestedAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  effectiveDate: Date | null;
  completedAt: Date | null;
  rejectionReason: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ─── Status Badge Colors ────────────────────────────────────────────

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    CANCELLED: "bg-gray-100 text-gray-500",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

function getReasonBadge(reason: string) {
  const map: Record<string, string> = {
    STUDENT_REQUEST: "bg-blue-100 text-blue-700",
    DISCIPLINARY: "bg-red-100 text-red-700",
    MEDICAL: "bg-purple-100 text-purple-700",
    MAINTENANCE: "bg-orange-100 text-orange-700",
    CONFLICT_RESOLUTION: "bg-amber-100 text-amber-700",
    REBALANCING: "bg-teal-100 text-teal-700",
    OTHER: "bg-gray-100 text-gray-700",
  };
  return map[reason] ?? "bg-gray-100 text-gray-700";
}

// ─── Component ──────────────────────────────────────────────────────

export function TransfersClient({
  transfers: initialTransfers,
  pagination: initialPagination,
}: {
  transfers: TransferRow[];
  pagination: Pagination;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [transfers, setTransfers] = useState<TransferRow[]>(initialTransfers);
  const [pagination, setPagination] = useState(initialPagination);
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ transferId: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // ─── Stats ─────────────────────────────────────────────────────────

  const stats = {
    pending: initialTransfers.filter((t) => t.status === "PENDING").length,
    approved: initialTransfers.filter((t) => t.status === "APPROVED").length,
    completed: initialTransfers.filter((t) => t.status === "COMPLETED").length,
    rejected: initialTransfers.filter((t) => t.status === "REJECTED").length,
  };

  // ─── Fetch ─────────────────────────────────────────────────────────

  function fetchTransfers(page: number) {
    startTransition(async () => {
      const result = await getTransfersAction({
        status: filterStatus || undefined,
        page,
        pageSize: pagination.pageSize,
      });
      if ("data" in result) {
        setTransfers(result.data as TransferRow[]);
        const total = ("total" in result ? result.total : null) ?? 0;
        const ps = ("pageSize" in result ? result.pageSize : null) ?? pagination.pageSize;
        setPagination({
          page: ("page" in result ? result.page : null) ?? page,
          pageSize: ps,
          total,
          totalPages: Math.ceil(total / ps),
        });
      }
    });
  }

  // ─── Actions ───────────────────────────────────────────────────────

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveTransferAction(id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Transfer approved successfully.");
        router.refresh();
      }
    });
  }

  function handleExecute(id: string) {
    if (!confirm("Execute this transfer? The student will be moved to the new bed.")) return;

    startTransition(async () => {
      const result = await executeTransferAction(id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Transfer executed successfully. Student has been moved.");
        router.refresh();
      }
    });
  }

  function handleReject() {
    if (!rejectModal) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }

    startTransition(async () => {
      const result = await rejectTransferAction(rejectModal.transferId, rejectionReason);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Transfer rejected.");
        setRejectModal(null);
        setRejectionReason("");
        router.refresh();
      }
    });
  }

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // ─── Filter by search (client-side on current page) ────────────────

  const displayed = searchQuery
    ? transfers.filter(
        (t) =>
          t.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.studentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.transferNumber.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : transfers;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-yellow-600">Pending</p>
          <p className="text-xl font-bold">{stats.pending}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-blue-600">Approved</p>
          <p className="text-xl font-bold">{stats.approved}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-green-600">Completed</p>
          <p className="text-xl font-bold">{stats.completed}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-red-600">Rejected</p>
          <p className="text-xl font-bold">{stats.rejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="COMPLETED">Completed</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs w-48"
          placeholder="Search student or transfer#..."
        />
        <button
          onClick={() => fetchTransfers(1)}
          disabled={isPending}
          className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          Apply
        </button>
      </div>

      {/* Transfers Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Transfer #</th>
                <th className="px-4 py-3 text-left font-medium">Student</th>
                <th className="px-4 py-3 text-left font-medium">From</th>
                <th className="px-4 py-3 text-left font-medium">To</th>
                <th className="px-4 py-3 text-center font-medium">Reason</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Requested</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No transfer requests found.
                  </td>
                </tr>
              ) : (
                displayed.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{t.transferNumber}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{t.studentName}</p>
                        <p className="text-xs text-muted-foreground">{t.studentNumber}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        <p className="font-medium">{t.fromHostelName}</p>
                        <p className="text-muted-foreground">
                          {t.fromDormitoryName} &gt; Bed {t.fromBedNumber}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        <p className="font-medium">{t.toHostelName}</p>
                        <p className="text-muted-foreground">
                          {t.toDormitoryName} &gt; Bed {t.toBedNumber}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getReasonBadge(
                          t.reason,
                        )}`}
                      >
                        {t.reason.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(
                          t.status,
                        )}`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(t.requestedAt)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {t.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => handleApprove(t.id)}
                            disabled={isPending}
                            className="text-xs text-green-600 hover:text-green-800 font-medium mr-2"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectModal({ transferId: t.id })}
                            disabled={isPending}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {t.status === "APPROVED" && (
                        <button
                          onClick={() => handleExecute(t.id)}
                          disabled={isPending}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Execute
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => fetchTransfers(pagination.page - 1)}
            disabled={pagination.page <= 1 || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchTransfers(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Next
          </button>
        </div>
      )}

      {/* ─── Reject Modal ───────────────────────────────────────────── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Reject Transfer</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Please provide a reason for rejecting this transfer request.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Rejection Reason</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                placeholder="Reason for rejection..."
              />
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectionReason("");
                }}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-red-700"
              >
                {isPending ? "Processing..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
