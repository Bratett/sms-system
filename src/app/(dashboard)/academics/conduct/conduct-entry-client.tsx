"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getClassConductAction,
  batchUpsertConductAction,
} from "@/modules/academics/actions/conduct.action";

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

// ─── Constants ──────────────────────────────────────────────────────

const CONDUCT_TRAITS = [
  { key: "punctuality", label: "Punctuality" },
  { key: "attendance", label: "Attendance" },
  { key: "attentiveness", label: "Attentiveness" },
  { key: "neatness", label: "Neatness" },
  { key: "politeness", label: "Politeness" },
  { key: "honesty", label: "Honesty" },
  { key: "selfControl", label: "Self Control" },
  { key: "relationship", label: "Relationship" },
  { key: "initiative", label: "Initiative" },
] as const;

const CONDUCT_OPTIONS = [
  "EXCELLENT",
  "VERY_GOOD",
  "GOOD",
  "AVERAGE",
  "BELOW_AVERAGE",
  "POOR",
] as const;

type ConductRecord = Record<string, string>;

interface StudentRow {
  studentId: string;
  studentIdNumber: string;
  studentName: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function ConductEntryClient({
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
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [selectedClassArmId, setSelectedClassArmId] = useState<string>("");

  // Data
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [conductData, setConductData] = useState<Map<string, ConductRecord>>(
    new Map(),
  );
  const [isLoaded, setIsLoaded] = useState(false);

  // Filter terms by academic year
  const filteredTerms = terms.filter(
    (t) => t.academicYearId === selectedYearId,
  );

  // ─── Load Students ────────────────────────────────────────────────

  function handleLoadStudents() {
    if (!selectedClassArmId || !selectedTermId) {
      toast.error("Please select a class arm and term.");
      return;
    }

    startTransition(async () => {
      const result = await getClassConductAction(
        selectedClassArmId,
        selectedTermId,
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if ("data" in result && result.data.length > 0) {
        const studentRows: StudentRow[] = [];
        const newConductData = new Map<string, ConductRecord>();

        for (const item of result.data) {
          studentRows.push({
            studentId: item.studentId,
            studentIdNumber: item.studentIdNumber,
            studentName: item.studentName,
          });

          const record: ConductRecord = {};
          if (item.conduct) {
            for (const trait of CONDUCT_TRAITS) {
              const val = item.conduct[trait.key as keyof typeof item.conduct];
              record[trait.key] = typeof val === "string" ? val : "GOOD";
            }
          } else {
            for (const trait of CONDUCT_TRAITS) {
              record[trait.key] = "GOOD";
            }
          }
          newConductData.set(item.studentId, record);
        }

        setStudents(studentRows);
        setConductData(newConductData);
        setIsLoaded(true);
        toast.success(`Loaded ${studentRows.length} student(s).`);
      } else {
        setStudents([]);
        setConductData(new Map());
        setIsLoaded(true);
        toast.warning("No students found for this selection.");
      }
    });
  }

  // ─── Update Cell ──────────────────────────────────────────────────

  function handleCellChange(
    studentId: string,
    traitKey: string,
    value: string,
  ) {
    setConductData((prev) => {
      const next = new Map(prev);
      const record = { ...(next.get(studentId) ?? {}) };
      record[traitKey] = value;
      next.set(studentId, record);
      return next;
    });
  }

  // ─── Save All ─────────────────────────────────────────────────────

  function handleSaveAll() {
    if (!selectedClassArmId || !selectedTermId || !selectedYearId) {
      toast.error("Please ensure all filters are selected.");
      return;
    }

    const records = students.map((s) => {
      const record = conductData.get(s.studentId) ?? {};
      return {
        studentId: s.studentId,
        ...record,
      };
    });

    startTransition(async () => {
      const result = await batchUpsertConductAction(
        records,
        selectedClassArmId,
        selectedTermId,
        selectedYearId,
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if ("data" in result) {
        toast.success(`Saved conduct for ${result.data.saved} student(s).`);
        if (result.data.errors.length > 0) {
          for (const err of result.data.errors) {
            toast.warning(err);
          }
        }
      }

      router.refresh();
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
                setSelectedTermId("");
                setStudents([]);
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
              Term
            </label>
            <select
              value={selectedTermId}
              onChange={(e) => {
                setSelectedTermId(e.target.value);
                setStudents([]);
                setIsLoaded(false);
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

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Class Arm
            </label>
            <select
              value={selectedClassArmId}
              onChange={(e) => {
                setSelectedClassArmId(e.target.value);
                setStudents([]);
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
            onClick={handleLoadStudents}
            disabled={isPending || !selectedClassArmId || !selectedTermId}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Load Students"}
          </button>
        </div>

        {isLoaded && students.length > 0 && (
          <button
            onClick={handleSaveAll}
            disabled={isPending}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save All"}
          </button>
        )}
      </div>

      {/* Conduct Grid */}
      {isLoaded && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {students.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground">
              No students found for this selection.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="sticky left-0 z-10 bg-muted/30 w-12 px-3 py-3 text-center font-medium">
                      #
                    </th>
                    <th className="sticky left-12 z-10 bg-muted/30 px-3 py-3 text-left font-medium min-w-[180px]">
                      Student Name
                    </th>
                    {CONDUCT_TRAITS.map((trait) => (
                      <th
                        key={trait.key}
                        className="px-2 py-3 text-center font-medium min-w-[130px]"
                      >
                        {trait.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => {
                    const record = conductData.get(student.studentId) ?? {};

                    return (
                      <tr
                        key={student.studentId}
                        className={`border-b border-border last:border-0 ${
                          idx % 2 === 0 ? "" : "bg-muted/10"
                        }`}
                      >
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 text-center text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="sticky left-12 z-10 bg-card px-3 py-2 font-medium whitespace-nowrap">
                          {student.studentName}
                        </td>
                        {CONDUCT_TRAITS.map((trait) => (
                          <td key={trait.key} className="px-1 py-1 text-center">
                            <select
                              value={record[trait.key] ?? "GOOD"}
                              onChange={(e) =>
                                handleCellChange(
                                  student.studentId,
                                  trait.key,
                                  e.target.value,
                                )
                              }
                              className="w-full rounded-md border border-input bg-background px-1.5 py-1 text-xs"
                            >
                              {CONDUCT_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt.replace(/_/g, " ")}
                                </option>
                              ))}
                            </select>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      {isLoaded && students.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {students.length} student(s) loaded. Make changes in the grid
              above and click &quot;Save All&quot; to persist.
            </span>
            <span className="text-xs text-muted-foreground">
              {CONDUCT_TRAITS.length} traits per student
            </span>
          </div>
        </div>
      )}
    </>
  );
}
