"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const AUDIT_ACTIONS = [
  "CREATE",
  "READ",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "EXPORT",
  "IMPORT",
  "APPROVE",
  "REJECT",
  "PUBLISH",
] as const;

const ACTION_STYLES: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  LOGIN: "bg-purple-100 text-purple-800",
  LOGOUT: "bg-gray-100 text-gray-800",
  APPROVE: "bg-emerald-100 text-emerald-800",
  REJECT: "bg-orange-100 text-orange-800",
  EXPORT: "bg-cyan-100 text-cyan-800",
  IMPORT: "bg-teal-100 text-teal-800",
  READ: "bg-slate-100 text-slate-800",
  PUBLISH: "bg-indigo-100 text-indigo-800",
};

interface AuditLogRow {
  id: string;
  timestamp: Date;
  action: string;
  entity: string;
  entityId: string | null;
  module: string;
  description: string;
  userName: string;
  userUsername: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface AuditUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
}

interface AuditLogClientProps {
  logs: AuditLogRow[];
  pagination: Pagination;
  modules: string[];
  users: AuditUser[];
  currentFilters: {
    userId?: string;
    module?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
  };
}

export function AuditLogClient({
  logs,
  pagination,
  modules,
  users,
  currentFilters,
}: AuditLogClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilters = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 when changing filters (except when changing page itself)
      if (key !== "page") {
        params.delete("page");
      }
      router.push(`/admin/audit-log?${params.toString()}`);
    },
    [router, searchParams],
  );

  function formatTimestamp(date: Date) {
    return new Date(date).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function handleClearFilters() {
    router.push("/admin/audit-log");
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">User</label>
            <select
              value={currentFilters.userId || ""}
              onChange={(e) => updateFilters("userId", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">All Users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Module</label>
            <select
              value={currentFilters.module || ""}
              onChange={(e) => updateFilters("module", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">All Modules</option>
              {modules.map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Action</label>
            <select
              value={currentFilters.action || ""}
              onChange={(e) => updateFilters("action", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">All Actions</option>
              {AUDIT_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">From</label>
            <input
              type="date"
              value={currentFilters.dateFrom || ""}
              onChange={(e) => updateFilters("dateFrom", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">To</label>
            <input
              type="date"
              value={currentFilters.dateTo || ""}
              onChange={(e) => updateFilters("dateTo", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {logs.length} of {pagination.total} entries
          </p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Timestamp</th>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Entity</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Module</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-xs">{log.userName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          ACTION_STYLES[log.action] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{log.entity}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                      {log.description}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs font-medium">
                        {log.module}
                      </span>
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
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateFilters("page", String(pagination.page - 1))}
              disabled={pagination.page <= 1}
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => updateFilters("page", String(pagination.page + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
