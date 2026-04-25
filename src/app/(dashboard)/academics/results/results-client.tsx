"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  computeTerminalResultsAction,
  getTerminalResultsAction,
  getResultSummaryAction,
  updateTerminalResultRemarksAction,
  publishResultsAction,
} from "@/modules/academics/actions/result.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ClassArm {
  id: string;
  name: string;
  className: string;
  programmeName: string;
}

interface Term {
  id: string;
  name: string;
  termNumber: number;
  academicYearId: string;
  academicYearName: string;
  isCurrent: boolean;
}

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface SubjectResult {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  classScore: number | null;
  examScore: number | null;
  totalScore: number | null;
  grade: string | null;
  interpretation: string | null;
  position: number | null;
}

interface TerminalResult {
  id: string;
  studentId: string;
  studentIdNumber: string;
  studentName: string;
  classArmId: string;
  termId: string;
  academicYearId: string;
  totalScore: number | null;
  averageScore: number | null;
  classPosition: number | null;
  overallGrade: string | null;
  teacherRemarks: string | null;
  headmasterRemarks: string | null;
  promotionStatus: string | null;
  computedAt: Date;
  subjectResults: SubjectResult[];
}

interface ResultSummary {
  studentCount: number;
  classAverage: number;
  highest: number;
  lowest: number;
  subjectAverages: Array<{
    subjectId: string;
    subjectName: string;
    average: number;
    studentCount: number;
  }>;
}

// ─── Component ──────────────────────────────────────────────────────

