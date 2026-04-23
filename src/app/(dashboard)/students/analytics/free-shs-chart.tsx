"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { StudentAnalyticsPayload } from "@/modules/student/actions/analytics.action";
import { ExportCsvButton } from "./export-button";

export function FreeShsChart({
  freeShs,
  academicYearId,
  programmeId,
}: {
  freeShs: StudentAnalyticsPayload["freeShs"];
  academicYearId?: string;
  programmeId?: string;
}) {
  const data = [
    { name: "Free SHS", value: freeShs.freeShsCount, fill: "#10b981" },
    { name: "Paying",   value: freeShs.payingCount,  fill: "#3b82f6" },
  ];
  const total = freeShs.freeShsCount + freeShs.payingCount;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Free SHS vs Paying</h3>
          <p className="text-xs text-muted-foreground">
            {freeShs.freeShsPct}% on Free SHS
          </p>
        </div>
        <ExportCsvButton metric="freeShs" academicYearId={academicYearId} programmeId={programmeId} />
      </div>
      {total === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
