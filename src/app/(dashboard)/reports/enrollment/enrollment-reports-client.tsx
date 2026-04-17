"use client";

import { useState, useTransition } from "react";
import { getEnrollmentReportAction } from "@/modules/reports/actions/report.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Filters {
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  terms: { id: string; name: string; isCurrent: boolean }[];
  classArms: { id: string; name: string }[];
}

interface EnrollmentReport {
  total: number;
  byGender: { MALE: number; FEMALE: number };
  byBoardingStatus: { DAY: number; BOARDING: number };
  byProgramme: { programme: string; count: number }[];
  byClass: { className: string; count: number }[];
}

// ─── Component ──────────────────────────────────────────────────────

export function EnrollmentReportsClient({
  report: initialReport,
  filters,
}: {
  report: EnrollmentReport | null;
  filters: Filters;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedYear, setSelectedYear] = useState(
    filters.academicYears.find((y) => y.isCurrent)?.id ?? "",
  );
  const [report, setReport] = useState<EnrollmentReport | null>(initialReport);
  const [error, setError] = useState("");

  function handleGenerate() {
    if (!selectedYear) {
      setError("Please select an academic year.");
      return;
    }
    setError("");

    startTransition(async () => {
      const result = await getEnrollmentReportAction({
        academicYearId: selectedYear,
      });
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
          <label className="mb-1 block text-sm font-medium">Academic Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select Year</option>
            {filters.academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Report Data */}
      {report && (
        <div className="space-y-6">
          {/* Total */}
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">Total Enrollment</p>
            <p className="mt-1 text-3xl font-bold">{report.total}</p>
          </div>

          {/* Gender + Boarding */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Gender Distribution */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-4 text-base font-semibold">Gender Distribution</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Male</span>
                  <span className="text-sm font-medium">{report.byGender.MALE}</span>
                </div>
                <div className="h-3 rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-blue-500"
                    style={{
                      width: `${report.total > 0 ? (report.byGender.MALE / report.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Female</span>
                  <span className="text-sm font-medium">{report.byGender.FEMALE}</span>
                </div>
                <div className="h-3 rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-pink-500"
                    style={{
                      width: `${report.total > 0 ? (report.byGender.FEMALE / report.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                {report.total > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Ratio: {Math.round((report.byGender.MALE / report.total) * 100)}% M / {Math.round((report.byGender.FEMALE / report.total) * 100)}% F
                  </p>
                )}
              </div>
            </div>

            {/* Boarding Status */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-4 text-base font-semibold">Day vs Boarding</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Day Students</span>
                  <span className="text-sm font-medium">{report.byBoardingStatus.DAY}</span>
                </div>
                <div className="h-3 rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-green-500"
                    style={{
                      width: `${report.total > 0 ? (report.byBoardingStatus.DAY / report.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Boarding Students</span>
                  <span className="text-sm font-medium">{report.byBoardingStatus.BOARDING}</span>
                </div>
                <div className="h-3 rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-purple-500"
                    style={{
                      width: `${report.total > 0 ? (report.byBoardingStatus.BOARDING / report.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Programme Distribution */}
          {report.byProgramme.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-semibold">By Programme</h3>
              <div className="overflow-hidden rounded-lg border">
                <table className="min-w-full divide-y">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Programme</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Students</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-card">
                    {report.byProgramme.map((p) => (
                      <tr key={p.programme}>
                        <td className="px-4 py-3 text-sm font-medium">{p.programme}</td>
                        <td className="px-4 py-3 text-sm">{p.count}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span>{report.total > 0 ? Math.round((p.count / report.total) * 100) : 0}%</span>
                            <div className="h-2 w-20 rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{
                                  width: `${report.total > 0 ? (p.count / report.total) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Class Distribution */}
          {report.byClass.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-semibold">By Class</h3>
              <div className="overflow-hidden rounded-lg border">
                <table className="min-w-full divide-y">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Class</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Students</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-card">
                    {report.byClass.map((c) => (
                      <tr key={c.className}>
                        <td className="px-4 py-3 text-sm font-medium">{c.className}</td>
                        <td className="px-4 py-3 text-sm">{c.count}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span>{report.total > 0 ? Math.round((c.count / report.total) * 100) : 0}%</span>
                            <div className="h-2 w-20 rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{
                                  width: `${report.total > 0 ? (c.count / report.total) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!report && !error && (
        <p className="text-sm text-muted-foreground">
          Loading enrollment data...
        </p>
      )}
    </div>
  );
}