export function ResultsClient({
  classArms,
  terms,
  academicYears,
}: {
  classArms: ClassArm[];
  terms: Term[];
  academicYears: AcademicYear[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters
  const currentYear = academicYears.find((ay) => ay.isCurrent);
  const [selectedYearId, setSelectedYearId] = useState<string>(
    currentYear?.id ?? "",
  );
  const [selectedClassArmId, setSelectedClassArmId] = useState<string>("");
  const [selectedTermId, setSelectedTermId] = useState<string>("");

  // Data
  const [results, setResults] = useState<TerminalResult[]>([]);
  const [summary, setSummary] = useState<ResultSummary | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Remarks modal
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [remarksTarget, setRemarksTarget] = useState<TerminalResult | null>(
    null,
  );
  const [teacherRemarks, setTeacherRemarks] = useState("");
  const [headmasterRemarks, setHeadmasterRemarks] = useState("");

  // Filter terms by academic year
  const filteredTerms = terms.filter(
    (t) => t.academicYearId === selectedYearId,
  );

  // Get all unique subjects from results for table columns
  const subjectColumns = (() => {
    const subjectMap = new Map<
      string,
      { id: string; name: string; code: string | null }
    >();
    for (const r of results) {
      for (const sr of r.subjectResults) {
        if (!subjectMap.has(sr.subjectId)) {
          subjectMap.set(sr.subjectId, {
            id: sr.subjectId,
            name: sr.subjectName,
            code: sr.subjectCode,
          });
        }
      }
    }
    return Array.from(subjectMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  })();

  // ─── Load Results ──────────────────────────────────────────────────

  function handleLoadResults() {
    if (!selectedClassArmId || !selectedTermId) {
      toast.error("Please select a class arm and term.");
      return;
    }

    startTransition(async () => {
      const [resultsRes, summaryRes] = await Promise.all([
        getTerminalResultsAction(selectedClassArmId, selectedTermId),
        getResultSummaryAction(selectedClassArmId, selectedTermId),
      ]);

      if ("error" in resultsRes) {
        toast.error(resultsRes.error);
        setResults([]);
        setSummary(null);
      } else {
        setResults(resultsRes.data ?? []);
      }

      if ("data" in summaryRes) {
        setSummary(summaryRes.data);
      } else {
        setSummary(null);
      }

      setHasLoaded(true);
    });
  }

  // ─── Compute Results ──────────────────────────────────────────────

  function handleComputeResults() {
    if (!selectedClassArmId || !selectedTermId || !selectedYearId) {
      toast.error("Please select a class arm, term, and academic year.");
      return;
    }

    if (
      !confirm(
        "This will compute (or recompute) results for all students in this class. Any existing results will be overwritten. Continue?",
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await computeTerminalResultsAction(
        selectedClassArmId,
        selectedTermId,
        selectedYearId,
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if ("data" in result) {
        toast.success(
          `Results computed for ${result.data.computed} student(s).`,
        );
        if (result.data.errors.length > 0) {
          for (const err of result.data.errors) {
            toast.warning(err);
          }
        }
        // Reload results
        handleLoadResults();
      }
    });
  }

  // ─── Publish Results ──────────────────────────────────────────────

  function handlePublishResults() {
    if (!selectedClassArmId || !selectedTermId) return;

    if (
      !confirm(
        "This will publish results and make them available. Continue?",
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await publishResultsAction(
        selectedClassArmId,
        selectedTermId,
      );
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Results released successfully.");
      }
    });
  }

  // ─── Remarks ──────────────────────────────────────────────────────

  function handleOpenRemarks(r: TerminalResult) {
    setRemarksTarget(r);
    setTeacherRemarks(r.teacherRemarks ?? "");
    setHeadmasterRemarks(r.headmasterRemarks ?? "");
    setShowRemarksModal(true);
  }

  function handleSaveRemarks(e: React.FormEvent) {
    e.preventDefault();
    if (!remarksTarget) return;

    startTransition(async () => {
      const result = await updateTerminalResultRemarksAction(
        remarksTarget.id,
        {
          teacherRemarks,
          headmasterRemarks,
        },
      );
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Remarks updated successfully.");
        setShowRemarksModal(false);
        handleLoadResults();
      }
    });
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Academic Year
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => {
                setSelectedYearId(e.target.value);
                setSelectedTermId("");
                setResults([]);
                setSummary(null);
                setHasLoaded(false);
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select Year</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Class Arm
            </label>
            <select
              value={selectedClassArmId}
              onChange={(e) => {
                setSelectedClassArmId(e.target.value);
                setResults([]);
                setSummary(null);
                setHasLoaded(false);
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select Class Arm</option>
              {classArms.map((ca) => (
                <option key={ca.id} value={ca.id}>
                  {ca.className} {ca.name} ({ca.programmeName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Term
            </label>
            <select
              value={selectedTermId}
              onChange={(e) => {
                setSelectedTermId(e.target.value);
                setResults([]);
                setSummary(null);
                setHasLoaded(false);
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select Term</option>
              {filteredTerms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleLoadResults}
            disabled={
              isPending || !selectedClassArmId || !selectedTermId
            }
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Load Results"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleComputeResults}
            disabled={
              isPending ||
              !selectedClassArmId ||
              !selectedTermId ||
              !selectedYearId
            }
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isPending ? "Computing..." : "Compute Results"}
          </button>
          {results.length > 0 && (
            <button
              onClick={handlePublishResults}
              disabled={isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Publish Results
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Students
            </p>
            <p className="mt-1 text-2xl font-bold">{summary.studentCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Class Average
            </p>
            <p className="mt-1 text-2xl font-bold">{summary.classAverage}%</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Highest Average
            </p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {summary.highest}%
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Lowest Average
            </p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {summary.lowest}%
            </p>
          </div>
        </div>
      )}

      {/* Status Indicator */}
      {hasLoaded && (
        <div
          className={`rounded-md px-4 py-2 text-sm ${
            results.length > 0
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-yellow-50 text-yellow-800 border border-yellow-200"
          }`}
        >
          {results.length > 0
            ? `Results computed for ${results.length} student(s). Last computed: ${new Date(results[0]?.computedAt).toLocaleString()}`
            : "No results computed for this selection. Click \"Compute Results\" to generate."}
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-3 text-center font-medium whitespace-nowrap">
                    Pos
                  </th>
                  <th className="px-3 py-3 text-left font-medium whitespace-nowrap">
                    Student ID
                  </th>
                  <th className="px-3 py-3 text-left font-medium whitespace-nowrap">
                    Student Name
                  </th>
                  {subjectColumns.map((sub) => (
                    <th
                      key={sub.id}
                      className="px-3 py-3 text-center font-medium whitespace-nowrap"
                      title={sub.name}
                    >
                      {sub.code || sub.name.substring(0, 8)}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-medium whitespace-nowrap">
                    Average
                  </th>
                  <th className="px-3 py-3 text-center font-medium whitespace-nowrap">
                    Grade
                  </th>
                  <th className="px-3 py-3 text-left font-medium whitespace-nowrap">
                    Remarks
                  </th>
                  <th className="px-3 py-3 text-right font-medium whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 text-center font-semibold">
                      {r.classPosition ?? "-"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.studentIdNumber}
                    </td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {r.studentName}
                    </td>
                    {subjectColumns.map((sub) => {
                      const sr = r.subjectResults.find(
                        (s) => s.subjectId === sub.id,
                      );
                      return (
                        <td
                          key={sub.id}
                          className="px-3 py-2 text-center"
                          title={
                            sr
                              ? `${sub.name}: ${sr.totalScore} (${sr.grade})`
                              : "N/A"
                          }
                        >
                          {sr ? (
                            <span className="text-xs">
                              {sr.totalScore?.toFixed(1)}
                              <span className="ml-0.5 text-muted-foreground">
                                ({sr.grade})
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-semibold">
                      {r.averageScore?.toFixed(1) ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getGradeColor(r.overallGrade)}`}
                      >
                        {r.overallGrade ?? "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[150px] truncate">
                      {r.teacherRemarks || "No remarks"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleOpenRemarks(r)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Remarks
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Remarks Modal */}
      {showRemarksModal && remarksTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">
                Remarks for {remarksTarget.studentName}
              </h2>
              <button
                type="button"
                onClick={() => setShowRemarksModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveRemarks} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Class Teacher Remarks
                </label>
                <textarea
                  value={teacherRemarks}
                  onChange={(e) => setTeacherRemarks(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Enter class teacher's remarks..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Headmaster Remarks
                </label>
                <textarea
                  value={headmasterRemarks}
                  onChange={(e) => setHeadmasterRemarks(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Enter headmaster's remarks..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowRemarksModal(false)}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Remarks"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Helper: Grade color coding ──────────────────────────────────────

function getGradeColor(grade: string | null): string {
  if (!grade) return "bg-gray-100 text-gray-700";
  switch (grade) {
    case "A1":
    case "B2":
    case "B3":
      return "bg-green-100 text-green-700";
    case "C4":
    case "C5":
    case "C6":
      return "bg-blue-100 text-blue-700";
    case "D7":
    case "E8":
      return "bg-yellow-100 text-yellow-700";
    case "F9":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}
