"use client";

import { useState, useTransition } from "react";
import { getAcademicPerformanceReportAction } from "@/modules/reports/actions/report.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Filters {
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  terms: { id: string; name: string; isCurrent: boolean }[];
  classArms: { id: string; name: string }[];
}

interface AcademicReport {
  totalStudents: number;
  classAverage: number;
  passRate: number;
  failRate: number;
  subjectPerformance: {
    subject: string;
    average: number;
    passRate: number;
    studentCount: number;
  }[];
  classPerformance: {
    className: string;
    average: number;
    studentCount: number;
  }[];
}

// ─── Component ──────────────────────────────────────────────────────

export function AcademicReportsClient({ filters }: { filters: Filters }) {
  const [isPending, startTransition] = useTransition();
  const [selectedTerm, setSelectedTerm] = useState(
    filters.terms.find((t) => t.isCurrent)?.id ?? "",
  );
  const [selectedClassArm, setSelectedClassArm] = useState("");
  const [report, setReport] = useState<AcademicReport | null>(null);
  const [error, setError] = useState("");

  function handleGenerate() {
    if (!selectedTerm) {
      setError("Please select a term.");
      return;
    }
    setError("");

    startTransition(async () => {
      const result = await getAcademicPerformanceReportAction(
        selectedTerm,
        selectedClassArm || undefined,
      );
      if ("error" in result) {
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
              <p className="text-sm text-muted-foreground">Students</p>
              <p className="mt-1 text-2xl font-bold">{report.totalStudents}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Class Average</p>
              <p className="mt-1 text-2xl font-bold">{report.classAverage}%</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Pass Rate</p>
              <p className="mt-1 text-2xl font-bold text-green-600">{report.passRate}%</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Fail Rate</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{report.failRate}%</p>
            </div>
          </div>

          {/* Subject Performance */}
          {report.subjectPerformance.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-semibold">Subject Performance</h3>
              <div className="overflow-hidden rounded-lg border">
                <table className="min-w-full divide-y">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Average</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Pass Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Students</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-card">
                    {report.subjectPerformance.map((sp) => (
                      <tr key={sp.subject}>
                        <td className="px-4 py-3 text-sm font-medium">{sp.subject}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span>{sp.average}%</span>
                            <div className="h-2 w-20 rounded-full bg-muted">
                              <div
                                className={`h-2 rounded-full ${sp.average >= 50 ? "bg-green-500" : "bg-red-500"}`}
                                style={{ width: `${Math.min(sp.average, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{sp.passRate}%</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{sp.studentCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Class Performance */}
          {report.classPerformance.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-semibold">Class Performance</h3>
              <div className="overflow-hidden rounded-lg border">
                <table className="min-w-full divide-y">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Class</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Average</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Students</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-card">
                    {report.classPerformance.map((cp) => (
                      <tr key={cp.className}>
                        <td className="px-4 py-3 text-sm font-medium">{cp.className}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span>{cp.average}%</span>
                            <div className="h-2 w-20 rounded-full bg-muted">
                              <div
                                className={`h-2 rounded-full ${cp.average >= 50 ? "bg-green-500" : "bg-red-500"}`}
                                style={{ width: `${Math.min(cp.average, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{cp.studentCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report.totalStudents === 0 && (
            <p className="text-sm text-muted-foreground">
              No results found for the selected term. Make sure results have been computed.
            </p>
          )}
        </div>
      )}

      {!report && !error && (
        <p className="text-sm text-muted-foreground">
          Select a term and click &quot;Generate Report&quot; to view academic performance data.
        </p>
      )}
    </div>
  );
}
