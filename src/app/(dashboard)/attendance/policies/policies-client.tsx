"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createAttendancePolicyAction,
  updateAttendancePolicyAction,
  deleteAttendancePolicyAction,
  evaluateAttendancePoliciesAction,
} from "@/modules/attendance/actions/attendance-policy.action";

interface PolicyRow {
  id: string;
  name: string;
  scope: string;
  scopeId: string | null;
  metric: string;
  threshold: number;
  period: string;
  severity: string;
  actions: string[] | null;
  isActive: boolean;
  alertCount: number;
  createdAt: Date;
}

const METRIC_LABELS: Record<string, string> = {
  ABSENCE_COUNT: "Absence Count",
  ABSENCE_RATE: "Absence Rate (%)",
  CONSECUTIVE_ABSENCES: "Consecutive Absences",
  LATE_COUNT: "Late Count",
};

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-700",
  WARNING: "bg-yellow-100 text-yellow-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export function PoliciesClient({ policies }: { policies: PolicyRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    scope: "SCHOOL" as "SCHOOL" | "CLASS" | "CLASS_ARM",
    metric: "ABSENCE_COUNT" as "ABSENCE_COUNT" | "ABSENCE_RATE" | "CONSECUTIVE_ABSENCES" | "LATE_COUNT",
    threshold: 5,
    period: "TERM" as "WEEKLY" | "MONTHLY" | "TERM",
    severity: "WARNING" as "INFO" | "WARNING" | "CRITICAL",
  });

  function handleCreate() {
    if (!form.name.trim()) {
      toast.error("Policy name is required.");
      return;
    }

    startTransition(async () => {
      const result = await createAttendancePolicyAction(form);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Policy created.");
        setShowForm(false);
        router.refresh();
      }
    });
  }

  function handleToggle(id: string, isActive: boolean) {
    startTransition(async () => {
      const result = await updateAttendancePolicyAction(id, { isActive: !isActive });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(isActive ? "Policy disabled." : "Policy enabled.");
        router.refresh();
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete policy "${name}"? This will also delete associated alerts.`)) return;

    startTransition(async () => {
      const result = await deleteAttendancePolicyAction(id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Policy deleted.");
        router.refresh();
      }
    });
  }

  function handleEvaluate() {
    startTransition(async () => {
      const result = await evaluateAttendancePoliciesAction();
      if ("error" in result) {
        toast.error(result.error);
      } else if ("data" in result) {
        toast.success(
          `Evaluated ${result.data.evaluated} policies. ${result.data.alertsCreated} new alerts created.`,
        );
        router.refresh();
      }
    });
  }

  return (
    <>
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {policies.length} polic{policies.length !== 1 ? "ies" : "y"} configured
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleEvaluate}
            disabled={isPending || policies.filter((p) => p.isActive).length === 0}
            className="rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            {isPending ? "Evaluating..." : "Run Evaluation"}
          </button>
          <button
            onClick={() => setShowForm(true)}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New Policy
          </button>
        </div>
      </div>

      {/* Policies Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Metric</th>
              <th className="px-4 py-3 text-center font-medium">Threshold</th>
              <th className="px-4 py-3 text-center font-medium">Period</th>
              <th className="px-4 py-3 text-center font-medium">Severity</th>
              <th className="px-4 py-3 text-center font-medium">Alerts</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {policies.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No policies configured yet. Create one to start monitoring attendance.
                </td>
              </tr>
            ) : (
              policies.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {METRIC_LABELS[p.metric] ?? p.metric}
                  </td>
                  <td className="px-4 py-3 text-center font-mono">{p.threshold}</td>
                  <td className="px-4 py-3 text-center text-xs">{p.period}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[p.severity] ?? ""}`}>
                      {p.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.alertCount > 0 ? (
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        {p.alertCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(p.id, p.isActive)}
                      disabled={isPending}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {p.isActive ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      disabled={isPending}
                      className="text-xs text-red-600 hover:underline"
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

      {/* Create Policy Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New Attendance Policy</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g., Chronic Absence Alert"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Metric *</label>
                  <select
                    value={form.metric}
                    onChange={(e) => setForm({ ...form, metric: e.target.value as typeof form.metric })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="ABSENCE_COUNT">Absence Count</option>
                    <option value="ABSENCE_RATE">Absence Rate (%)</option>
                    <option value="CONSECUTIVE_ABSENCES">Consecutive Absences</option>
                    <option value="LATE_COUNT">Late Count</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Threshold *</label>
                  <input
                    type="number"
                    value={form.threshold}
                    onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    min={1}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Period</label>
                  <select
                    value={form.period}
                    onChange={(e) => setForm({ ...form, period: e.target.value as typeof form.period })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="TERM">Term</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Severity</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value as typeof form.severity })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="INFO">Info</option>
                    <option value="WARNING">Warning</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create Policy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
