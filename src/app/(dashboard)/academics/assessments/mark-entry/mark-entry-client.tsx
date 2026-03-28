"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  getMarkEntryDataAction,
  enterMarksAction,
  submitMarksForApprovalAction,
} from "@/modules/academics/actions/mark.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Subject {
  id: string;
  name: string;
  code: string | null;
  type: string;
}

interface ClassArmOption {
  id: string;
  name: string;
  className: string;
  programmeName: string;
}

interface AssessmentTypeOption {
  id: string;
  name: string;
  code: string | null;
  category: string;
  weight: number;
  maxScore: number;
  termId: string | null;
}

interface TermOption {
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

interface Dropdowns {
  subjects: Subject[];
  classArms: ClassArmOption[];
  assessmentTypes: AssessmentTypeOption[];
  terms: TermOption[];
  academicYears: AcademicYear[];
}

interface StudentEntry {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  fullName: string;
}

interface MarkData {
  id: string;
  score: number;
  status: string;
}

interface MarkEntryRow {
  student: StudentEntry;
  score: string;
  existingMark: MarkData | null;
}

// ─── Component ──────────────────────────────────────────────────────

export function MarkEntryClient({ dropdowns }: { dropdowns: Dropdowns }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Step 1: Selection
  const currentTerm = dropdowns.terms.find((t) => t.isCurrent);
  const currentYear = dropdowns.academicYears.find((ay) => ay.isCurrent);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedClassArmId, setSelectedClassArmId] = useState("");
  const [selectedAssessmentTypeId, setSelectedAssessmentTypeId] = useState("");
  const [selectedTermId, setSelectedTermId] = useState(currentTerm?.id ?? "");

  // Step 2: Mark entry data
  const [rows, setRows] = useState<MarkEntryRow[]>([]);
  const [assessmentInfo, setAssessmentInfo] = useState<{
    name: string;
    maxScore: number;
    category: string;
    weight: number;
  } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Derive academicYearId from selected term
  const selectedTerm = dropdowns.terms.find((t) => t.id === selectedTermId);
  const academicYearId = selectedTerm?.academicYearId ?? currentYear?.id ?? "";

  // Filter assessment types by selected term
  const filteredAssessmentTypes = dropdowns.assessmentTypes.filter(
    (at) => !at.termId || at.termId === selectedTermId,
  );

  const canLoad =
    selectedSubjectId &&
    selectedClassArmId &&
    selectedAssessmentTypeId &&
    selectedTermId;

  // ─── Load mark entry data ─────────────────────────────────────────

  const handleLoadData = useCallback(() => {
    if (!canLoad) return;
    setLoadError(null);

    startTransition(async () => {
      const result = await getMarkEntryDataAction(
        selectedSubjectId,
        selectedClassArmId,
        selectedAssessmentTypeId,
        selectedTermId,
      );

      if (result.error) {
        setLoadError(result.error);
        setIsLoaded(false);
        return;
      }

      if (result.data) {
        const { assessmentType, students, marks } = result.data;
        setAssessmentInfo(assessmentType);

        const entryRows: MarkEntryRow[] = students.map((student) => {
          const existingMark = marks[student.id] ?? null;
          return {
            student,
            score: existingMark ? String(existingMark.score) : "",
            existingMark,
          };
        });

        setRows(entryRows);
        setIsLoaded(true);
      }
    });
  }, [canLoad, selectedSubjectId, selectedClassArmId, selectedAssessmentTypeId, selectedTermId]);

  // ─── Score change handler ─────────────────────────────────────────

