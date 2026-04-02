"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  acknowledgeAlertAction,
  resolveAlertAction,
} from "@/modules/attendance/actions/attendance-policy.action";

interface AlertRow {
  id: string;
  studentName: string;
  studentNumber: string;
  policyName: string;
  metric: string;
  currentValue: number;
  threshold: number;
  severity: string;
  status: string;
  notes: string | null;
  createdAt: Date;
}

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-700",
  WARNING: "bg-yellow-100 text-yellow-700",
  CRITICAL: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  ACKNOWLEDGED: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-green-100 text-green-700",
};

export function AlertsClient({
  alerts,
  pagination,
  filters,
}: {
  alerts: AlertRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  filters: { status?: string; severity?: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAcknowledge(id: string) {
    startTransition(async () => {
      const result = await acknowledgeAlertAction(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Alert acknowledged.");
        router.refresh();
      }
    });
  }

  function handleResolve(id: string) {
    const notes = prompt("Resolution notes (optional):");
    startTransition(async () => {
      const result = await resolveAlertAction(id, notes ?? undefined);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Alert resolved.");
        router.refresh();
      }
    });
  }

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams();
    if (key === "status") {
      if (value) params.set("status", value);
      if (filters.severity) params.set("severity", filters.severity);
    } else {
      if (filters.status) params.set("status", filters.status);
      if (value) params.set("severity", value);
    }
    router.push(`/attendance/alerts?${params.toString()}`);
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={filters.status ?? ""}
            onChange={(e) => applyFilter("status", e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="OPEN">Open</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Severity</label>
          <select
            value={filters.severity ?? ""}
            onChange={(e) => applyFilter("severity", e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
        <p className="ml-auto text-sm text-muted-foreground">{pagination.total} alert(s)</p>
      </div>

      {/* Alerts Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Student</th>
              <th className="px-4 py-3 text-left font-medium">Policy</th>
              <th className="px-4 py-3 text-center font-medium">Value</th>
              <th className="px-4 py-3 text-center font-medium">Threshold</th>
              <th className="px-4 py-3 text-center font-medium">Severity</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No alerts found.
                </td>
              </tr>
            ) : (
              alerts.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.studentName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{a.studentNumber}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{a.policyName}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold">
                    {Math.round(a.currentValue)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                    {a.threshold}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[a.severity] ?? ""}`}>
                      {a.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status] ?? ""}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {format(new Date(a.createdAt), "dd MMM yyyy")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {a.status === "OPEN" && (
                        <button
                          onClick={() => handleAcknowledge(a.id)}
                          disabled={isPending}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Acknowledge
                        </button>
                      )}
                      {a.status !== "RESOLVED" && (
                        <button
                          onClick={() => handleResolve(a.id)}
                          disabled={isPending}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
