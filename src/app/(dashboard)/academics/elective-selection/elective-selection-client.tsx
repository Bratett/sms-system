"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  approveElectiveSelectionAction,
  rejectElectiveSelectionAction,
} from "@/modules/academics/actions/elective-selection.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ElectiveSelection {
  id: string;
  studentId: string;
  studentIdNumber: string;
  studentName: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  academicYearId: string;
  status: string;
  selectedAt: Date | string;
  approvedBy: string | null;
  approvedAt: Date | string | null;
  rejectionReason: string | null;
}

interface ClassArm {
  id: string;
  name: string;
  className: string;
}

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

// ─── Component ──────────────────────────────────────────────────────

export function ElectiveSelectionClient({
  initialSelections,
  classArms,
  academicYears,
}: {
  initialSelections: ElectiveSelection[];
  classArms: ClassArm[];
  academicYears: AcademicYear[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters
  const currentYear = academicYears.find((ay) => ay.isCurrent);
  const [selectedYearId, setSelectedYearId] = useState<string>(
    currentYear?.id ?? "",
  );
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Filter selections
  const filteredSelections = initialSelections.filter((s) => {
    if (selectedYearId && s.academicYearId !== selectedYearId) return false;
    if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
    return true;
  });

  // ─── Approve ──────────────────────────────────────────────────────

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveElectiveSelectionAction(id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Elective selection approved.");
      router.refresh();
    });
  }

  // ─── Reject ───────────────────────────────────────────────────────

  function openRejectModal(id: string) {
    setRejectingId(id);
    setRejectionReason("");
    setShowRejectModal(true);
  }

  function handleReject() {
    if (!rejectingId) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }

    startTransition(async () => {
      const result = await rejectElectiveSelectionAction(
        rejectingId!,
        rejectionReason.trim(),
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Elective selection rejected.");
      setShowRejectModal(false);
      setRejectingId(null);
      setRejectionReason("");
      router.refresh();
    });
  }

  // ─── Counts ───────────────────────────────────────────────────────

  const yearSelections = initialSelections.filter(
    (s) => !selectedYearId || s.academicYearId === selectedYearId,
  );
  const pendingCount = yearSelections.filter((s) => s.status === "PENDING").length;
  const approvedCount = yearSelections.filter((s) => s.status === "APPROVED").length;
  const rejectedCount = yearSelections.filter((s) => s.status === "REJECTED").length;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Pending</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{approvedCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Approved</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Rejected</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Academic Year
          </label>
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Years</option>
            {academicYears.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.name} {ay.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium">Student Name</th>
                <th className="px-4 py-3 text-left font-medium">Student ID</th>
                <th className="px-4 py-3 text-left font-medium">Subject</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Selected At</th>
                <th className="px-4 py-3 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSelections.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No elective selections found for the current filters.
                  </td>
                </tr>
              ) : (
                filteredSelections.map((selection) => (
                  <tr
                    key={selection.id}
                    className="border-b border-border last:border-0 hover:bg-muted/10"
                  >
                    <td className="px-4 py-3 font-medium">
                      {selection.studentName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {selection.studentIdNumber}
                    </td>
                    <td className="px-4 py-3">
                      {selection.subjectName}
                      {selection.subjectCode && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({selection.subjectCode})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={selection.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(selection.selectedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {selection.status === "PENDING" ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleApprove(selection.id)}
                            disabled={isPending}
                            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openRejectModal(selection.id)}
                            disabled={isPending}
                            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : selection.status === "REJECTED" && selection.rejectionReason ? (
                        <span
                          className="text-xs text-muted-foreground cursor-help"
                          title={selection.rejectionReason}
                        >
                          Reason: {selection.rejectionReason.slice(0, 30)}
                          {selection.rejectionReason.length > 30 ? "..." : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Reject Elective Selection</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Please provide a reason for rejecting this elective selection.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                placeholder="Enter the reason for rejection..."
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectingId(null);
                  setRejectionReason("");
                }}
                className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isPending || !rejectionReason.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Rejecting..." : "Reject Selection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
