"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface ClientProps {
  filters: {
    academicYears: { id: string; name: string; isCurrent: boolean }[];
    classArms: { id: string; name: string; class?: { name: string } }[];
  };
  report: {
    totalStudents: number;
    students: Array<{
      id: string;
      studentId: string;
      name: string;
      className: string;
      gender: string;
      boardingStatus: string;
      status: string;
    }>;
    genderDistribution: { MALE: number; FEMALE: number };
    boardingBreakdown: { DAY: number; BOARDING: number };
  } | null;
  error: string | null;
  appliedFilters: { academicYearId?: string; classArmId?: string };
}

export function RosterClient({ filters, report, error, appliedFilters }: ClientProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [yearId, setYearId] = useState(appliedFilters.academicYearId ?? "");
  const [classArmId, setClassArmId] = useState(appliedFilters.classArmId ?? "");

  function applyFilters() {
    const next = new URLSearchParams(params);
    yearId ? next.set("academicYearId", yearId) : next.delete("academicYearId");
    classArmId ? next.set("classArmId", classArmId) : next.delete("classArmId");
    router.push(`?${next.toString()}`);
  }

  function downloadUrl(format: "xlsx" | "pdf") {
    const u = new URLSearchParams();
    if (appliedFilters.academicYearId) u.set("academicYearId", appliedFilters.academicYearId);
    if (appliedFilters.classArmId) u.set("classArmId", appliedFilters.classArmId);
    return `/api/reports/students/roster/${format}?${u.toString()}`;
  }

  const empty = !report || report.totalStudents === 0;
  const previewRows = report?.students.slice(0, 50) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <label className="text-sm">
          <div className="mb-1 font-medium">Academic Year</div>
          <select className="rounded-md border px-3 py-2 text-sm" value={yearId} onChange={(e) => setYearId(e.target.value)}>
            <option value="">(Current)</option>
            {filters.academicYears.map((y) => (
              <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? " (Current)" : ""}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Class Arm</div>
          <select className="rounded-md border px-3 py-2 text-sm" value={classArmId} onChange={(e) => setClassArmId(e.target.value)}>
            <option value="">All</option>
            {filters.classArms.map((c) => (
              <option key={c.id} value={c.id}>{c.class?.name ? `${c.class.name} ${c.name}` : c.name}</option>
            ))}
          </select>
        </label>
        <button onClick={applyFilters} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Apply</button>
        <div className="ml-auto flex gap-2">
          <a href={downloadUrl("xlsx")} aria-disabled={empty} className={`rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download XLSX</a>
          <a href={downloadUrl("pdf")} aria-disabled={empty} className={`rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download PDF</a>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {report && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm">
            <strong>{report.totalStudents}</strong> student{report.totalStudents === 1 ? "" : "s"} match — showing first {previewRows.length}.
          </p>
          {empty ? (
            <p className="text-sm text-muted-foreground">No students match these filters.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left">
                <tr><th className="py-2">#</th><th>Student ID</th><th>Name</th><th>Class</th><th>Sex</th><th>Boarding</th></tr>
              </thead>
              <tbody>
                {previewRows.map((s, i) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-1.5">{i + 1}</td>
                    <td>{s.studentId}</td>
                    <td>{s.name}</td>
                    <td>{s.className}</td>
                    <td>{s.gender}</td>
                    <td>{s.boardingStatus}</td>
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
