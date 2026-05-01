"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getStudentHistoryAction,
  type StudentHistoryRow,
} from "@/modules/student/actions/history.action";

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "CREATE", label: "Created" },
  { value: "UPDATE", label: "Updated" },
  { value: "DELETE", label: "Deleted" },
  { value: "APPROVE", label: "Approved" },
  { value: "REJECT", label: "Rejected" },
  { value: "EXPORT", label: "Exported" },
] as const;

const ACTION_STYLES: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  APPROVE: "bg-emerald-100 text-emerald-800",
  REJECT: "bg-orange-100 text-orange-800",
  EXPORT: "bg-cyan-100 text-cyan-800",
  LOGIN: "bg-purple-100 text-purple-800",
  LOGOUT: "bg-gray-100 text-gray-800",
  IMPORT: "bg-teal-100 text-teal-800",
  READ: "bg-slate-100 text-slate-800",
  PUBLISH: "bg-indigo-100 text-indigo-800",
};

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function HistoryTab({ studentId }: { studentId: string }) {
  const [rows, setRows] = useState<StudentHistoryRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });
  const [actionFilter, setActionFilter] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getStudentHistoryAction({
        studentId,
        action: actionFilter ? (actionFilter as Parameters<typeof getStudentHistoryAction>[0]["action"]) : undefined,
        page,
        pageSize: 25,
      });
      if ("error" in result) {
        setError(result.error);
        setRows([]);
        setPagination({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
        return;
      }
      setError(null);
      setRows(result.data);
      setPagination(result.pagination);
    });
  }, [studentId, actionFilter, page]);

  const isFiltered = actionFilter !== "";
  const empty = rows.length === 0;

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-end gap-3">
        <label className="text-sm">
          <div className="mb-1 font-medium">Action</div>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
              setExpandedId(null);
            }}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        {isPending && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Entity</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {isFiltered
                    ? `No history matches the ${actionFilter.toLowerCase()} filter.`
                    : "No history yet for this student."}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isExpanded = expandedId === row.id;
                const actionStyle = ACTION_STYLES[row.action] ?? "bg-slate-100 text-slate-800";
                return (
                  <FragmentRow
                    key={row.id}
                    row={row}
                    isExpanded={isExpanded}
                    actionStyle={actionStyle}
                    onToggle={() => setExpandedId(isExpanded ? null : row.id)}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!empty && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.pageSize + 1}
            –{Math.min(pagination.page * pagination.pageSize, pagination.total)}
            {" of "}
            {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1 || isPending}
              className="rounded-md border px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages || isPending}
              className="rounded-md border px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  row,
  isExpanded,
  actionStyle,
  onToggle,
}: {
  row: StudentHistoryRow;
  isExpanded: boolean;
  actionStyle: string;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="cursor-pointer border-t border-border hover:bg-muted/30" onClick={onToggle}>
        <td className="px-3 py-2 whitespace-nowrap">
          {new Date(row.timestamp).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </td>
        <td className="px-3 py-2">
          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${actionStyle}`}>
            {row.action}
          </span>
        </td>
        <td className="px-3 py-2 font-mono text-xs">{row.entity}</td>
        <td className="px-3 py-2">{row.description}</td>
        <td className="px-3 py-2">
          {row.userName ?? row.userUsername ?? "System"}
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={5} className="px-3 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Previous</p>
                <pre className="overflow-auto rounded bg-card p-2 text-xs">
                  {row.previousData ? JSON.stringify(row.previousData, null, 2) : "—"}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">New</p>
                <pre className="overflow-auto rounded bg-card p-2 text-xs">
                  {row.newData ? JSON.stringify(row.newData, null, 2) : "—"}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
