"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface Row {
  row: number; studentId: string; surname: string; otherNames: string;
  gender: string; dateOfBirth: string | Date; primaryGuardianPhone: string | null;
}

interface Props {
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  classArms: { id: string; name: string; class?: { name: string } }[];
  report: { rows: Row[]; total: number } | null;
  error: string | null;
  appliedFilters: { academicYearId?: string; classArmId?: string };
}

export function NominalRollClient({ academicYears, classArms, report, error, appliedFilters }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [yearId, setYearId] = useState(appliedFilters.academicYearId ?? "");
  const [classArmId, setClassArmId] = useState(appliedFilters.classArmId ?? "");

  function apply() {
    const next = new URLSearchParams(params);
    yearId ? next.set("academicYearId", yearId) : next.delete("academicYearId");
    classArmId ? next.set("classArmId", classArmId) : next.delete("classArmId");
    router.push(`?${next.toString()}`);
  }

  function downloadUrl(format: "xlsx" | "pdf") {
    const u = new URLSearchParams();
    if (appliedFilters.academicYearId) u.set("academicYearId", appliedFilters.academicYearId);
    if (appliedFilters.classArmId) u.set("classArmId", appliedFilters.classArmId);
    return `/api/reports/students/nominal-roll/${format}?${u.toString()}`;
  }

  const empty = !report || report.rows.length === 0;
  const previewRows = (report?.rows ?? []).slice(0, 50);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <label className="text-sm">
          <div className="mb-1 font-medium">Academic Year</div>
          <select value={yearId} onChange={(e) => setYearId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">(Current)</option>
            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Class Arm <span className="text-red-500">*</span></div>
          <select value={classArmId} onChange={(e) => setClassArmId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">— Select —</option>
            {classArms.map((c) => <option key={c.id} value={c.id}>{c.class?.name ? `${c.class.name} ${c.name}` : c.name}</option>)}
          </select>
        </label>
        <button onClick={apply} disabled={!classArmId} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">Apply</button>
        <div className="ml-auto flex gap-2">
          <a href={downloadUrl("xlsx")} aria-disabled={empty} className={`rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download XLSX</a>
          <a href={downloadUrl("pdf")} aria-disabled={empty} className={`rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download PDF</a>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!classArmId && !report && <p className="text-sm text-muted-foreground">Select a class arm to generate the nominal roll.</p>}
      {report && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm"><strong>{report.total}</strong> students — showing first {previewRows.length}.</p>
          {empty ? <p className="text-sm text-muted-foreground">No students found.</p> : (
            <table className="w-full text-sm">
              <thead className="border-b text-left"><tr><th className="py-2">#</th><th>Student ID</th><th>Surname</th><th>Other Names</th><th>Sex</th><th>DOB</th><th>Phone</th></tr></thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.studentId} className="border-b">
                    <td className="py-1.5">{r.row}</td><td>{r.studentId}</td>
                    <td className="font-semibold">{r.surname}</td><td>{r.otherNames}</td>
                    <td>{r.gender}</td>
                    <td>{r.dateOfBirth instanceof Date ? r.dateOfBirth.toISOString().slice(0, 10) : String(r.dateOfBirth).slice(0, 10)}</td>
                    <td>{r.primaryGuardianPhone ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
