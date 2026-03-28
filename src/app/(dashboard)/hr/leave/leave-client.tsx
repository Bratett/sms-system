"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  getLeaveRequestsAction,
  createLeaveTypeAction,
  updateLeaveTypeAction,
  deleteLeaveTypeAction,
  requestLeaveAction,
  approveLeaveAction,
  rejectLeaveAction,
  cancelLeaveAction,
} from "@/modules/hr/actions/leave.action";

// ─── Types ──────────────────────────────────────────────────────────

interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
  requiresApproval: boolean;
  applicableGender: string | null;
  status: string;
}

interface LeaveRequestRow {
  id: string;
  staffId: string;
  staffName: string;
  leaveTypeName: string;
  startDate: Date;
  endDate: Date;
  daysRequested: number;
  reason: string | null;
  status: string;
  appliedAt: Date;
  reviewedBy: string | null;
  reviewNotes: string | null;
}

interface StaffOption {
  id: string;
  staffId: string;
  name: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function LeaveClient({
  leaveTypes: initialLeaveTypes,
  initialRequests,
  initialTotal,
  initialPage,
  initialPageSize,
  staffOptions,
}: {
  leaveTypes: LeaveType[];
  initialRequests: LeaveRequestRow[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  staffOptions: StaffOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>(initialLeaveTypes);
  const [requests, setRequests] = useState<LeaveRequestRow[]>(initialRequests);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);
  const [filterStatus, setFilterStatus] = useState("");

  // Leave type form
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [typeForm, setTypeForm] = useState({
    name: "",
    defaultDays: 0,
    requiresApproval: true,
    applicableGender: "",
  });

  // Leave request form
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({
    staffId: "",
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
  });

  // Reject notes
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const totalPages = Math.ceil(total / pageSize);

  function fetchRequests(newPage: number) {
    startTransition(async () => {
      const result = await getLeaveRequestsAction({
        status: filterStatus || undefined,
        page: newPage,
        pageSize,
      });
      if (result.data) {
        setRequests(result.data);
        setTotal(result.total ?? 0);
        setPage(result.page ?? 1);
      }
    });
  }

  // ─── Leave Type CRUD ──────────────────────────────────────────────

  function openTypeForm(type?: LeaveType) {
    if (type) {
      setEditingType(type);
      setTypeForm({
        name: type.name,
        defaultDays: type.defaultDays,
        requiresApproval: type.requiresApproval,
        applicableGender: type.applicableGender || "",
      });
    } else {
      setEditingType(null);
      setTypeForm({ name: "", defaultDays: 0, requiresApproval: true, applicableGender: "" });
    }
    setShowTypeForm(true);
  }

  function handleSaveType() {
    if (!typeForm.name.trim()) {
      toast.error("Name is required.");
      return;
    }

    startTransition(async () => {
      if (editingType) {
        const result = await updateLeaveTypeAction(editingType.id, {
          name: typeForm.name,
          defaultDays: typeForm.defaultDays,
          requiresApproval: typeForm.requiresApproval,
          applicableGender: typeForm.applicableGender || undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Leave type updated.");
          setShowTypeForm(false);
          router.refresh();
        }
      } else {
        const result = await createLeaveTypeAction({
          name: typeForm.name,
          defaultDays: typeForm.defaultDays,
          requiresApproval: typeForm.requiresApproval,
          applicableGender: typeForm.applicableGender || undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Leave type created.");
          setShowTypeForm(false);
          router.refresh();
        }
      }
    });
  }

  function handleDeleteType(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete the leave type "${name}"?`)) return;

    startTransition(async () => {
      const result = await deleteLeaveTypeAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Leave type deleted.");
        router.refresh();
      }
    });
  }

  // ─── Leave Request ────────────────────────────────────────────────

  function handleSubmitRequest() {
    if (!requestForm.staffId || !requestForm.leaveTypeId || !requestForm.startDate || !requestForm.endDate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    startTransition(async () => {
      const result = await requestLeaveAction({
        staffId: requestForm.staffId,
        leaveTypeId: requestForm.leaveTypeId,
        startDate: requestForm.startDate,
        endDate: requestForm.endDate,
        reason: requestForm.reason || undefined,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Leave request submitted.");
        setShowRequestForm(false);
        setRequestForm({ staffId: "", leaveTypeId: "", startDate: "", endDate: "", reason: "" });
        router.refresh();
      }
    });
  }

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveLeaveAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Leave request approved.");
        router.refresh();
      }
    });
  }

  function handleReject() {
    if (!showRejectModal) return;

    startTransition(async () => {
      const result = await rejectLeaveAction(showRejectModal, rejectNotes);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Leave request rejected.");
        setShowRejectModal(null);
        setRejectNotes("");
        router.refresh();
      }
    });
  }

  function handleCancel(id: string) {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;

    startTransition(async () => {
      const result = await cancelLeaveAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Leave request cancelled.");
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

  function calculateBusinessDays(start: string, end: string): number {
    const startDate = new Date(start);
    const endDate = new Date(end);
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  return (
    <div className="space-y-8">
      {/* ─── Leave Types Section ──────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Leave Types</h2>
          <button
            onClick={() => openTypeForm()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Leave Type
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-center font-medium">Default Days</th>
                  <th className="px-4 py-3 text-center font-medium">Requires Approval</th>
                  <th className="px-4 py-3 text-center font-medium">Applicable Gender</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No leave types configured.
                    </td>
                  </tr>
                ) : (
                  leaveTypes.map((lt) => (
                    <tr key={lt.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{lt.name}</td>
                      <td className="px-4 py-3 text-center">{lt.defaultDays}</td>
                      <td className="px-4 py-3 text-center">
                        {lt.requiresApproval ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {lt.applicableGender || "All"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openTypeForm(lt)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteType(lt.id, lt.name)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Leave Requests Section ───────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Leave Requests</h2>
          <button
            onClick={() => setShowRequestForm(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Request Leave
          </button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 mb-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button
            onClick={() => fetchRequests(1)}
            disabled={isPending}
            className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            Apply
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Staff</th>
                  <th className="px-4 py-3 text-left font-medium">Leave Type</th>
                  <th className="px-4 py-3 text-left font-medium">Start</th>
                  <th className="px-4 py-3 text-left font-medium">End</th>
                  <th className="px-4 py-3 text-center font-medium">Days</th>
                  <th className="px-4 py-3 text-left font-medium">Reason</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No leave requests found.
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{r.staffName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.leaveTypeName}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(r.startDate)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(r.endDate)}
                      </td>
                      <td className="px-4 py-3 text-center">{r.daysRequested}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">
                        {r.reason || "---"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {r.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => handleApprove(r.id)}
                              disabled={isPending}
                              className="text-xs text-green-600 hover:text-green-800 font-medium mr-2"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setShowRejectModal(r.id);
                                setRejectNotes("");
                              }}
                              disabled={isPending}
                              className="text-xs text-red-600 hover:text-red-800 font-medium mr-2"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleCancel(r.id)}
                              disabled={isPending}
                              className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {r.status === "APPROVED" && (
                          <button
                            onClick={() => handleCancel(r.id)}
                            disabled={isPending}
                            className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                          >
                            Cancel
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
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => fetchRequests(page - 1)}
              disabled={page <= 1 || isPending}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => fetchRequests(page + 1)}
              disabled={page >= totalPages || isPending}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ─── Leave Type Form Modal ────────────────────────────────── */}
      {showTypeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">
              {editingType ? "Edit Leave Type" : "Add Leave Type"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Annual Leave"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Default Days</label>
                <input
                  type="number"
                  value={typeForm.defaultDays}
                  onChange={(e) =>
                    setTypeForm((p) => ({ ...p, defaultDays: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  min={0}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={typeForm.requiresApproval}
                  onChange={(e) =>
                    setTypeForm((p) => ({ ...p, requiresApproval: e.target.checked }))
                  }
                  className="rounded accent-primary h-4 w-4"
                  id="requiresApproval"
                />
                <label htmlFor="requiresApproval" className="text-sm">
                  Requires Approval
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Applicable Gender</label>
                <select
                  value={typeForm.applicableGender}
                  onChange={(e) =>
                    setTypeForm((p) => ({ ...p, applicableGender: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All</option>
                  <option value="MALE">Male Only</option>
                  <option value="FEMALE">Female Only</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowTypeForm(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveType}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Leave Request Modal ──────────────────────────────────── */}
      {showRequestForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Request Leave</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Staff Member</label>
                <select
                  value={requestForm.staffId}
                  onChange={(e) =>
                    setRequestForm((p) => ({ ...p, staffId: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select staff</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.staffId})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Leave Type</label>
                <select
                  value={requestForm.leaveTypeId}
                  onChange={(e) =>
                    setRequestForm((p) => ({ ...p, leaveTypeId: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select leave type</option>
                  {leaveTypes
                    .filter((lt) => lt.status === "ACTIVE")
                    .map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.name} ({lt.defaultDays} days)
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={requestForm.startDate}
                    onChange={(e) =>
                      setRequestForm((p) => ({ ...p, startDate: e.target.value }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    value={requestForm.endDate}
                    onChange={(e) =>
                      setRequestForm((p) => ({ ...p, endDate: e.target.value }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              {requestForm.startDate && requestForm.endDate && (
                <p className="text-xs text-muted-foreground">
                  Business days:{" "}
                  {calculateBusinessDays(requestForm.startDate, requestForm.endDate)}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                <textarea
                  value={requestForm.reason}
                  onChange={(e) =>
                    setRequestForm((p) => ({ ...p, reason: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Reason for leave..."
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRequestForm(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reject Modal ─────────────────────────────────────────── */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Reject Leave Request</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Notes / Reason</label>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                placeholder="Reason for rejection..."
              />
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(null)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
