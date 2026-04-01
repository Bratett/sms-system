"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { bulkInitializeLeaveBalancesAction } from "@/modules/hr/actions/leave.action";

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface StaffRow {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  staffType: string;
  departmentName: string | null;
}

export function BulkLeaveClient({
  academicYears,
  staff,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  academicYears: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  staff: any[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedYear, setSelectedYear] = useState(() => {
    const current = academicYears.find((y: AcademicYear) => y.isCurrent);
    return current?.id || "";
  });
  const [mode, setMode] = useState<"all" | "selected">("all");
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{
    staffCount: number;
    created: number;
    skipped: number;
  } | null>(null);

  function toggleStaff(id: string) {
    setSelectedStaff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedStaff.size === staff.length) {
      setSelectedStaff(new Set());
    } else {
      setSelectedStaff(new Set(staff.map((s: StaffRow) => s.id)));
    }
  }

  function handleInitialize() {
    if (!selectedYear) {
      toast.error("Please select an academic year.");
      return;
    }

    if (mode === "selected" && selectedStaff.size === 0) {
      toast.error("Please select at least one staff member.");
      return;
    }

    startTransition(async () => {
      const staffIds = mode === "selected" ? Array.from(selectedStaff) : undefined;
      const res = await bulkInitializeLeaveBalancesAction(selectedYear, staffIds);

      if ("error" in res) {
        toast.error(res.error);
      } else if (res.data) {
        setResult(res.data);
        toast.success(
          `Initialized ${res.data.created} leave balance(s) for ${res.data.staffCount} staff member(s).`,
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold">Configuration</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Academic Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select academic year</option>
              {academicYears.map((y: AcademicYear) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Staff Selection</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "all" | "selected")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All active staff ({staff.length})</option>
              <option value="selected">Select specific staff</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          This will create leave balances for all active leave types applicable to each staff member.
          Existing balances will be skipped (not overwritten).
        </p>

        <button
          onClick={handleInitialize}
          disabled={isPending || !selectedYear}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending
            ? "Initializing..."
            : `Initialize Balances for ${mode === "all" ? `${staff.length} Staff` : `${selectedStaff.size} Selected`}`}
        </button>
      </div>

      {/* Staff Selection Table (only in "selected" mode) */}
      {mode === "selected" && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Select Staff ({selectedStaff.size} of {staff.length} selected)
            </h3>
            <button
              onClick={toggleAll}
              className="text-xs text-primary hover:text-primary/80 font-medium"
            >
              {selectedStaff.size === staff.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-center w-10">
                    <input
                      type="checkbox"
                      checked={selectedStaff.size === staff.length && staff.length > 0}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Staff ID</th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Department</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No active staff found.
                    </td>
                  </tr>
                ) : (
                  staff.map((s: StaffRow) => (
                    <tr
                      key={s.id}
                      className={`border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 ${
                        selectedStaff.has(s.id) ? "bg-primary/5" : ""
                      }`}
                      onClick={() => toggleStaff(s.id)}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedStaff.has(s.id)}
                          onChange={() => toggleStaff(s.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{s.staffId}</td>
                      <td className="px-3 py-2 font-medium">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="px-3 py-2 text-xs">{s.staffType?.replace("_", " ")}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">
                        {s.departmentName || "---"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-6">
          <h3 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-3">
            Initialization Complete
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{result.staffCount}</p>
              <p className="text-xs text-green-600 dark:text-green-400">Staff processed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{result.created}</p>
              <p className="text-xs text-green-600 dark:text-green-400">Balances created</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{result.skipped}</p>
              <p className="text-xs text-green-600 dark:text-green-400">Already existed (skipped)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
