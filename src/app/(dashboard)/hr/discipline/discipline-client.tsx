"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getStaffDisciplinaryRecordsAction,
  reportStaffDisciplinaryAction,
  resolveStaffDisciplinaryAction,
} from "@/modules/hr/actions/staff-discipline.action";

// ─── Types ──────────────────────────────────────────────────────────

interface DisciplinaryRecord {
  id: string;
  staffId: string;
  staffName?: string;
  date: Date | string;
  type: string;
  description: string;
  severity: string | null;
  status: string;
  sanction?: string | null;
  notes?: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ─── Component ──────────────────────────────────────────────────────

export function DisciplineClient({
  records: initialRecords,
  pagination: initialPagination,
}: {
  records: DisciplinaryRecord[];
  pagination: Pagination;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [records, setRecords] = useState<DisciplinaryRecord[]>(initialRecords);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [filterStatus, setFilterStatus] = useState("");

  // Report form
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportForm, setReportForm] = useState({
    staffId: "",
    date: "",
    type: "",
    description: "",
    severity: "",
  });

  // Resolve form
  const [resolvingRecord, setResolvingRecord] = useState<DisciplinaryRecord | null>(null);
  const [resolveForm, setResolveForm] = useState({
    sanction: "",
    status: "RESOLVED",
    notes: "",
  });

  function fetchRecords(newPage: number) {
    startTransition(async () => {
      const result = await getStaffDisciplinaryRecordsAction({
        status: filterStatus || undefined,
        page: newPage,
        pageSize: 25,
      });
      if ("data" in result) {
        setRecords(result.data);
        setPagination(
          result.pagination ?? { page: newPage, pageSize: 25, total: 0, totalPages: 0 },
        );
      }
    });
  }

  function handleReport() {
    if (!reportForm.staffId.trim() || !reportForm.date || !reportForm.type.trim() || !reportForm.description.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    startTransition(async () => {
      const result = await reportStaffDisciplinaryAction({
        staffId: reportForm.staffId.trim(),
        date: reportForm.date,
        type: reportForm.type.trim(),
        description: reportForm.description.trim(),
        severity: reportForm.severity || undefined,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Disciplinary incident reported.");
        setShowReportForm(false);
        setReportForm({ staffId: "", date: "", type: "", description: "", severity: "" });
        router.refresh();
      }
    });
  }

  function handleResolve() {
    if (!resolvingRecord) return;

    startTransition(async () => {
      const result = await resolveStaffDisciplinaryAction(resolvingRecord.id, {
        sanction: resolveForm.sanction || undefined,
        status: resolveForm.status,
        notes: resolveForm.notes || undefined,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Disciplinary record updated.");
        setResolvingRecord(null);
        setResolveForm({ sanction: "", status: "RESOLVED", notes: "" });
        router.refresh();
      }
    });
  }

  function formatDate(dateStr: Date | string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
            Pending
          </span>
        );
      case "RESOLVED":
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
            Resolved
          </span>
        );
      case "DISMISSED":
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            Dismissed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {status}
          </span>
        );
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
          <button
            onClick={() => fetchRecords(1)}
            disabled={isPending}
            className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            Apply
          </button>
        </div>
        <button
          onClick={() => setShowReportForm(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Report Incident
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Staff Name</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-center font-medium">Severity</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No disciplinary records found.
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {rec.staffName || rec.staffId}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(rec.date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{rec.type}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                      {rec.description}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {rec.severity || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(rec.status)}</td>
                    <td className="px-4 py-3 text-right">
                      {rec.status === "PENDING" && (
                        <button
                          onClick={() => {
                            setResolvingRecord(rec);
                            setResolveForm({ sanction: "", status: "RESOLVED", notes: "" });
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Resolve
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
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchRecords(pagination.page - 1)}
              disabled={pagination.page <= 1 || isPending}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
            >
              Previous
            </button>
            <button
              onClick={() => fetchRecords(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isPending}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Report Incident Modal */}
      {showReportForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Report Disciplinary Incident</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Staff ID</label>
                <input
                  type="text"
                  value={reportForm.staffId}
                  onChange={(e) => setReportForm((p) => ({ ...p, staffId: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Enter staff ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={reportForm.date}
                  onChange={(e) => setReportForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <input
                  type="text"
                  value={reportForm.type}
                  onChange={(e) => setReportForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Misconduct, Absence, Insubordination"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={reportForm.description}
                  onChange={(e) =>
                    setReportForm((p) => ({ ...p, description: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Describe the incident..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Severity (optional)</label>
                <select
                  value={reportForm.severity}
                  onChange={(e) =>
                    setReportForm((p) => ({ ...p, severity: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select severity</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowReportForm(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Reporting..." : "Report Incident"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolvingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">
              Resolve: {resolvingRecord.staffName || resolvingRecord.staffId}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {resolvingRecord.type} - {resolvingRecord.description}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={resolveForm.status}
                  onChange={(e) =>
                    setResolveForm((p) => ({ ...p, status: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="RESOLVED">Resolved</option>
                  <option value="DISMISSED">Dismissed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sanction (optional)</label>
                <input
                  type="text"
                  value={resolveForm.sanction}
                  onChange={(e) =>
                    setResolveForm((p) => ({ ...p, sanction: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Written Warning, Suspension"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                <textarea
                  value={resolveForm.notes}
                  onChange={(e) =>
                    setResolveForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Resolution notes..."
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setResolvingRecord(null)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Resolution"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
