"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const GROUP_OPTIONS = [
  { value: "class", label: "Class" },
  { value: "programme", label: "Programme" },
  { value: "region", label: "Region" },
  { value: "gender", label: "Gender" },
  { value: "boarding", label: "Boarding status" },
  { value: "religion", label: "Religion" },
];

interface Props {
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  report: { rows: Array<{ groupKey: string; groupLabel: string; total: number; male: number; female: number; day: number; boarding: number }>; total: number; groupBy: string } | null;
  error: string | null;
  appliedFilters: { academicYearId?: string; groupBy: string };
}

export function CensusClient({ academicYears, report, error, appliedFilters }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [yearId, setYearId] = useState(appliedFilters.academicYearId ?? "");
  const [groupBy, setGroupBy] = useState(appliedFilters.groupBy);

  function apply() {
    const next = new URLSearchParams(params);
    yearId ? next.set("academicYearId", yearId) : next.delete("academicYearId");
    next.set("groupBy", groupBy);
    router.push(`?${next.toString()}`);
  }

  function downloadUrl() {
    const u = new URLSearchParams();
    if (appliedFilters.academicYearId) u.set("academicYearId", appliedFilters.academicYearId);
    u.set("groupBy", appliedFilters.groupBy);
    return `/api/reports/students/census/xlsx?${u.toString()}`;
  }

  const empty = !report || report.rows.length === 0;
  const previewRows = report?.rows.slice(0, 50) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <label className="text-sm">
          <div className="mb-1 font-medium">Academic Year</div>
          <select value={yearId} onChange={(e) => setYearId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">(Current)</option>
            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? " (Current)" : ""}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Group by</div>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            {GROUP_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </label>
        <button onClick={apply} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Apply</button>
        <a href={downloadUrl()} aria-disabled={empty} className={`ml-auto rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download XLSX</a>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {report && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm">Total active students: <strong>{report.total}</strong></p>
          {empty ? (
            <p className="text-sm text-muted-foreground">No data.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left"><tr><th className="py-2">Group</th><th>Total</th><th>Male</th><th>Female</th><th>Day</th><th>Boarding</th></tr></thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.groupKey} className="border-b"><td className="py-1.5">{r.groupLabel}</td><td>{r.total}</td><td>{r.male}</td><td>{r.female}</td><td>{r.day}</td><td>{r.boarding}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
