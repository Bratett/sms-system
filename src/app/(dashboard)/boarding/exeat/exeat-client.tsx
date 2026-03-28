"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  getExeatsAction,
  approveExeatAction,
  rejectExeatAction,
  recordDepartureAction,
  recordReturnAction,
} from "@/modules/boarding/actions/exeat.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ExeatRow {
  id: string;
  exeatNumber: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  type: string;
  reason: string;
  departureDate: Date;
  departureTime: string | null;
  expectedReturnDate: Date;
  actualReturnDate: Date | null;
  actualReturnTime: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  status: string;
  requestedAt: Date;
  approvalCount: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ExeatStats {
  total: number;
  requested: number;
  housemasterApproved: number;
  headmasterApproved: number;
  rejected: number;
  departed: number;
  returned: number;
  overdue: number;
  cancelled: number;
}

// ─── Status Badge Colors ────────────────────────────────────────────

function getExeatStatusBadge(status: string) {
  const map: Record<string, string> = {
    REQUESTED: "bg-yellow-100 text-yellow-700",
    HOUSEMASTER_APPROVED: "bg-blue-100 text-blue-700",
    HEADMASTER_APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    DEPARTED: "bg-orange-100 text-orange-700",
    RETURNED: "bg-green-100 text-green-700",
    OVERDUE: "bg-red-100 text-red-700",
    CANCELLED: "bg-gray-100 text-gray-500",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

function getTypeBadge(type: string) {
  const map: Record<string, string> = {
    NORMAL: "bg-gray-100 text-gray-700",
    EMERGENCY: "bg-red-100 text-red-700",
    MEDICAL: "bg-purple-100 text-purple-700",
    WEEKEND: "bg-blue-100 text-blue-700",
    VACATION: "bg-teal-100 text-teal-700",
  };
  return map[type] ?? "bg-gray-100 text-gray-700";
}

// ─── Component ──────────────────────────────────────────────────────

export function ExeatClient({
  exeats: initialExeats,
  pagination: initialPagination,
  stats,
}: {
  exeats: ExeatRow[];
  pagination: Pagination;
  stats: ExeatStats;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [exeats, setExeats] = useState<ExeatRow[]>(initialExeats);
  const [pagination, setPagination] = useState(initialPagination);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Approve/Reject modal
  const [actionModal, setActionModal] = useState<{
    exeatId: string;
    action: "approve" | "reject";
    role: "housemaster" | "headmaster";
  } | null>(null);
  const [actionComments, setActionComments] = useState("");

  // ─── Fetch ──────────────────────────────────────────────────────

  function fetchExeats(page: number) {
    startTransition(async () => {
      const result = await getExeatsAction({
        status: filterStatus || undefined,
        type: filterType || undefined,
        search: searchQuery || undefined,
        page,
        pageSize: pagination.pageSize,
      });
      if (result.data) {
        setExeats(result.data);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      }
    });
  }

  // ─── Actions ────────────────────────────────────────────────────

  function handleApproveReject() {
    if (!actionModal) return;

    startTransition(async () => {
      let result;
      if (actionModal.action === "approve") {
        result = await approveExeatAction(actionModal.exeatId, actionModal.role, actionComments || undefined);
      } else {
        result = await rejectExeatAction(actionModal.exeatId, actionModal.role, actionComments || undefined);
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          actionModal.action === "approve"
            ? "Exeat approved successfully."
            : "Exeat rejected.",
        );
        setActionModal(null);
        setActionComments("");
        router.refresh();
      }
    });
  }

  function handleRecordDeparture(id: string) {
    startTransition(async () => {
      const result = await recordDepartureAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Departure recorded.");
        router.refresh();
      }
    });
  }

  function handleRecordReturn(id: string) {
    startTransition(async () => {
      const result = await recordReturnAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Return recorded.");
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

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-yellow-600">Requested</p>
          <p className="text-xl font-bold">{stats.requested}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-blue-600">Approved</p>
          <p className="text-xl font-bold">{stats.housemasterApproved + stats.headmasterApproved}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-orange-600">Departed</p>
          <p className="text-xl font-bold">{stats.departed}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-green-600">Returned</p>
          <p className="text-xl font-bold">{stats.returned}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 border-red-200">
          <p className="text-xs text-red-600">Overdue</p>
          <p className="text-xl font-bold text-red-600">{stats.overdue}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-red-500">Rejected</p>
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
          <option value="REQUESTED">Requested</option>
          <option value="HOUSEMASTER_APPROVED">Housemaster Approved</option>
          <option value="HEADMASTER_APPROVED">Headmaster Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="DEPARTED">Departed</option>
          <option value="RETURNED">Returned</option>
          <option value="OVERDUE">Overdue</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
        >
          <option value="">All Types</option>
          <option value="NORMAL">Normal</option>
          <option value="EMERGENCY">Emergency</option>
          <option value="MEDICAL">Medical</option>
          <option value="WEEKEND">Weekend</option>
          <option value="VACATION">Vacation</option>
        </select>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs w-48"
          placeholder="Search student..."
        />
        <button
          onClick={() => fetchExeats(1)}
          disabled={isPending}
          className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          Apply
        </button>
      </div>

      {/* Exeats Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Exeat #</th>
                <th className="px-4 py-3 text-left font-medium">Student</th>
                <th className="px-4 py-3 text-center font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Departure</th>
                <th className="px-4 py-3 text-left font-medium">Expected Return</th>
                <th className="px-4 py-3 text-left font-medium">Actual Return</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exeats.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No exeat requests found.
                  </td>
                </tr>
              ) : (
                exeats.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/boarding/exeat/${e.id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {e.exeatNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{e.studentName}</p>
                        <p className="text-xs text-muted-foreground">{e.studentNumber}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getTypeBadge(
                          e.type,
                        )}`}
                      >
                        {e.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(e.departureDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(e.expectedReturnDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {e.actualReturnDate ? formatDate(e.actualReturnDate) : "---"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getExeatStatusBadge(
                          e.status,
                        )}`}
                      >
                        {e.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {e.status === "REQUESTED" && (
                        <>
                          <button
                            onClick={() =>
                              setActionModal({
                                exeatId: e.id,
                                action: "approve",
                                role: "housemaster",
                              })
                            }
                            disabled={isPending}
                            className="text-xs text-green-600 hover:text-green-800 font-medium mr-2"
                          >
                            Approve (HM)
                          </button>
                          <button
                            onClick={() =>
                              setActionModal({
                                exeatId: e.id,
                                action: "reject",
                                role: "housemaster",
                              })
                            }
                            disabled={isPending}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {e.status === "HOUSEMASTER_APPROVED" && (
                        <>
                          <button
                            onClick={() =>
                              setActionModal({
                                exeatId: e.id,
                                action: "approve",
                                role: "headmaster",
                              })
                            }
                            disabled={isPending}
                            className="text-xs text-green-600 hover:text-green-800 font-medium mr-2"
                          >
                            Approve (Head)
                          </button>
                          <button
                            onClick={() =>
                              setActionModal({
                                exeatId: e.id,
                                action: "reject",
                                role: "headmaster",
                              })
                            }
                            disabled={isPending}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {e.status === "HEADMASTER_APPROVED" && (
                        <button
                          onClick={() => handleRecordDeparture(e.id)}
                          disabled={isPending}
                          className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                        >
                          Record Departure
                        </button>
                      )}
                      {(e.status === "DEPARTED" || e.status === "OVERDUE") && (
                        <button
                          onClick={() => handleRecordReturn(e.id)}
                          disabled={isPending}
                          className="text-xs text-green-600 hover:text-green-800 font-medium"
                        >
                          Record Return
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
            onClick={() => fetchExeats(pagination.page - 1)}
            disabled={pagination.page <= 1 || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchExeats(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Next
          </button>
        </div>
      )}

      {/* ─── Approve/Reject Modal ───────────────────────────────────── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">
              {actionModal.action === "approve" ? "Approve Exeat" : "Reject Exeat"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {actionModal.action === "approve"
                ? `Approve as ${actionModal.role}?`
                : `Reject as ${actionModal.role}?`}
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Comments (optional)</label>
              <textarea
                value={actionComments}
                onChange={(e) => setActionComments(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                placeholder={
                  actionModal.action === "approve"
                    ? "Any comments..."
                    : "Reason for rejection..."
                }
              />
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setActionModal(null);
                  setActionComments("");
                }}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveReject}
                disabled={isPending}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  actionModal.action === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isPending
                  ? "Processing..."
                  : actionModal.action === "approve"
                  ? "Approve"
                  : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
