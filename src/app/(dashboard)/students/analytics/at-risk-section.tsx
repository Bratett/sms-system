"use client";

import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { StudentAnalyticsPayload } from "@/modules/student/actions/analytics.action";
import { ExportCsvButton } from "./export-button";

const LEVEL_COLORS: Record<string, string> = {
  LOW: "#10b981",
  MODERATE: "#f59e0b",
  HIGH: "#ef4444",
  CRITICAL: "#7f1d1d",
};

export function AtRiskSection({
  atRisk,
  academicYearId,
  programmeId,
}: {
  atRisk: StudentAnalyticsPayload["atRisk"];
  academicYearId?: string;
  programmeId?: string;
}) {
  if (!atRisk.hasAnyProfiles) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 space-y-2">
        <h3 className="font-medium">At-Risk Distribution</h3>
        <p className="text-sm text-muted-foreground">
          No risk profiles computed yet. Compute them on the{" "}
          <Link href="/analytics" className="underline">AI Analytics page</Link>.
        </p>
      </div>
    );
  }

  const chartData = atRisk.byLevel.map((b) => ({ ...b, fill: LEVEL_COLORS[b.riskLevel] }));

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">At-Risk Students</h3>
          <p className="text-xs text-muted-foreground">
            Last computed: {atRisk.computedAt ? new Date(atRisk.computedAt).toLocaleString() : "—"}
          </p>
        </div>
        <ExportCsvButton metric="atRisk" academicYearId={academicYearId} programmeId={programmeId}
          label="Export top-10 CSV" />
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="riskLevel" tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count">
            {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {atRisk.topStudents.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Student</th>
              <th className="py-2">ID</th>
              <th className="py-2">Level</th>
              <th className="py-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {atRisk.topStudents.map((s) => (
              <tr key={s.studentId} className="border-t border-border">
                <td className="py-2">
                  <Link href={`/students/${s.studentId}`} className="hover:underline">
                    {s.lastName}, {s.firstName}
                  </Link>
                </td>
                <td className="py-2">{s.studentCode}</td>
                <td className="py-2">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: `${LEVEL_COLORS[s.riskLevel]}20`, color: LEVEL_COLORS[s.riskLevel] }}>
                    {s.riskLevel}
                  </span>
                </td>
                <td className="py-2">{s.riskScore.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
