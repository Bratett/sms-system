"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  requestDataExportAction,
  processDataExportAction,
  requestDataDeletionAction,
  reviewDeletionRequestAction,
} from "@/modules/compliance/actions/data-rights.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ExportRequest {
  id: string;
  status: string;
  format?: string;
  createdAt?: string | Date;
  completedAt?: string | Date | null;
  [key: string]: unknown;
}

interface DeletionRequest {
  id: string;
  status: string;
  entityType?: string;
  entityId?: string;
  reason?: string | null;
  createdAt?: string | Date;
  scheduledFor?: string | Date | null;
  [key: string]: unknown;
}

interface DataRightsClientProps {
  exportRequests: ExportRequest[];
  deletionRequests: DeletionRequest[];
  deletionTotal: number;
  deletionPage: number;
  deletionPageSize: number;
  currentStatus?: string;
}

// ─── Constants ─────────────────────────────────────────────────────

const DELETION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

// ─── Component ─────────────────────────────────────────────────────

export function DataRightsClient({
  exportRequests,
  deletionRequests,
  deletionTotal,
  deletionPage,
  deletionPageSize,
  currentStatus,
}: DataRightsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"exports" | "deletions">(
    "exports"
  );
  const [showDeletionForm, setShowDeletionForm] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewingRequest, setReviewingRequest] =
    useState<DeletionRequest | null>(null);

  // Deletion form state
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [reason, setReason] = useState("");

  const totalDeletionPages = Math.ceil(deletionTotal / deletionPageSize);

  // ─── Export actions ────────────────────────────────────────────

  async function handleRequestExport() {
    const result = await requestDataExportAction();
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Data export requested successfully.");
    startTransition(() => router.refresh());
  }

  async function handleProcessExport(requestId: string) {
    const result = await processDataExportAction(requestId);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Export processed successfully.");
    startTransition(() => router.refresh());
  }

  // ─── Deletion actions ─────────────────────────────────────────

  async function handleRequestDeletion(e: React.FormEvent) {
    e.preventDefault();
    if (!entityType || !entityId) {
      toast.error("Entity type and ID are required.");
      return;
    }

    const result = await requestDataDeletionAction({
      entityType,
      entityId,
      reason: reason || undefined,
    });

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Deletion request submitted.");
    setShowDeletionForm(false);
    setEntityType("");
    setEntityId("");
    setReason("");
    startTransition(() => router.refresh());
  }

  async function handleReviewDeletion(
    requestId: string,
    status: "APPROVED" | "REJECTED"
  ) {
    const result = await reviewDeletionRequestAction(requestId, { status });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Request ${status.toLowerCase()}.`);
    setShowReviewModal(false);
    setReviewingRequest(null);
    startTransition(() => router.refresh());
  }

  function handleStatusFilter(status: string) {
    const url = status
      ? `/compliance/data-rights?status=${status}`
      : "/compliance/data-rights";
    startTransition(() => router.push(url));
  }

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border bg-muted p-1">
        <button
          onClick={() => setActiveTab("exports")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "exports"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Export Requests
        </button>
        <button
          onClick={() => setActiveTab("deletions")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "deletions"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Deletion Requests
        </button>
      </div>

      {/* ─── Export Requests Tab ───────────────────────────────────── */}
      {activeTab === "exports" && (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-semibold">Export Requests</h3>
            <button
              onClick={handleRequestExport}
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Request Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">ID</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Format</th>
                  <th className="px-4 py-2 text-left font-medium">
                    Requested
                  </th>
                  <th className="px-4 py-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {exportRequests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No export requests found.
                    </td>
                  </tr>
                ) : (
                  exportRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">
                        {req.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-4 py-2">{req.format ?? "JSON"}</td>
                      <td className="px-4 py-2">
                        {req.createdAt ? formatDate(req.createdAt) : "-"}
                      </td>
                      <td className="px-4 py-2">
                        {req.status === "PENDING" && (
                          <button
                            onClick={() => handleProcessExport(req.id)}
                            disabled={isPending}
                            className="rounded border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                          >
                            Process
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
      )}

      {/* ─── Deletion Requests Tab ─────────────────────────────────── */}
      {activeTab === "deletions" && (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">Deletion Requests</h3>
              {/* Status filter */}
              <div className="flex gap-1">
                <button
                  onClick={() => handleStatusFilter("")}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    !currentStatus
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                </button>
                {DELETION_STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusFilter(status)}
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      currentStatus === status
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowDeletionForm(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Request Deletion
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">ID</th>
                  <th className="px-4 py-2 text-left font-medium">
                    Entity Type
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    Entity ID
                  </th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">
                    Requested
                  </th>
                  <th className="px-4 py-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {deletionRequests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No deletion requests found.
                    </td>
                  </tr>
                ) : (
                  deletionRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">
                        {req.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-2">{req.entityType ?? "-"}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {req.entityId ? `${req.entityId.slice(0, 8)}...` : "-"}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-4 py-2">
                        {req.createdAt ? formatDate(req.createdAt) : "-"}
                      </td>
                      <td className="px-4 py-2">
                        {req.status === "PENDING" && (
                          <button
                            onClick={() => {
                              setReviewingRequest(req);
                              setShowReviewModal(true);
                            }}
                            className="rounded border px-3 py-1 text-xs font-medium hover:bg-muted"
                          >
                            Review
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalDeletionPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {deletionPage} of {totalDeletionPages} ({deletionTotal}{" "}
                records)
              </p>
              <div className="flex gap-2">
                <button
                  disabled={deletionPage <= 1 || isPending}
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (currentStatus) params.set("status", currentStatus);
                    params.set("page", String(deletionPage - 1));
                    startTransition(() =>
                      router.push(
                        `/compliance/data-rights?${params.toString()}`
                      )
                    );
                  }}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={deletionPage >= totalDeletionPages || isPending}
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (currentStatus) params.set("status", currentStatus);
                    params.set("page", String(deletionPage + 1));
                    startTransition(() =>
                      router.push(
                        `/compliance/data-rights?${params.toString()}`
                      )
                    );
                  }}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Deletion Request Form Modal ───────────────────────────── */}
      {showDeletionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Request Data Deletion</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit a request to delete specific entity data.
            </p>
            <form onSubmit={handleRequestDeletion} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium">
                  Entity Type
                </label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select type...</option>
                  <option value="STUDENT">Student</option>
                  <option value="TEACHER">Teacher</option>
                  <option value="PARENT">Parent</option>
                  <option value="STAFF">Staff</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Entity ID</label>
                <input
                  type="text"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  placeholder="Enter the entity ID"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for deletion request"
                  rows={3}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeletionForm(false)}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Review Deletion Modal ─────────────────────────────────── */}
      {showReviewModal && reviewingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold">
              Review Deletion Request
            </h3>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="font-medium">Entity Type:</span>{" "}
                {reviewingRequest.entityType ?? "-"}
              </p>
              <p>
                <span className="font-medium">Entity ID:</span>{" "}
                {reviewingRequest.entityId ?? "-"}
              </p>
              {reviewingRequest.reason && (
                <p>
                  <span className="font-medium">Reason:</span>{" "}
                  {reviewingRequest.reason}
                </p>
              )}
              <p>
                <span className="font-medium">Requested:</span>{" "}
                {reviewingRequest.createdAt
                  ? formatDate(reviewingRequest.createdAt)
                  : "-"}
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setReviewingRequest(null);
                }}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleReviewDeletion(reviewingRequest.id, "REJECTED")
                }
                disabled={isPending}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() =>
                  handleReviewDeletion(reviewingRequest.id, "APPROVED")
                }
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    PROCESSING: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    FAILED: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}

function formatDate(dateStr: string | Date) {
  return new Date(dateStr).toLocaleDateString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
