"use client";

import { useState, useTransition } from "react";
import { getAttendanceReportAction } from "@/modules/reports/actions/report.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Filters {
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  terms: { id: string; name: string; isCurrent: boolean }[];
  classArms: { id: string; name: string }[];
}

interface AttendanceReport {
  overallRate: number;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  byClass: {
    className: string;
    attendanceRate: number;
    totalRecords: number;
  }[];
}

// ─── Component ──────────────────────────────────────────────────────

export function AttendanceOverviewClient({ filters }: { filters: Filters }) {
  const [isPending, startTransition] = useTransition();
  const [selectedTerm, setSelectedTerm] = useState(
    filters.terms.find((t) => t.isCurrent)?.id ?? "",
  );
  const [selectedClassArm, setSelectedClassArm] = useState("");
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [error, setError] = useState("");

  function handleGenerate() {
    if (!selectedTerm) {
      setError("Please select a term.");
      return;
    }
    setError("");

    startTransition(async () => {
      const result = await getAttendanceReportAction(
        selectedTerm,
        selectedClassArm || undefined,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setReport(result.data ?? null);
    });
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Term *</label>
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select Term</option>
            {filters.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Class (Optional)</label>
          <select
            value={selectedClassArm}
            onChange={(e) => setSelectedClassArm(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Classes</option>
            {filters.classArms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Loading..." : "Generate Report"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Report Data */}
      {report && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Overall Rate</p>
              <p className={`mt-1 text-2xl font-bold ${report.overallRate >= 80 ? "text-green-600" : report.overallRate >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                {report.overallRate}%
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Present</p>
              <p className="mt-1 text-2xl font-bold text-green-600">{report.presentCount}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Absent</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{report.absentCount}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Late</p>
              <p className="mt-1 text-2xl font-bold text-yellow-600">{report.lateCount}</p>
            </div>
          </div>

          {/* Attendance by Class */}
          {report.byClass.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-semibold">Attendance by Class</h3>
              <div className="overflow-hidden rounded-lg border">
                <table className="min-w-full divide-y">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Class</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Attendance Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Total Records</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-card">
                    {report.byClass.map((c) => (
                      <tr key={c.className}>
                        <td className="px-4 py-3 text-sm font-medium">{c.className}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className={c.attendanceRate >= 80 ? "text-green-600" : c.attendanceRate >= 60 ? "text-yellow-600" : "text-red-600"}>
                              {c.attendanceRate}%
                            </span>
                            <div className="h-2 w-24 rounded-full bg-muted">
                              <div
                                className={`h-2 rounded-full ${c.attendanceRate >= 80 ? "bg-green-500" : c.attendanceRate >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                                style={{ width: `${Math.min(c.attendanceRate, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{c.totalRecords}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report.totalRecords === 0 && (
            <p className="text-sm text-muted-foreground">
              No attendance records found for the selected term.
            </p>
          )}
        </div>
      )}

      {!report && !error && (
        <p className="text-sm text-muted-foreground">
          Select a term and click &quot;Generate Report&quot; to view attendance data.
        </p>
      )}
    </div>
  );
}
