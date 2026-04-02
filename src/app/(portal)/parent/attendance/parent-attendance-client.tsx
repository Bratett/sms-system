"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { getChildAttendanceAction } from "@/modules/portal/actions/parent.action";

interface StudentInfo {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  attendanceRate: number | null;
  currentClass: {
    className: string;
    armName: string;
  } | null;
}

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

export function ParentAttendanceClient({
  students,
}: {
  students: StudentInfo[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    students[0]?.id ?? "",
  );
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  function loadAttendance(studentId: string, termId?: string) {
    startTransition(async () => {
      const result = await getChildAttendanceAction(studentId, termId || undefined);
      if (result.data) {
        setSummary(result.data.summary);
        setTerms(result.data.terms);
        setLoaded(true);
      }
    });
  }

  function handleStudentChange(studentId: string) {
    setSelectedStudentId(studentId);
    setSelectedTermId("");
    loadAttendance(studentId);
  }

  function handleTermChange(termId: string) {
    setSelectedTermId(termId);
    loadAttendance(selectedStudentId, termId);
  }

  // Auto-load on first render if student selected
  if (!loaded && selectedStudentId) {
    loadAttendance(selectedStudentId);
  }

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const stats = summary
    ? [
        { label: "Total Days", value: summary.total, color: "bg-gray-50 border-gray-200 text-gray-700" },
        { label: "Present", value: summary.present, color: "bg-green-50 border-green-200 text-green-700" },
        { label: "Absent", value: summary.absent, color: "bg-red-50 border-red-200 text-red-700" },
        { label: "Late", value: summary.late, color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
        { label: "Excused", value: summary.excused, color: "bg-blue-50 border-blue-200 text-blue-700" },
        { label: "Sick", value: summary.sick, color: "bg-orange-50 border-orange-200 text-orange-700" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Child Attendance"
        description="View your child's attendance records."
      />

      {students.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No children linked to your account.</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {students.length > 1 && (
              <div>
                <label className="mr-2 text-sm font-medium text-muted-foreground">Child:</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => handleStudentChange(e.target.value)}
                  disabled={isPending}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}
                      {s.currentClass ? ` (${s.currentClass.className} ${s.currentClass.armName})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {terms.length > 0 && (
              <div>
                <label className="mr-2 text-sm font-medium text-muted-foreground">Term:</label>
                <select
                  value={selectedTermId}
                  onChange={(e) => handleTermChange(e.target.value)}
                  disabled={isPending}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Current Term</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.academicYearName} - {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isPending && <span className="text-xs text-muted-foreground">Loading...</span>}
          </div>

          {/* Student Info */}
          {selectedStudent && (
            <div className="rounded-lg border bg-card p-4">
              <p className="font-medium">
                {selectedStudent.firstName} {selectedStudent.lastName}
              </p>
              {selectedStudent.currentClass && (
                <p className="text-sm text-muted-foreground">
                  {selectedStudent.currentClass.className} {selectedStudent.currentClass.armName}
                </p>
              )}
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
          {stats.length > 0 && (
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
          )}

          {loaded && !summary && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-sm text-gray-500">No attendance records found for this term.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
