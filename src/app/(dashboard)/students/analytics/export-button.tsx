"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { exportAnalyticsMetricAction } from "@/modules/student/actions/analytics.action";
import Papa from "papaparse";

function sanitizeCsvValue(v: unknown): unknown {
  if (typeof v !== "string") return v;
  // Prefix with single quote if first char is a formula trigger
  if (/^[=+\-@\t\r]/.test(v)) return `'${v}`;
  return v;
}

function sanitizeCsvRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(row)) {
      clean[k] = sanitizeCsvValue(val);
    }
    return clean;
  });
}

type MetricName = Parameters<typeof exportAnalyticsMetricAction>[0]["metric"];

export function ExportCsvButton({
  metric,
  academicYearId,
  programmeId,
  label = "Export CSV",
}: {
  metric: MetricName;
  academicYearId?: string;
  programmeId?: string;
  label?: string;
}) {
  const [pending, start] = useTransition();

  const handleClick = () =>
    start(async () => {
      const res = await exportAnalyticsMetricAction({ metric, academicYearId, programmeId });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      if (res.data.length === 0) {
        toast.info("No data to export");
        return;
      }
      const csv = Papa.unparse(sanitizeCsvRows(res.data));
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${metric.replace(/\./g, "-")}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

  return (
    <button
      className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-50"
      onClick={handleClick}
      disabled={pending}
    >
      {label}
    </button>
  );
}
