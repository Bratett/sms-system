"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getMaintenanceRequestsAction,
  assignMaintenanceAction,
  updateMaintenanceStatusAction,
  resolveMaintenanceAction,
} from "@/modules/boarding/actions/maintenance.action";

// ─── Types ──────────────────────────────────────────────────────────

interface MaintenanceRow {
  id: string;
  requestNumber: string;
  hostelId: string;
  hostelName: string;
  dormitoryId: string | null;
  dormitoryName: string | null;
  bedId: string | null;
  bedNumber: string | null;
  reportedBy: string;
  reporterName: string;
  assignedTo: string | null;
  assigneeName: string | null;
  resolvedBy: string | null;
  resolverName: string | null;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assignedAt: Date | null;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface MaintenanceStats {
  open: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  closed: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

// ─── Badge Helpers ──────────────────────────────────────────────────

function getPriorityBadge(priority: string) {
  const map: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-700",
    MEDIUM: "bg-blue-100 text-blue-700",
    HIGH: "bg-orange-100 text-orange-700",
    URGENT: "bg-red-100 text-red-700",
  };
  return map[priority] ?? "bg-gray-100 text-gray-700";
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    OPEN: "bg-red-100 text-red-700",
    ASSIGNED: "bg-yellow-100 text-yellow-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    RESOLVED: "bg-green-100 text-green-700",
    CLOSED: "bg-gray-100 text-gray-500",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

function getCategoryBadge(category: string) {
  const map: Record<string, string> = {
    PLUMBING: "bg-cyan-100 text-cyan-700",
    ELECTRICAL: "bg-amber-100 text-amber-700",
    FURNITURE: "bg-orange-100 text-orange-700",
    STRUCTURAL: "bg-stone-100 text-stone-700",
    CLEANING: "bg-teal-100 text-teal-700",
    PEST_CONTROL: "bg-lime-100 text-lime-700",
    SECURITY: "bg-indigo-100 text-indigo-700",
    OTHER: "bg-gray-100 text-gray-700",
  };
  return map[category] ?? "bg-gray-100 text-gray-700";
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Component ──────────────────────────────────────────────────────

export function MaintenanceClient({
  requests: initialRequests,
  pagination: initialPagination,
  stats,
}: {
  requests: MaintenanceRow[];
  pagination: Pagination;
  stats: MaintenanceStats;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [requests, setRequests] = useState<MaintenanceRow[]>(initialRequests);
  const [pagination, setPagination] = useState(initialPagination);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterHostel, setFilterHostel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Assign modal state
  const [assignModal, setAssignModal] = useState<{ requestId: string; requestNumber: string } | null>(null);
  const [assignStaffId, setAssignStaffId] = useState("");

  // Resolve modal state
  const [resolveModal, setResolveModal] = useState<{ requestId: string; requestNumber: string } | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  // ─── Fetch ──────────────────────────────────────────────────────

  function fetchRequests(page: number) {
    startTransition(async () => {
      const result = await getMaintenanceRequestsAction({
        status: filterStatus || undefined,
        priority: filterPriority || undefined,
        category: filterCategory || undefined,
        hostelId: filterHostel || undefined,
        search: searchQuery || undefined,
        page,
        pageSize: pagination.pageSize,
      });
      if (result.data) {
        setRequests(result.data);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      }
    });
  }

  // ─── Actions ────────────────────────────────────────────────────

  function handleAssign() {
    if (!assignModal || !assignStaffId.trim()) {
      toast.error("Staff ID is required.");
      return;
    }
    startTransition(async () => {
      const result = await assignMaintenanceAction(assignModal.requestId, assignStaffId.trim());
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Request ${assignModal.requestNumber} assigned successfully.`);
        setAssignModal(null);
        setAssignStaffId("");
        router.refresh();
      }
    });
  }

  function handleStartWork(id: string) {
    startTransition(async () => {
      const result = await updateMaintenanceStatusAction(id, "IN_PROGRESS");
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Work started on request.");
        router.refresh();
      }
    });
  }

  function handleResolve() {
    if (!resolveModal || !resolveNotes.trim()) {
      toast.error("Resolution notes are required.");
      return;
    }
    startTransition(async () => {
      const result = await resolveMaintenanceAction(resolveModal.requestId, resolveNotes.trim());
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Request ${resolveModal.requestNumber} resolved.`);
        setResolveModal(null);
        setResolveNotes("");
        router.refresh();
      }
    });
  }

  function handleClose(id: string) {
    startTransition(async () => {
      const result = await updateMaintenanceStatusAction(id, "CLOSED");
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Request closed.");
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
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <div className="rounded-lg border border-red-200 bg-card p-3">
          <p className="text-xs text-red-600">Open</p>
          <p className="text-xl font-bold text-red-600">{stats.open}</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-card p-3">
          <p className="text-xs text-yellow-600">Assigned</p>
          <p className="text-xl font-bold text-yellow-600">{stats.assigned}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-card p-3">
          <p className="text-xs text-blue-600">In Progress</p>
          <p className="text-xl font-bold text-blue-600">{stats.inProgress}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-card p-3">
          <p className="text-xs text-green-600">Resolved</p>
          <p className="text-xl font-bold text-green-600">{stats.resolved}</p>
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
          <option value="OPEN">Open</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
        >
          <option value="">All Categories</option>
          <option value="PLUMBING">Plumbing</option>
          <option value="ELECTRICAL">Electrical</option>
          <option value="FURNITURE">Furniture</option>
          <option value="STRUCTURAL">Structural</option>
          <option value="CLEANING">Cleaning</option>
          <option value="PEST_CONTROL">Pest Control</option>
          <option value="SECURITY">Security</option>
          <option value="OTHER">Other</option>
        </select>
        <input
          type="text"
          value={filterHostel}
          onChange={(e) => setFilterHostel(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs w-36"
          placeholder="Hostel ID..."
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs w-48"
          placeholder="Search requests..."
        />
        <button
          onClick={() => fetchRequests(1)}
          disabled={isPending}
          className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          Apply
        </button>
      </div>

      {/* Requests Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Request #</th>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Hostel</th>
                <th className="px-4 py-3 text-center font-medium">Category</th>
                <th className="px-4 py-3 text-center font-medium">Priority</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Reported By</th>
                <th className="px-4 py-3 text-left font-medium">Assigned To</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                    No maintenance requests found.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {req.requestNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{req.title}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {req.hostelName}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getCategoryBadge(req.category)}`}
                      >
                        {formatLabel(req.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getPriorityBadge(req.priority)}`}
                      >
                        {req.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(req.status)}`}
                      >
                        {formatLabel(req.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {req.reporterName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {req.assigneeName ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(req.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {req.status === "OPEN" && (
                        <button
                          onClick={() =>
                            setAssignModal({
                              requestId: req.id,
                              requestNumber: req.requestNumber,
                            })
                          }
                          disabled={isPending}
                          className="text-xs text-yellow-600 hover:text-yellow-800 font-medium mr-2"
                        >
                          Assign
                        </button>
                      )}
                      {req.status === "ASSIGNED" && (
                        <button
                          onClick={() => handleStartWork(req.id)}
                          disabled={isPending}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-2"
                        >
                          Start Work
                        </button>
                      )}
                      {req.status === "IN_PROGRESS" && (
                        <button
                          onClick={() =>
                            setResolveModal({
                              requestId: req.id,
                              requestNumber: req.requestNumber,
                            })
                          }
                          disabled={isPending}
                          className="text-xs text-green-600 hover:text-green-800 font-medium mr-2"
                        >
                          Resolve
                        </button>
                      )}
                      {req.status === "RESOLVED" && (
                        <button
                          onClick={() => handleClose(req.id)}
                          disabled={isPending}
                          className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                        >
                          Close
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
            onClick={() => fetchRequests(pagination.page - 1)}
            disabled={pagination.page <= 1 || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchRequests(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || isPending}
            className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
          >
            Next
          </button>
        </div>
      )}

      {/* Assign Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-1">
              Assign Request
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Assign {assignModal.requestNumber} to a staff member.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Staff ID</label>
              <input
                type="text"
                value={assignStaffId}
                onChange={(e) => setAssignStaffId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Enter staff user ID"
              />
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setAssignModal(null);
                  setAssignStaffId("");
                }}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-1">
              Resolve Request
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Resolve {resolveModal.requestNumber} with notes.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Resolution Notes</label>
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={4}
                placeholder="Describe the resolution..."
              />
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setResolveModal(null);
                  setResolveNotes("");
                }}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={isPending}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? "Resolving..." : "Resolve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
