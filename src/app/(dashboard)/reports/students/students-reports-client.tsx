"use client";

import Link from "next/link";

const REPORTS = [
  {
    slug: "roster",
    title: "Class Roster",
    description: "Student list per class arm with gender / boarding totals. PDF + XLSX.",
  },
  {
    slug: "census",
    title: "Student Census",
    description: "Aggregate counts by class, programme, region, gender, boarding, or religion. XLSX.",
  },
  {
    slug: "nominal-roll",
    title: "Nominal Roll",
    description: "Official student listing for one class arm — surnames uppercased. PDF + XLSX.",
  },
  {
    slug: "form-register",
    title: "Form Master's Register",
    description: "Printable attendance register with configurable weeks × days grid. PDF + XLSX.",
  },
  {
    slug: "birthdays",
    title: "Birthday List",
    description: "Birthdays in a chosen month or upcoming N days. XLSX.",
  },
  {
    slug: "missing-documents",
    title: "Missing Documents",
    description: "Active students missing or expired on required document types. XLSX.",
  },
];

export function StudentsReportsClient() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {REPORTS.map((r) => (
        <Link
          key={r.slug}
          href={`/reports/students/${r.slug}`}
          className="block rounded-lg border bg-card p-6 hover:border-primary hover:shadow-sm"
        >
          <h3 className="text-base font-semibold">{r.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>
        </Link>
      ))}
    </div>
  );
}
