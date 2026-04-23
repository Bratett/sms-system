"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { StudentAnalyticsPayload } from "@/modules/student/actions/analytics.action";
import { ExportCsvButton } from "./export-button";

export function RetentionChart({
  retention,
  academicYearId,
  programmeId,
}: {
  retention: StudentAnalyticsPayload["retention"];
  academicYearId?: string;
  programmeId?: string;
}) {
  const yearGroups = Array.from(new Set(retention.cohorts.map((c) => c.yearGroup))).sort();
  const data = Array.from(new Set(retention.cohorts.map((c) => c.academicYearName))).map((yr) => {
    const row: Record<string, string | number | null> = { yr };
    for (const yg of yearGroups) {
      const hit = retention.cohorts.find((c) => c.academicYearName === yr && c.yearGroup === yg);
      row[`yg${yg}`] = hit?.retentionPct ?? null;
    }
    return row;
  });
  const colors = ["#3b82f6", "#10b981", "#f59e0b"];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Retention by Cohort</h3>
          <p className="text-xs text-muted-foreground">Year-over-year ACTIVE carry-over %</p>
        </div>
        <ExportCsvButton metric="retention" academicYearId={academicYearId} programmeId={programmeId} />
      </div>
      {retention.cohorts.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Retention data unavailable until next academic year completes
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="yr" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip />
            <Legend />
            {yearGroups.map((yg, i) => (
              <Line key={yg} type="monotone" dataKey={`yg${yg}`} name={`SHS ${yg}`}
                stroke={colors[i % colors.length]} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
