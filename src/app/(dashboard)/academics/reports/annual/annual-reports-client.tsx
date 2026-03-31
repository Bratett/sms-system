"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  computeAnnualResultsAction,
  getAnnualResultsAction,
} from "@/modules/academics/actions/annual-result.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ClassArm {
  id: string;
  name: string;
  className: string;
  programmeName: string;
}

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface SubjectAnnualResult {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  term1Score: number | null;
  term2Score: number | null;
  term3Score: number | null;
  averageScore: number | null;
  grade: string | null;
  interpretation: string | null;
  position: number | null;
}

interface AnnualResult {
  id: string;
  studentId: string;
  studentIdNumber: string;
  studentName: string;
  classArmId: string;
  academicYearId: string;
  totalScore: number | null;
  averageScore: number | null;
  classPosition: number | null;
  overallGrade: string | null;
  subjectCount: number | null;
  promotionStatus: string | null;
  computedAt: Date | string | null;
  subjectResults: SubjectAnnualResult[];
}

// ─── Helpers ────────────────────────────────────────────────────────

function gradeColorClass(grade: string | null): string {
  if (!grade) return "text-muted-foreground";
  const g = grade.toUpperCase();
  if (g === "A1" || g === "B2" || g === "B3") return "text-emerald-600 font-semibold";
  if (g === "C4" || g === "C5" || g === "C6") return "text-blue-600 font-semibold";
  if (g === "D7" || g === "E8") return "text-amber-600 font-semibold";
  if (g === "F9") return "text-red-600 font-semibold";
  return "text-foreground";
}

// ─── Component ──────────────────────────────────────────────────────

