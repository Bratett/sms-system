"use client";

import { useState } from "react";

type Kind =
  | "PAYE"
  | "SSNIT_TIER1"
  | "SSNIT_TIER2"
  | "GETFUND"
  | "VAT"
  | "GRA_CONSOLIDATED"
  | "GES_ENROLLMENT"
  | "GES_STAFFING"
  | "GES_BECE_CANDIDATURE";

const RETURN_CARDS: Array<{
  kind: Kind;
  title: string;
  description: string;
  needsAcademicYear?: boolean;
}> = [
  {
    kind: "PAYE",
    title: "PAYE",
    description: "Monthly Pay-As-You-Earn schedule for GRA IRIS.",
  },
  {
    kind: "SSNIT_TIER1",
    title: "SSNIT Tier 1",
    description: "Statutory pension contributions (5.5% ee + 13% er).",
  },
  {
    kind: "SSNIT_TIER2",
    title: "SSNIT Tier 2",
    description: "Occupational pension contributions (5% ee).",
  },
  {
    kind: "GETFUND",
    title: "GETFund",
    description: "Disbursement schedule showing expected vs received.",
  },
  {
    kind: "VAT",
    title: "VAT",
    description: "Recorded VAT tax lines for the period.",
  },
  {
    kind: "GRA_CONSOLIDATED",
    title: "GRA Consolidated",
    description: "All GRA tax types on one cover sheet.",
  },
  {
    kind: "GES_ENROLLMENT",
    title: "GES Enrollment Census",
    description: "Per-class-arm M/F breakdown for the academic year.",
    needsAcademicYear: true,
  },
  {
    kind: "GES_STAFFING",
    title: "GES Staffing Return",
    description: "Full staff list with NTC licence status.",
  },
  {
    kind: "GES_BECE_CANDIDATURE",
    title: "BECE Candidature",
    description: "Final-year students with BECE index numbers.",
    needsAcademicYear: true,
  },
];

export function ReturnsClient() {
  const { from, to, label } = defaultMonthRange();
  const [periodFrom, setPeriodFrom] = useState(from);
  const [periodTo, setPeriodTo] = useState(to);
  const [periodLabel, setPeriodLabel] = useState(label);
  const [academicYearId, setAcademicYearId] = useState("");
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");

  function buildUrl(kind: Kind): string {
    const params = new URLSearchParams({
      kind,
      periodFrom,
      periodTo,
      label: periodLabel,
      format,
    });
    if (academicYearId) params.set("academicYearId", academicYearId);
    return `/api/compliance/returns/download?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 rounded border border-gray-200 bg-white p-4 md:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Period start</span>
          <input
            type="date"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
            className="w-full rounded border border-gray-300 p-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Period end (exclusive)</span>
          <input
            type="date"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
            className="w-full rounded border border-gray-300 p-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Label</span>
          <input
            type="text"
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            placeholder="March 2026"
            className="w-full rounded border border-gray-300 p-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "csv" | "xlsx")}
            className="w-full rounded border border-gray-300 p-2 text-sm"
          >
            <option value="csv">CSV</option>
            <option value="xlsx">XLSX</option>
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-medium">
            Academic Year ID (for GES enrollment + BECE)
          </span>
          <input
            type="text"
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            placeholder="Prisma academicYear.id"
            className="w-full rounded border border-gray-300 p-2 font-mono text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {RETURN_CARDS.map((c) => (
          <div
            key={c.kind}
            className="flex flex-col gap-3 rounded border border-gray-200 bg-white p-4"
          >
            <div>
              <div className="text-sm font-semibold">{c.title}</div>
              <p className="text-xs text-gray-600">{c.description}</p>
            </div>
            <a
              href={buildUrl(c.kind)}
              className="inline-block rounded bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white"
            >
              Download
            </a>
            {c.needsAcademicYear && !academicYearId && (
              <p className="text-xs text-amber-700">
                Set the Academic Year ID above before downloading.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function defaultMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    label: start.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
  };
}
