"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { getMyAttendanceAction } from "@/modules/portal/actions/student-portal.action";

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  sick: number;
  attendanceRate: number | null;
}

interface TermOption {
  id: string;
  name: string;
  termNumber: number;
  academicYearName: string;
}

export function StudentAttendanceClient({
  initialData,
}: {
  initialData: {
    summary: AttendanceSummary | null;
    terms: TermOption[];
  };
}) {
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<AttendanceSummary | null>(initialData.summary);
  const [selectedTermId, setSelectedTermId] = useState<string>("");

  function handleTermChange(termId: string) {
    setSelectedTermId(termId);
    startTransition(async () => {
      const result = await getMyAttendanceAction(termId || undefined);
      if ("data" in result && result.data) {
        setSummary(result.data.summary);
      }
    });
  }

  const stats = [
    { label: "Total Days", value: summary?.total ?? 0, color: "bg-gray-50 border-gray-200 text-gray-700" },
    { label: "Present", value: summary?.present ?? 0, color: "bg-green-50 border-green-200 text-green-700" },
    { label: "Absent", value: summary?.absent ?? 0, color: "bg-red-50 border-red-200 text-red-700" },
    { label: "Late", value: summary?.late ?? 0, color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
    { label: "Excused", value: summary?.excused ?? 0, color: "bg-blue-50 border-blue-200 text-blue-700" },
    { label: "Sick", value: summary?.sick ?? 0, color: "bg-orange-50 border-orange-200 text-orange-700" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        description="View your attendance records and summary."
      />

      {/* Term Selector */}
      {initialData.terms.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">Term:</label>
          <select
            value={selectedTermId}
            onChange={(e) => handleTermChange(e.target.value)}
            disabled={isPending}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Current Term</option>
            {initialData.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.academicYearName} - {t.name}
              </option>
            ))}
          </select>
          {isPending && <span className="text-xs text-muted-foreground">Loading...</span>}
        </div>
      )}

      {/* Attendance Rate */}
      {summary && summary.attendanceRate !== null && (
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Attendance Rate</p>
          <p
            className={`text-4xl font-bold ${
              summary.attendanceRate >= 90
                ? "text-green-600"
                : summary.attendanceRate >= 75
                  ? "text-yellow-600"
                  : "text-red-600"
            }`}
          >
            {summary.attendanceRate}%
          </p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-md border p-3 text-center ${stat.color}`}
          >
            <p className="text-xs opacity-80">{stat.label}</p>
            <p className="text-xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {!summary && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No attendance records found for this term.</p>
        </div>
      )}
    </div>
  );
}
