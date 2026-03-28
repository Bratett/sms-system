"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { getAttendanceSummaryAction } from "@/modules/attendance/actions/attendance.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ClassArmOption {
  id: string;
  name: string;
  className: string;
}

interface TermOption {
  id: string;
  name: string;
  academicYearName: string;
}

interface AttendanceSummaryRow {
  studentId: string;
  studentNumber: string;
  studentName: string;
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

// ─── Component ──────────────────────────────────────────────────────

export function AttendanceReportsClient({
  classArms,
  terms,
}: {
  classArms: ClassArmOption[];
  terms: TermOption[];
}) {
  const [isPending, startTransition] = useTransition();

  const [selectedClassArmId, setSelectedClassArmId] = useState<string>("");
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [summaryData, setSummaryData] = useState<AttendanceSummaryRow[]>([]);
  const [totalDays, setTotalDays] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  function handleGenerateReport() {
    if (!selectedClassArmId) {
      toast.error("Please select a class arm.");
      return;
    }
    if (!selectedTermId) {
      toast.error("Please select a term.");
      return;
    }

    startTransition(async () => {
      const result = await getAttendanceSummaryAction(selectedClassArmId, selectedTermId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setSummaryData(result.data ?? []);
        setTotalDays(result.totalDays ?? 0);
        setHasSearched(true);
      }
    });
  }

  // Calculate class averages
  const classAvgRate =
    summaryData.length > 0
      ? Math.round(
          summaryData.reduce((sum, s) => sum + s.attendanceRate, 0) / summaryData.length,
        )
      : 0;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Class / Arm</label>
          <select
            value={selectedClassArmId}
            onChange={(e) => setSelectedClassArmId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[220px]"
          >
            <option value="">Select a class arm</option>
            {classArms.map((ca) => (
              <option key={ca.id} value={ca.id}>
                {ca.className} {ca.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Term</label>
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[220px]"
          >
            <option value="">Select a term</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.academicYearName})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGenerateReport}
          disabled={isPending || !selectedClassArmId || !selectedTermId}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Generating..." : "Generate Report"}
        </button>
      </div>

      {/* Summary Stats */}
      {hasSearched && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <div className="rounded-md border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Days</p>
            <p className="text-xl font-bold">{totalDays}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Students</p>
            <p className="text-xl font-bold">{summaryData.length}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Class Avg. Rate</p>
            <p className="text-xl font-bold">{classAvgRate}%</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Export</p>
            <button
              disabled
              className="mt-1 rounded-md border border-input px-3 py-1 text-xs font-medium text-muted-foreground cursor-not-allowed"
              title="Export functionality coming soon"
            >
              Export CSV
            </button>
          </div>
        </div>
      )}

      {/* Report Table */}
      {hasSearched && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">#</th>
                  <th className="px-4 py-3 text-left font-medium">Student Name</th>
                  <th className="px-4 py-3 text-left font-medium">Student ID</th>
                  <th className="px-4 py-3 text-center font-medium">Total Days</th>
                  <th className="px-4 py-3 text-center font-medium">Present</th>
                  <th className="px-4 py-3 text-center font-medium">Absent</th>
                  <th className="px-4 py-3 text-center font-medium">Late</th>
                  <th className="px-4 py-3 text-center font-medium">Excused</th>
                  <th className="px-4 py-3 text-center font-medium">Rate %</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      No attendance data found for the selected class and term.
                    </td>
                  </tr>
                ) : (
                  summaryData.map((row, index) => (
                    <tr
                      key={row.studentId}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-3 font-medium">{row.studentName}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {row.studentNumber}
                      </td>
                      <td className="px-4 py-3 text-center">{row.totalDays}</td>
                      <td className="px-4 py-3 text-center text-green-600 font-medium">
                        {row.present}
                      </td>
                      <td className="px-4 py-3 text-center text-red-600 font-medium">
                        {row.absent}
                      </td>
                      <td className="px-4 py-3 text-center text-yellow-600 font-medium">
                        {row.late}
                      </td>
                      <td className="px-4 py-3 text-center text-blue-600 font-medium">
                        {row.excused}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            row.attendanceRate >= 90
                              ? "bg-green-100 text-green-700"
                              : row.attendanceRate >= 75
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {row.attendanceRate}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
