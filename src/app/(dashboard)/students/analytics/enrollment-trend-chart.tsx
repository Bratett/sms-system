"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { StudentAnalyticsPayload } from "@/modules/student/actions/analytics.action";
import { ExportCsvButton } from "./export-button";

export function EnrollmentTrendChart({
  data,
  academicYearId,
  programmeId,
}: {
  data: StudentAnalyticsPayload["enrollmentTrend"];
  academicYearId?: string;
  programmeId?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Enrollment Trend</h3>
          <p className="text-xs text-muted-foreground">Last 5 academic years, by outcome</p>
        </div>
        <ExportCsvButton
          metric="enrollmentTrend"
          academicYearId={academicYearId}
          programmeId={programmeId}
        />
      </div>
      {data.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No enrollment data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="academicYearName" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="active" stroke="#10b981" />
            <Line type="monotone" dataKey="promoted" stroke="#3b82f6" />
            <Line type="monotone" dataKey="graduated" stroke="#8b5cf6" />
            <Line type="monotone" dataKey="withdrawn" stroke="#ef4444" />
            <Line type="monotone" dataKey="transferred" stroke="#f59e0b" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
