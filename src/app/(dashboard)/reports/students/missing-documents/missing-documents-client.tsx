"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface Row { studentId: string; name: string; className: string; missingTypes: string[]; expiredTypes: { name: string; expiredOn: Date | string | null }[]; }

interface Props {
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  classArms: { id: string; name: string; class?: { name: string } }[];
  documentTypes: { id: string; name: string }[];
  report: { rows: Row[]; total: number; note?: string } | null;
  error: string | null;
  appliedFilters: { academicYearId?: string; classArmId?: string; documentTypeId?: string; includeExpired?: string };
}

export function MissingDocumentsClient({ academicYears, classArms, documentTypes, report, error, appliedFilters }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [yearId, setYearId] = useState(appliedFilters.academicYearId ?? "");
  const [classArmId, setClassArmId] = useState(appliedFilters.classArmId ?? "");
  const [documentTypeId, setDocumentTypeId] = useState(appliedFilters.documentTypeId ?? "");
  const [includeExpired, setIncludeExpired] = useState(appliedFilters.includeExpired !== "0");

  function apply() {
    const next = new URLSearchParams(params);
    yearId ? next.set("academicYearId", yearId) : next.delete("academicYearId");
    classArmId ? next.set("classArmId", classArmId) : next.delete("classArmId");
    documentTypeId ? next.set("documentTypeId", documentTypeId) : next.delete("documentTypeId");
    next.set("includeExpired", includeExpired ? "1" : "0");
    router.push(`?${next.toString()}`);
  }

  function downloadUrl() {
    const u = new URLSearchParams();
    if (appliedFilters.academicYearId) u.set("academicYearId", appliedFilters.academicYearId);
    if (appliedFilters.classArmId) u.set("classArmId", appliedFilters.classArmId);
    if (appliedFilters.documentTypeId) u.set("documentTypeId", appliedFilters.documentTypeId);
    if (appliedFilters.includeExpired) u.set("includeExpired", appliedFilters.includeExpired);
    return `/api/reports/students/missing-documents/xlsx?${u.toString()}`;
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
          <div className="mb-1 font-medium">Document Type</div>
          <select value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">All required</option>
            {documentTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={includeExpired} onChange={(e) => setIncludeExpired(e.target.checked)} />
          Include expired
        </label>
        <button onClick={apply} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Apply</button>
        <a href={downloadUrl()} aria-disabled={empty} className={`ml-auto rounded-md border px-3 py-2 text-sm ${empty ? "pointer-events-none opacity-40" : ""}`}>Download XLSX</a>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {report?.note && <p className="text-sm text-muted-foreground">{report.note}</p>}
      {report && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm"><strong>{report.total}</strong> students with gaps.</p>
          {empty ? <p className="text-sm text-muted-foreground">No students with missing or expired documents.</p> : (
            <table className="w-full text-sm">
              <thead className="border-b text-left"><tr><th className="py-2">Student ID</th><th>Name</th><th>Class</th><th>Missing</th><th>Expired</th></tr></thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.studentId} className="border-b">
                    <td className="py-1.5">{r.studentId}</td>
                    <td>{r.name}</td>
                    <td>{r.className}</td>
                    <td>{r.missingTypes.join(", ")}</td>
                    <td>{r.expiredTypes.map((e) => `${e.name}${e.expiredOn ? ` (${typeof e.expiredOn === "string" ? e.expiredOn.slice(0,10) : e.expiredOn.toISOString().slice(0,10)})` : ""}`).join(", ")}</td>
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
