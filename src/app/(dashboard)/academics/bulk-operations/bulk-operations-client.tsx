"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  batchComputeResultsAction,
  batchComputeAnnualResultsAction,
  batchGenerateReportCardsAction,
  batchPromoteAction,
} from "@/modules/academics/actions/bulk.action";

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

type Operation =
  | "compute_terminal"
  | "compute_annual"
  | "generate_reports"
  | "promote_students";

interface ResultEntry {
  classArmId: string;
  classArmName: string;
  status: string;
  computed?: number;
  generated?: number;
  promoted?: number;
  error?: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const OPERATIONS: Array<{
  value: Operation;
  label: string;
  description: string;
  needsTerm: boolean;
}> = [
  {
    value: "compute_terminal",
    label: "Compute Terminal Results",
    description: "Compute end-of-term results for selected classes",
    needsTerm: true,
  },
  {
    value: "compute_annual",
    label: "Compute Annual Results",
    description: "Compute annual cumulative results across all terms",
    needsTerm: false,
  },
  {
    value: "generate_reports",
    label: "Generate Report Cards",
    description: "Generate printable report cards for selected classes",
    needsTerm: true,
  },
  {
    value: "promote_students",
    label: "Promote Students",
    description: "Promote students to the next academic year",
    needsTerm: false,
  },
];

// ─── Component ──────────────────────────────────────────────────────

export function BulkOperationsClient({
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

  // Selections
  const [operation, setOperation] = useState<Operation>("compute_terminal");
  const [selectedYear, setSelectedYear] = useState(
    () => academicYears.find((y) => y.isCurrent)?.id || "",
  );
  const [selectedTerm, setSelectedTerm] = useState(
    () => terms.find((t) => t.isCurrent)?.id || "",
  );
  const [selectedArms, setSelectedArms] = useState<Set<string>>(new Set());

  // Results
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [hasExecuted, setHasExecuted] = useState(false);

  // ─── Derived ──────────────────────────────────────────────────────

  const currentOp = OPERATIONS.find((o) => o.value === operation)!;
  const filteredTerms = selectedYear
    ? terms.filter((t) => t.academicYearId === selectedYear)
    : terms;

  const allSelected = classArms.length > 0 && selectedArms.size === classArms.length;

  // ─── Handlers ─────────────────────────────────────────────────────

  function toggleArm(id: string) {
    setSelectedArms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedArms(new Set());
    } else {
      setSelectedArms(new Set(classArms.map((c) => c.id)));
    }
  }

  function handleExecute() {
    if (!selectedYear) {
      toast.error("Please select an academic year.");
      return;
    }
    if (currentOp.needsTerm && !selectedTerm) {
      toast.error("Please select a term.");
      return;
    }
    if (selectedArms.size === 0) {
      toast.error("Please select at least one class.");
      return;
    }

    const armIds = Array.from(selectedArms);
    const armNameMap = new Map(classArms.map((c) => [c.id, `${c.className} - ${c.name}`]));

    startTransition(async () => {
      setResults([]);
      setHasExecuted(true);

      let resultItems: Array<{ classArmId: string; status: string; computed?: number; error?: string }> = [];
      let errorMsg: string | undefined;

      switch (operation) {
        case "compute_terminal": {
          const r = await batchComputeResultsAction(armIds, selectedTerm, selectedYear);
          errorMsg = "error" in r ? r.error : undefined;
          resultItems = "data" in r ? r.data?.results ?? [] : [];
          break;
        }
        case "compute_annual": {
          const r = await batchComputeAnnualResultsAction(armIds, selectedYear);
          errorMsg = "error" in r ? r.error : undefined;
          resultItems = "data" in r ? r.data?.results ?? [] : [];
          break;
        }
        case "generate_reports": {
          const r = await batchGenerateReportCardsAction(armIds, selectedTerm);
          errorMsg = "error" in r ? r.error : undefined;
          if (!("error" in r)) {
            resultItems = armIds.map((id) => ({ classArmId: id, status: "success", computed: Array.isArray(r.data) ? r.data.length : 0 }));
          }
          break;
        }
        case "promote_students": {
          const r = await batchPromoteAction(armIds, selectedYear);
          errorMsg = "error" in r ? r.error : undefined;
          if ("data" in r && r.data) {
            resultItems = armIds.map((id) => ({ classArmId: id, status: "success", computed: r.data!.totalPromoted + r.data!.totalRetained + r.data!.totalGraduated }));
          }
          break;
        }
      }

      const response = { data: resultItems, error: errorMsg };

      if (response?.error) {
        toast.error(response.error);
        return;
      }

      if (response?.data) {
        const mapped: ResultEntry[] = response.data.map((r) => ({
          ...r,
          classArmName: armNameMap.get(r.classArmId) || r.classArmId,
        }));
        setResults(mapped);

        const successCount = mapped.filter(
          (r) => r.status === "success",
        ).length;
        const errorCount = mapped.filter((r) => r.status === "error").length;

        if (errorCount === 0) {
          toast.success(
            `Operation completed: ${successCount} class(es) processed.`,
          );
        } else {
          toast.warning(
            `Completed with issues: ${successCount} success, ${errorCount} error(s).`,
          );
        }
        router.refresh();
      }
    });
  }

  // ─── Summary stats ────────────────────────────────────────────────

  const totalComputed = results.reduce(
    (sum, r) => sum + (r.computed ?? r.generated ?? r.promoted ?? 0),
    0,
  );
  const errorCount = results.filter((r) => r.status === "error").length;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Operation Selector */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold mb-4">Select Operation</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {OPERATIONS.map((op) => (
            <label
              key={op.value}
              className={`flex cursor-pointer flex-col rounded-lg border p-4 transition-colors ${
                operation === op.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="operation"
                  value={op.value}
                  checked={operation === op.value}
                  onChange={() => setOperation(op.value)}
                  className="text-primary"
                />
                <span className="text-sm font-medium">{op.label}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground pl-6">
                {op.description}
              </p>
            </label>
          ))}
        </div>
      </div>

      {/* Year & Term Selectors */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold mb-4">Academic Period</h3>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Academic Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedTerm("");
              }}
              className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select year</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>
          {currentOp.needsTerm && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Term
              </label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select term</option>
                {filteredTerms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.isCurrent ? "(Current)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Class Arm Selection */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">
            Select Classes ({selectedArms.size} of {classArms.length} selected)
          </h3>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs font-medium text-primary hover:underline"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        </div>
        {classArms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No class arms available.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {classArms.map((arm) => (
              <label
                key={arm.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  selectedArms.has(arm.id)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedArms.has(arm.id)}
                  onChange={() => toggleArm(arm.id)}
                  className="text-primary rounded"
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {arm.className} - {arm.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {arm.programmeName}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Execute Button */}
      <div className="flex justify-end">
        <button
          onClick={handleExecute}
          disabled={isPending || selectedArms.size === 0}
          className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Processing..." : `Execute: ${currentOp.label}`}
        </button>
      </div>

      {/* Results Panel */}
      {hasExecuted && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-sm font-semibold">Results</h3>
          </div>
          {results.length === 0 && isPending ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              Processing... please wait.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">
                        Class
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        Status
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        Count
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr
                        key={r.classArmId}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">
                          {r.classArmName}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              r.status === "success"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {r.status === "success" ? "Success" : "Error"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.computed ?? r.generated ?? r.promoted ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {r.error || "Completed successfully"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="border-t border-border px-6 py-4 bg-muted/30">
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total processed: </span>
                    <span className="font-semibold">{totalComputed}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Successful: </span>
                    <span className="font-semibold text-emerald-600">
                      {results.length - errorCount}
                    </span>
                  </div>
                  {errorCount > 0 && (
                    <div>
                      <span className="text-muted-foreground">Errors: </span>
                      <span className="font-semibold text-red-600">
                        {errorCount}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
