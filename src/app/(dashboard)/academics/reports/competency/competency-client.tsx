"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getStudentCompetencyReportAction } from "@/modules/curriculum/actions/standards-tracking.action";

const PROFICIENCY_COLORS: Record<string, string> = {
  NOT_YET: "bg-red-50 text-red-700",
  DEVELOPING: "bg-amber-50 text-amber-700",
  APPROACHING: "bg-blue-50 text-blue-700",
  MEETING: "bg-emerald-50 text-emerald-700",
  EXCEEDING: "bg-purple-50 text-purple-700",
};

function formatProficiency(val: string) {
  return val.replace(/_/g, " ");
}

export function CompetencyClient({
  academicYears,
}: {
  academicYears: Array<{ id: string; name: string; isCurrent: boolean }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const currentYear = academicYears.find((ay) => ay.isCurrent);
  const [studentId, setStudentId] = useState("");
  const [selectedYearId, setSelectedYearId] = useState(currentYear?.id ?? "");
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set()
  );

  function handleLoadReport() {
    if (!studentId.trim()) {
      toast.error("Please enter a student ID.");
      return;
    }
    if (!selectedYearId) {
      toast.error("Please select an academic year.");
      return;
    }
    startTransition(async () => {
      const result = await getStudentCompetencyReportAction(
        studentId.trim(),
        selectedYearId
      );
      if ("error" in result) {
        toast.error(result.error);
        setReportData(null);
        return;
      }
      setReportData(result.data ?? []);
      setExpandedSubjects(new Set());
      if (result.data && result.data.length > 0) {
        toast.success("Competency report loaded successfully");
      }
    });
  }

  function toggleSubject(subjectId: string) {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Competency Report</h1>
        <p className="text-sm text-muted-foreground">
          View standards-based competency reports for individual students.
        </p>
      </div>

      {/* Input Controls */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-foreground mb-1">
              Student ID
            </label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Enter student ID"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Academic Year
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select Year</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleLoadReport}
            disabled={isPending || !studentId.trim() || !selectedYearId}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Load Report"}
          </button>
        </div>
      </div>

      {/* Report Display */}
      {reportData !== null && reportData.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          No competency data found for this student and academic year.
        </div>
      )}

      {reportData && reportData.length > 0 && (
        <div className="space-y-4">
          {reportData.map((subject: any) => {
            const isExpanded = expandedSubjects.has(subject.subjectId);
            const meetingOrAbove =
              subject.standards?.filter(
                (s: any) =>
                  s.proficiency === "MEETING" || s.proficiency === "EXCEEDING"
              ).length ?? 0;
            const totalStandards = subject.standards?.length ?? 0;
            const masteryPct = subject.masteryPercentage ?? 0;

            return (
              <div
                key={subject.subjectId}
                className="rounded-xl border border-border bg-card p-6"
              >
                {/* Subject Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {subject.subjectName}
                  </h3>
                  <button
                    onClick={() => toggleSubject(subject.subjectId)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {isExpanded ? "Collapse" : "Expand Standards"}
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">
                      Mastery: {masteryPct}%
                    </span>
                    <span className="text-muted-foreground">
                      {meetingOrAbove} of {totalStandards} standards meeting or
                      above
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all duration-300"
                      style={{ width: `${masteryPct}%` }}
                    />
                  </div>
                </div>

                {/* Expandable Standards List */}
                {isExpanded && subject.standards && (
                  <div className="mt-4 space-y-2">
                    {subject.standards.map((standard: any, idx: number) => (
                      <div
                        key={standard.id ?? idx}
                        className="flex items-center justify-between rounded-lg border border-border px-4 py-2"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {standard.code
                              ? `${standard.code}: `
                              : ""}
                            {standard.description ?? standard.name}
                          </p>
                        </div>
                        <span
                          className={`ml-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            PROFICIENCY_COLORS[standard.proficiency] ??
                            "bg-gray-50 text-gray-700"
                          }`}
                        >
                          {formatProficiency(standard.proficiency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Proficiency Legend */}
      {reportData && reportData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h4 className="text-sm font-semibold mb-3">Proficiency Legend</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(PROFICIENCY_COLORS).map(([key, colors]) => (
              <span
                key={key}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${colors}`}
              >
                {formatProficiency(key)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
