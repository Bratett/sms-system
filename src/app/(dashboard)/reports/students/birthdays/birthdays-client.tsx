"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface Props {
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  classArms: { id: string; name: string; class?: { name: string } }[];
  report: { rows: Array<{ studentId: string; name: string; className: string; dateOfBirth: string | Date; ageTurning: number; daysUntil?: number; primaryGuardianPhone?: string | null }>; total: number; mode: string } | null;
  error: string | null;
  appliedFilters: { academicYearId?: string; classArmId?: string; month?: string; upcomingDays?: string; includeGuardianPhone?: string };
}

export function BirthdaysClient({ academicYears, classArms, report, error, appliedFilters }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [yearId, setYearId] = useState(appliedFilters.academicYearId ?? "");
  const [classArmId, setClassArmId] = useState(appliedFilters.classArmId ?? "");
  const [mode, setMode] = useState(appliedFilters.upcomingDays ? "upcoming" : "month");
  const [month, setMonth] = useState(appliedFilters.month ?? String(new Date().getMonth() + 1));
  const [upcomingDays, setUpcomingDays] = useState(appliedFilters.upcomingDays ?? "30");
  const [includeGuardianPhone, setIncludeGuardianPhone] = useState(appliedFilters.includeGuardianPhone === "1");

  function apply() {
    const next = new URLSearchParams();
    if (yearId) next.set("academicYearId", yearId);
    if (classArmId) next.set("classArmId", classArmId);
    if (mode === "month") { next.set("month", month); next.delete("upcomingDays"); }
    else { next.set("upcomingDays", upcomingDays); next.delete("month"); }
    if (includeGuardianPhone) next.set("includeGuardianPhone", "1");
    router.push(`?${next.toString()}`);
  }

  function downloadUrl() {
    const u = new URLSearchParams();
    if (appliedFilters.academicYearId) u.set("academicYearId", appliedFilters.academicYearId);
    if (appliedFilters.classArmId) u.set("classArmId", appliedFilters.classArmId);
    if (appliedFilters.month) u.set("month", appliedFilters.month);
    if (appliedFilters.upcomingDays) u.set("upcomingDays", appliedFilters.upcomingDays);
    if (appliedFilters.includeGuardianPhone) u.set("includeGuardianPhone", appliedFilters.includeGuardianPhone);
    return `/api/reports/students/birthdays/xlsx?${u.toString()}`;
  }

  const empty = !report || report.rows.length === 0;
  const previewRows = (report?.rows ?? []).slice(0, 50);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <label className="text-sm">
          <div className="mb-1 font-medium">Year</div>
          <select value={yearId} onChange={(e) => setYearId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">(Current)</option>
            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Class Arm</div>
          <select value={classArmId} onChange={(e) => setClassArmId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">All</option>
            {classArms.map((c) => <option key={c.id} value={c.id}>{c.class?.name ? `${c.class.name} ${c.name}` : c.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Window</div>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="month">By month</option>
            <option value="upcoming">Upcoming N days</option>
          </select>
        </label>
        {mode === "month" ? (
          <label className="text-sm">
            <div className="mb-1 font-medium">Month</div>
            <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} className="w-20 rounded-md border px-3 py-2 text-sm" />
          </label>
        ) : (
          <label className="text-sm">
            <div className="mb-1 font-medium">Upcoming days</div>
            <input type="number" min={1} max={365} value={upcomingDays} onChange={(e) => setUpcomingDays(e.target.value)} className="w-24 rounded-md border px-3 py-2 text-sm" />
          </label>
        )}
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={includeGuardianPhone} onChange={(e) => setIncludeGuardianPhone(e.target.checked)} />
          Include guardian phone
        </label>
        <button onClick={apply} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Apply</button>
        <a href={downloadUrl()} aria-disabled={empty} className={`ml-auto rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download XLSX</a>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {report && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm"><strong>{report.total}</strong> birthdays match.</p>
          {empty ? <p className="text-sm text-muted-foreground">No birthdays match these filters.</p> : (
            <table className="w-full text-sm">
              <thead className="border-b text-left"><tr><th className="py-2">Student ID</th><th>Name</th><th>Class</th><th>DOB</th><th>Turning</th>{report.mode === "upcomingDays" && <th>Days</th>}{includeGuardianPhone && <th>Phone</th>}</tr></thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.studentId} className="border-b">
                    <td className="py-1.5">{r.studentId}</td><td>{r.name}</td><td>{r.className}</td>
                    <td>{r.dateOfBirth instanceof Date ? r.dateOfBirth.toISOString().slice(0, 10) : String(r.dateOfBirth).slice(0, 10)}</td>
                    <td>{r.ageTurning}</td>
                    {report.mode === "upcomingDays" && <td>{r.daysUntil}</td>}
                    {includeGuardianPhone && <td>{r.primaryGuardianPhone ?? "—"}</td>}
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
