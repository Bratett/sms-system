"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  approveExeatAction,
  rejectExeatAction,
  recordDepartureAction,
  recordReturnAction,
} from "@/modules/boarding/actions/exeat.action";

// ─── Types ──────────────────────────────────────────────────────────

interface StudentInfo {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  boardingStatus: string;
  photoUrl: string | null;
}

interface ApprovalInfo {
  id: string;
  approverRole: string;
  approverName: string;
  action: string;
  comments: string | null;
  actionAt: Date;
}

interface ExeatData {
  id: string;
  exeatNumber: string;
  student: StudentInfo | null;
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
  approvals: ApprovalInfo[];
}

// ─── Helpers ────────────────────────────────────────────────────────

function getStatusBadgeClass(status: string) {
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

function getTypeBadgeClass(type: string) {
  const map: Record<string, string> = {
    NORMAL: "bg-gray-100 text-gray-700",
    EMERGENCY: "bg-red-100 text-red-700",
    MEDICAL: "bg-purple-100 text-purple-700",
    WEEKEND: "bg-blue-100 text-blue-700",
    VACATION: "bg-teal-100 text-teal-700",
  };
  return map[type] ?? "bg-gray-100 text-gray-700";
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Component ──────────────────────────────────────────────────────

export function ExeatDetail({ exeat }: { exeat: ExeatData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showActionModal, setShowActionModal] = useState<{
    action: "approve" | "reject";
    role: "housemaster" | "headmaster";
  } | null>(null);
  const [comments, setComments] = useState("");

  function handleApproveReject() {
    if (!showActionModal) return;

    startTransition(async () => {
      let result;
      if (showActionModal.action === "approve") {
        result = await approveExeatAction(exeat.id, showActionModal.role, comments || undefined);
      } else {
        result = await rejectExeatAction(exeat.id, showActionModal.role, comments || undefined);
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(showActionModal.action === "approve" ? "Exeat approved." : "Exeat rejected.");
        setShowActionModal(null);
        setComments("");
        router.refresh();
      }
    });
  }

  function handleDeparture() {
    startTransition(async () => {
      const result = await recordDepartureAction(exeat.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Departure recorded.");
        router.refresh();
      }
    });
  }

  function handleReturn() {
    startTransition(async () => {
      const result = await recordReturnAction(exeat.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Return recorded.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header Info */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">{exeat.exeatNumber}</h2>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusBadgeClass(
                  exeat.status,
                )}`}
              >
                {exeat.status.replace(/_/g, " ")}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getTypeBadgeClass(
                  exeat.type,
                )}`}
              >
                {exeat.type}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Requested on {formatDateTime(exeat.requestedAt)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {exeat.status === "REQUESTED" && (
              <>
                <button
                  onClick={() => setShowActionModal({ action: "approve", role: "housemaster" })}
                  disabled={isPending}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Approve (Housemaster)
                </button>
                {exeat.type === "EMERGENCY" && (
                  <button
                    onClick={() => setShowActionModal({ action: "approve", role: "headmaster" })}
                    disabled={isPending}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve (Headmaster)
                  </button>
                )}
                <button
                  onClick={() => setShowActionModal({ action: "reject", role: "housemaster" })}
                  disabled={isPending}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}
            {exeat.status === "HOUSEMASTER_APPROVED" && (
              <>
                <button
                  onClick={() => setShowActionModal({ action: "approve", role: "headmaster" })}
                  disabled={isPending}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Approve (Headmaster)
                </button>
                <button
                  onClick={() => setShowActionModal({ action: "reject", role: "headmaster" })}
                  disabled={isPending}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}
            {exeat.status === "HEADMASTER_APPROVED" && (
              <button
                onClick={handleDeparture}
                disabled={isPending}
                className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                Record Departure
              </button>
            )}
            {(exeat.status === "DEPARTED" || exeat.status === "OVERDUE") && (
              <button
                onClick={handleReturn}
                disabled={isPending}
                className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Record Return
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Student Info */}
      {exeat.student && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="font-semibold mb-3">Student Information</h3>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Student ID</p>
              <p className="text-sm font-medium">{exeat.student.studentId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="text-sm font-medium">
                {exeat.student.firstName} {exeat.student.lastName}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Residential Status</p>
              <p className="text-sm font-medium">{exeat.student.boardingStatus}</p>
            </div>
          </div>
        </div>
      )}

      {/* Exeat Details */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold mb-3">Exeat Details</h3>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Reason</p>
            <p className="text-sm mt-1">{exeat.reason}</p>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Departure Date</p>
              <p className="text-sm font-medium">{formatDate(exeat.departureDate)}</p>
              {exeat.departureTime && (
                <p className="text-xs text-muted-foreground">{exeat.departureTime}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expected Return</p>
              <p className="text-sm font-medium">{formatDate(exeat.expectedReturnDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Actual Return</p>
              <p className="text-sm font-medium">
                {exeat.actualReturnDate
                  ? `${formatDate(exeat.actualReturnDate)}${
                      exeat.actualReturnTime ? ` at ${exeat.actualReturnTime}` : ""
                    }`
                  : "---"}
              </p>
            </div>
          </div>
          {(exeat.guardianName || exeat.guardianPhone) && (
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-2">Guardian Information</p>
              <div className="grid gap-3 grid-cols-2">
                {exeat.guardianName && (
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm font-medium">{exeat.guardianName}</p>
                  </div>
                )}
                {exeat.guardianPhone && (
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{exeat.guardianPhone}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approval Timeline */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold mb-4">Approval Timeline</h3>
        {exeat.approvals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approvals yet.</p>
        ) : (
          <div className="space-y-4">
            {exeat.approvals.map((approval, index) => (
              <div key={approval.id} className="flex gap-3">
                {/* Timeline dot and line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      approval.action === "APPROVED" ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  {index < exeat.approvals.length - 1 && (
                    <div className="w-0.5 flex-1 bg-border mt-1" />
                  )}
                </div>

                {/* Content */}
                <div className="pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{approval.approverName}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        approval.action === "APPROVED"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {approval.action}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      ({approval.approverRole})
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDateTime(approval.actionAt)}
                  </p>
                  {approval.comments && (
                    <p className="text-sm mt-1 text-muted-foreground">{approval.comments}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Action Modal ───────────────────────────────────────────── */}
      {showActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">
              {showActionModal.action === "approve" ? "Approve Exeat" : "Reject Exeat"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {showActionModal.action === "approve"
                ? `Approve this exeat as ${showActionModal.role}?`
                : `Reject this exeat as ${showActionModal.role}?`}
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Comments (optional)</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                placeholder={
                  showActionModal.action === "approve"
                    ? "Any comments..."
                    : "Reason for rejection..."
                }
              />
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowActionModal(null);
                  setComments("");
                }}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveReject}
                disabled={isPending}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  showActionModal.action === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isPending
                  ? "Processing..."
                  : showActionModal.action === "approve"
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