  function handleScoreChange(index: number, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], score: value };
      return next;
    });
  }

  // ─── Save as Draft ────────────────────────────────────────────────

  function handleSaveAsDraft() {
    const marksToSave = rows
      .filter((r) => r.score !== "")
      .map((r) => ({
        studentId: r.student.id,
        score: parseFloat(r.score),
      }));

    if (marksToSave.length === 0) {
      toast.error("No marks to save. Please enter at least one score.");
      return;
    }

    // Validate scores
    const maxScore = assessmentInfo?.maxScore ?? 100;
    const invalid = marksToSave.filter((m) => isNaN(m.score) || m.score < 0 || m.score > maxScore);
    if (invalid.length > 0) {
      toast.error(`${invalid.length} score(s) are invalid. Scores must be between 0 and ${maxScore}.`);
      return;
    }

    startTransition(async () => {
      const result = await enterMarksAction({
        subjectId: selectedSubjectId,
        classArmId: selectedClassArmId,
        assessmentTypeId: selectedAssessmentTypeId,
        termId: selectedTermId,
        academicYearId,
        marks: marksToSave,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.data?.count} mark(s) saved as draft.`);
        // Reload data to reflect updated statuses
        handleLoadData();
      }
    });
  }

  // ─── Submit for Approval ──────────────────────────────────────────

  function handleSubmitForApproval() {
    // First save, then submit
    const marksToSave = rows
      .filter((r) => r.score !== "")
      .map((r) => ({
        studentId: r.student.id,
        score: parseFloat(r.score),
      }));

    if (marksToSave.length === 0) {
      toast.error("No marks to submit. Please enter at least one score.");
      return;
    }

    const maxScore = assessmentInfo?.maxScore ?? 100;
    const invalid = marksToSave.filter((m) => isNaN(m.score) || m.score < 0 || m.score > maxScore);
    if (invalid.length > 0) {
      toast.error(`${invalid.length} score(s) are invalid. Fix them before submitting.`);
      return;
    }

    if (!confirm("Are you sure you want to submit these marks for approval? You won't be able to edit them until they are reviewed.")) {
      return;
    }

    startTransition(async () => {
      // Save first
      const saveResult = await enterMarksAction({
        subjectId: selectedSubjectId,
        classArmId: selectedClassArmId,
        assessmentTypeId: selectedAssessmentTypeId,
        termId: selectedTermId,
        academicYearId,
        marks: marksToSave,
      });

      if (saveResult.error) {
        toast.error(saveResult.error);
        return;
      }

      // Then submit
      const submitResult = await submitMarksForApprovalAction(
        selectedSubjectId,
        selectedClassArmId,
        selectedAssessmentTypeId,
        selectedTermId,
      );

      if (submitResult.error) {
        toast.error(submitResult.error);
      } else {
        toast.success(`${submitResult.data?.count} mark(s) submitted for approval.`);
        handleLoadData();
      }
    });
  }

  // ─── Summary calculations ─────────────────────────────────────────

  const filledRows = rows.filter((r) => r.score !== "" && !isNaN(parseFloat(r.score)));
  const scores = filledRows.map((r) => parseFloat(r.score));
  const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Step 1: Selection */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-sm font-semibold mb-4">Step 1: Select Assessment</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setIsLoaded(false);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select subject</option>
              {dropdowns.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Class Arm <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedClassArmId}
              onChange={(e) => {
                setSelectedClassArmId(e.target.value);
                setIsLoaded(false);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select class arm</option>
              {dropdowns.classArms.map((ca) => (
                <option key={ca.id} value={ca.id}>
                  {ca.className} {ca.name} ({ca.programmeName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Assessment Type <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedAssessmentTypeId}
              onChange={(e) => {
                setSelectedAssessmentTypeId(e.target.value);
                setIsLoaded(false);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select assessment type</option>
              {filteredAssessmentTypes.map((at) => (
                <option key={at.id} value={at.id}>
                  {at.name} ({at.category.replace(/_/g, " ")}) - Max: {at.maxScore}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Term <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTermId}
              onChange={(e) => {
                setSelectedTermId(e.target.value);
                setIsLoaded(false);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select term</option>
              {dropdowns.terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.academicYearName}) {t.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={handleLoadData}
            disabled={!canLoad || isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Load Students"}
          </button>
        </div>

        {loadError && (
          <div className="mt-3 rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
            {loadError}
          </div>
        )}
      </div>

      {/* Step 2: Mark Entry Grid */}
      {isLoaded && assessmentInfo && (
        <>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-muted/50 px-6 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  Step 2: Enter Marks - {assessmentInfo.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Max Score: {assessmentInfo.maxScore} | Category: {assessmentInfo.category.replace(/_/g, " ")} | Weight: {assessmentInfo.weight}%
                </p>
              </div>
              <span className="text-sm text-muted-foreground">
                {rows.length} student(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="w-12 px-4 py-3 text-center font-medium">#</th>
                    <th className="px-4 py-3 text-left font-medium">Student ID</th>
                    <th className="px-4 py-3 text-left font-medium">Student Name</th>
                    <th className="w-40 px-4 py-3 text-center font-medium">
                      Score (0 - {assessmentInfo.maxScore})
                    </th>
                    <th className="w-28 px-4 py-3 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No students enrolled in this class arm.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
                      const scoreNum = parseFloat(row.score);
                      const isFilled = row.score !== "" && !isNaN(scoreNum);
                      const isOverMax = isFilled && scoreNum > assessmentInfo.maxScore;
                      const isNegative = isFilled && scoreNum < 0;
                      const isInvalid = isOverMax || isNegative;

                      let rowBg = "";
                      if (isInvalid) {
                        rowBg = "bg-red-50";
                      } else if (isFilled) {
                        rowBg = "bg-green-50";
                      }

                      return (
                        <tr
                          key={row.student.id}
                          className={`border-b border-border last:border-0 ${rowBg}`}
                        >
                          <td className="px-4 py-2 text-center text-muted-foreground">
                            {index + 1}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                            {row.student.studentId}
                          </td>
                          <td className="px-4 py-2 font-medium">
                            {row.student.fullName}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="number"
                              min={0}
                              max={assessmentInfo.maxScore}
                              step={0.5}
                              value={row.score}
                              onChange={(e) => handleScoreChange(index, e.target.value)}
                              disabled={row.existingMark?.status === "APPROVED" || row.existingMark?.status === "SUBMITTED"}
                              className={`w-24 rounded-md border px-3 py-1.5 text-sm text-center ${
                                isInvalid
                                  ? "border-red-400 bg-red-50 text-red-700"
                                  : "border-input bg-background"
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              placeholder="---"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            {row.existingMark ? (
                              <StatusBadge status={row.existingMark.status} />
                            ) : (
                              <span className="text-xs text-muted-foreground">New</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="text-sm font-semibold mb-3">Summary</h4>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {filledRows.length}/{rows.length}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Marks Entered</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {averageScore.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Average Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {highestScore || "---"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Highest Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {scores.length > 0 ? lowestScore : "---"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Lowest Score</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleSaveAsDraft}
              disabled={isPending || filledRows.length === 0}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save as Draft"}
            </button>
            <button
              onClick={handleSubmitForApproval}
              disabled={isPending || filledRows.length === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Submitting..." : "Submit for Approval"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
