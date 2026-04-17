"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateBroadsheetAction } from "@/modules/academics/actions/broadsheet.action";

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

interface BroadsheetSubject {
  id: string;
  name: string;
  code: string | null;
}

interface BroadsheetStudent {
  studentDbId: string;
  studentId: string;
  name: string;
  position: number | null;
  average: number | null;
  grade: string | null;
  totalScore: number | null;
  scores: Record<string, { total: number | null; grade: string | null }>;
}

interface BroadsheetData {
  subjects: BroadsheetSubject[];
  students: BroadsheetStudent[];
  subjectAverages: Record<string, number>;
  classSize: number;
}

// ─── Component ──────────────────────────────────────────────────────

export function BroadsheetClient({
  classArms,
  terms,
  academicYears,
}: {
  classArms: ClassArm[];
  terms: Term[];
  academicYears: AcademicYear[];
}) {
  const [isPending, startTransition] = useTransition();

  // Filters
  const currentYear = academicYears.find((ay) => ay.isCurrent);
  const [selectedYearId, setSelectedYearId] = useState<string>(
    currentYear?.id ?? "",
  );
  const [selectedClassArmId, setSelectedClassArmId] = useState<string>("");
  const [selectedTermId, setSelectedTermId] = useState<string>("");

  // Data
  const [broadsheet, setBroadsheet] = useState<BroadsheetData | null>(null);

  // Filter terms by academic year
  const filteredTerms = terms.filter(
    (t) => t.academicYearId === selectedYearId,
  );

  // Selected class arm label for display
  const selectedClassArm = classArms.find(
    (ca) => ca.id === selectedClassArmId,
  );
  const selectedTerm = filteredTerms.find((t) => t.id === selectedTermId);

  // ─── Generate Broadsheet ──────────────────────────────────────────

  function handleGenerateBroadsheet() {
    if (!selectedClassArmId || !selectedTermId) {
      toast.error("Please select a class arm and term.");
      return;
    }

    startTransition(async () => {
      const result = await generateBroadsheetAction(
        selectedClassArmId,
        selectedTermId,
      );

      if ("error" in result) {
        toast.error(result.error);
        setBroadsheet(null);
        return;
      }

      if ("data" in result) {
        setBroadsheet(result.data);
        toast.success(
          `Broadsheet generated for ${result.data.students.length} student(s).`,
        );
      }
    });
  }

  // ─── Export Placeholder ───────────────────────────────────────────

  function handleExportExcel() {
    toast.info(
      "Excel export will be available in a future update.",
    );
  }

  // ─── Print ────────────────────────────────────────────────────────

  function handlePrint() {
    window.print();
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
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
                setBroadsheet(null);
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
                setBroadsheet(null);
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
                setBroadsheet(null);
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
            onClick={handleGenerateBroadsheet}
            disabled={
              isPending || !selectedClassArmId || !selectedTermId
            }
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Generating..." : "Generate Broadsheet"}
          </button>
        </div>

        {broadsheet && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Export to Excel
            </button>
            <button
              onClick={handlePrint}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Print
            </button>
          </div>
        )}
      </div>

      {/* Broadsheet Table */}
      {broadsheet && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Title for print */}
          <div className="hidden print:block text-center py-4">
            <h2 className="text-lg font-bold uppercase">Broadsheet</h2>
            {selectedClassArm && (
              <p className="text-sm">
                {selectedClassArm.className} {selectedClassArm.name} -{" "}
                {selectedClassArm.programmeName}
              </p>
            )}
            {selectedTerm && (
              <p className="text-sm">
                {selectedTerm.name} - {selectedTerm.academicYearName}
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="border border-gray-600 px-2 py-2 text-center font-medium whitespace-nowrap sticky left-0 bg-gray-800 z-10">
                    Pos
                  </th>
                  <th className="border border-gray-600 px-2 py-2 text-left font-medium whitespace-nowrap sticky left-[40px] bg-gray-800 z-10">
                    Student ID
                  </th>
                  <th className="border border-gray-600 px-2 py-2 text-left font-medium whitespace-nowrap sticky left-[130px] bg-gray-800 z-10">
                    Student Name
                  </th>
                  {broadsheet.subjects.map((sub) => (
                    <th
                      key={sub.id}
                      className="border border-gray-600 px-2 py-2 text-center font-medium whitespace-nowrap"
                      title={sub.name}
                    >
                      {sub.code || sub.name.substring(0, 10)}
                    </th>
                  ))}
                  <th className="border border-gray-600 px-2 py-2 text-center font-medium whitespace-nowrap bg-gray-900">
                    Average
                  </th>
                  <th className="border border-gray-600 px-2 py-2 text-center font-medium whitespace-nowrap bg-gray-900">
                    Grade
                  </th>
                </tr>
              </thead>
              <tbody>
                {broadsheet.students.map((student, i) => (
                  <tr
                    key={student.studentDbId}
                    className={
                      i % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }
                  >
                    <td className="border border-gray-300 px-2 py-1.5 text-center font-semibold sticky left-0 bg-inherit z-10">
                      {student.position ?? "-"}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 font-mono sticky left-[40px] bg-inherit z-10">
                      {student.studentId}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 font-medium whitespace-nowrap sticky left-[130px] bg-inherit z-10">
                      {student.name}
                    </td>
                    {broadsheet.subjects.map((sub) => {
                      const score = student.scores[sub.id];
                      return (
                        <td
                          key={sub.id}
                          className={`border border-gray-300 px-2 py-1.5 text-center ${getGradeCellColor(score?.grade ?? null)}`}
                        >
                          {score?.total != null ? (
                            <span>
                              {score.total.toFixed(1)}
                              <span className="ml-0.5 text-[10px] opacity-70">
                                ({score.grade})
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-gray-300 px-2 py-1.5 text-center font-bold bg-gray-100">
                      {student.average?.toFixed(1) ?? "-"}
                    </td>
                    <td
                      className={`border border-gray-300 px-2 py-1.5 text-center font-bold ${getGradeCellColor(student.grade)}`}
                    >
                      {student.grade ?? "-"}
                    </td>
                  </tr>
                ))}

                {/* Summary Row */}
                <tr className="bg-gray-200 font-semibold">
                  <td
                    colSpan={3}
                    className="border border-gray-300 px-2 py-2 text-right sticky left-0 bg-gray-200 z-10"
                  >
                    Subject Averages:
                  </td>
                  {broadsheet.subjects.map((sub) => (
                    <td
                      key={sub.id}
                      className="border border-gray-300 px-2 py-2 text-center"
                    >
                      {broadsheet.subjectAverages[sub.id]?.toFixed(1) ?? "-"}
                    </td>
                  ))}
                  <td className="border border-gray-300 px-2 py-2 text-center bg-gray-300">
                    ---
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center bg-gray-300">
                    ---
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer info */}
          <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border print:hidden">
            Total students: {broadsheet.classSize} | Total subjects:{" "}
            {broadsheet.subjects.length}
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          @page {
            margin: 5mm;
            size: A4 landscape;
          }
          table {
            font-size: 8px !important;
          }
        }
      `}</style>
    </>
  );
}

// ─── Helper: Grade cell color ───────────────────────────────────────

function getGradeCellColor(grade: string | null): string {
  if (!grade) return "";
  switch (grade) {
    case "A1":
    case "B2":
    case "B3":
      return "bg-green-50 text-green-800";
    case "C4":
    case "C5":
    case "C6":
      return "bg-blue-50 text-blue-800";
    case "D7":
    case "E8":
      return "bg-yellow-50 text-yellow-800";
    case "F9":
      return "bg-red-50 text-red-800";
    default:
      return "";
  }
}
