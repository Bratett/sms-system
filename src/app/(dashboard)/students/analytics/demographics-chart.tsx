"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { StudentAnalyticsPayload } from "@/modules/student/actions/analytics.action";
import { ExportCsvButton } from "./export-button";

type Tab = "gender" | "region" | "religion";

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#64748b",
  "#ec4899", "#14b8a6", "#eab308", "#0ea5e9", "#475569"];

export function DemographicsChart({
  demographics,
  academicYearId,
  programmeId,
}: {
  demographics: StudentAnalyticsPayload["demographics"];
  academicYearId?: string;
  programmeId?: string;
}) {
  const [tab, setTab] = useState<Tab>("gender");

  const data =
    tab === "gender"   ? demographics.byGender.map((r) => ({ label: r.gender, count: r.count })) :
    tab === "region"   ? demographics.byRegion.map((r) => ({ label: r.region, count: r.count })) :
                         demographics.byReligion.map((r) => ({ label: r.religion, count: r.count }));
  const metric = tab === "gender" ? "demographics.gender"
               : tab === "region" ? "demographics.region"
                                  : "demographics.religion";

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Demographics</h3>
          <p className="text-xs text-muted-foreground">Total: {demographics.total}</p>
        </div>
        <ExportCsvButton metric={metric} academicYearId={academicYearId} programmeId={programmeId} />
      </div>
      <div className="flex gap-1 text-xs">
        {(["gender", "region", "religion"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`rounded-md px-3 py-1 capitalize ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {data.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-25} height={60} textAnchor="end" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count">
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