export function AnnualReportsClient({
  classArms,
  academicYears,
}: {
  classArms: ClassArm[];
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

  // Data
  const [results, setResults] = useState<AnnualResult[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Derive unique subjects from results for dynamic columns
  const subjectColumns: { subjectId: string; subjectName: string; subjectCode: string | null }[] = [];
  if (results.length > 0) {
    const seen = new Set<string>();
    for (const r of results) {
      for (const sr of r.subjectResults) {
        if (!seen.has(sr.subjectId)) {
          seen.add(sr.subjectId);
          subjectColumns.push({
            subjectId: sr.subjectId,
            subjectName: sr.subjectName,
            subjectCode: sr.subjectCode,
          });
        }
      }
    }
  }

  // ─── Compute Annual Results ─────────────────────────────────────────

  function handleCompute() {
    if (!selectedClassArmId || !selectedYearId) {
      toast.error("Please select a class arm and academic year.");
      return;
    }

    startTransition(async () => {
      const result = await computeAnnualResultsAction(
        selectedClassArmId,
        selectedYearId,
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Annual results computed successfully.");
      router.refresh();
      // Auto-load after computing
      handleLoadResults();
    });
  }

  // ─── Load Results ──────────────────────────────────────────────────

  function handleLoadResults() {
    if (!selectedClassArmId || !selectedYearId) {
      toast.error("Please select a class arm and academic year.");
      return;
    }

    startTransition(async () => {
      const result = await getAnnualResultsAction(
        selectedClassArmId,
        selectedYearId,
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data && result.data.length > 0) {
        setResults(result.data);
        setIsLoaded(true);
        toast.success(`Loaded ${result.data.length} result(s).`);
      } else {
        setResults([]);
        setIsLoaded(true);
        toast.warning("No annual results found for this selection.");
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────

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
                setResults([]);
                setIsLoaded(false);
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
                setIsLoaded(false);
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

          <button
            onClick={handleCompute}
            disabled={isPending || !selectedClassArmId || !selectedYearId}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Computing..." : "Compute Annual Results"}
          </button>

          <button
            onClick={handleLoadResults}
            disabled={isPending || !selectedClassArmId || !selectedYearId}
            className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Load Results"}
          </button>
        </div>
      </div>

      {/* Results Table */}
      {isLoaded && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {results.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground">
              No annual results found. Try computing results first.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="sticky left-0 z-10 bg-muted/30 w-12 px-3 py-3 text-center font-medium">
                      Pos
                    </th>
                    <th className="sticky left-12 z-10 bg-muted/30 px-3 py-3 text-left font-medium min-w-[180px]">
                      Student Name
                    </th>
                    {subjectColumns.map((sub) => (
                      <th
                        key={sub.subjectId}
                        colSpan={5}
                        className="px-1 py-2 text-center font-medium border-l border-border"
                      >
                        <div className="text-xs">{sub.subjectCode ?? sub.subjectName}</div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center font-medium border-l border-border">
                      Overall Avg
                    </th>
                    <th className="px-3 py-3 text-center font-medium">
                      Overall Grade
                    </th>
                  </tr>
                  <tr className="border-b border-border bg-muted/20 text-xs">
                    <th className="sticky left-0 z-10 bg-muted/20" />
                    <th className="sticky left-12 z-10 bg-muted/20" />
                    {subjectColumns.map((sub) => (
                      <Fragment key={`header-${sub.subjectId}`}>
                        <th className="px-1 py-1 text-center font-normal border-l border-border">T1</th>
                        <th className="px-1 py-1 text-center font-normal">T2</th>
                        <th className="px-1 py-1 text-center font-normal">T3</th>
                        <th className="px-1 py-1 text-center font-normal">Avg</th>
                        <th className="px-1 py-1 text-center font-normal">Grd</th>
                      </Fragment>
                    ))}
                    <th className="border-l border-border" />
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, idx) => {
                    const subjectMap = new Map(
                      r.subjectResults.map((sr) => [sr.subjectId, sr]),
                    );

                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-border last:border-0 ${
                          idx % 2 === 0 ? "" : "bg-muted/10"
                        }`}
                      >
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 text-center font-semibold">
                          {r.classPosition ?? "-"}
                        </td>
                        <td className="sticky left-12 z-10 bg-card px-3 py-2 font-medium whitespace-nowrap">
                          {r.studentName}
                        </td>
                        {subjectColumns.map((sub) => {
                          const sr = subjectMap.get(sub.subjectId);
                          return (
                            <Fragment key={`${r.id}-${sub.subjectId}`}>
                              <td className="px-1 py-2 text-center text-xs border-l border-border">
                                {sr?.term1Score?.toFixed(1) ?? "-"}
                              </td>
                              <td className="px-1 py-2 text-center text-xs">
                                {sr?.term2Score?.toFixed(1) ?? "-"}
                              </td>
                              <td className="px-1 py-2 text-center text-xs">
                                {sr?.term3Score?.toFixed(1) ?? "-"}
                              </td>
                              <td className="px-1 py-2 text-center text-xs font-medium">
                                {sr?.averageScore?.toFixed(1) ?? "-"}
                              </td>
                              <td className={`px-1 py-2 text-center text-xs ${gradeColorClass(sr?.grade ?? null)}`}>
                                {sr?.grade ?? "-"}
                              </td>
                            </Fragment>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-semibold border-l border-border">
                          {r.averageScore?.toFixed(1) ?? "-"}
                        </td>
                        <td className={`px-3 py-2 text-center ${gradeColorClass(r.overallGrade)}`}>
                          {r.overallGrade ?? "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {isLoaded && results.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="text-sm font-semibold mb-3">Class Summary</h4>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{results.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Students</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {(
                  results.reduce((acc, r) => acc + (r.averageScore ?? 0), 0) /
                  results.filter((r) => r.averageScore !== null).length
                ).toFixed(1) || "-"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Class Average</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {Math.max(...results.map((r) => r.averageScore ?? 0)).toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Highest Average</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {Math.min(
                  ...results
                    .filter((r) => r.averageScore !== null)
                    .map((r) => r.averageScore!),
                ).toFixed(1) || "-"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Lowest Average</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

