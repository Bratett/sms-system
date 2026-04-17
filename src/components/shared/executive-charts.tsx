"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function formatGHS(value: number): string {
  if (value >= 1_000_000) return `GHS ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `GHS ${(value / 1_000).toFixed(1)}K`;
  return `GHS ${value.toFixed(0)}`;
}

export function TrendLineChart({
  data,
  valueKey,
  label,
  color = "#0ea5e9",
  format = "count",
}: {
  data: Array<{ month: string } & Record<string, number | string>>;
  valueKey: string;
  label: string;
  color?: string;
  format?: "count" | "currency";
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
        No trend data yet
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
        <YAxis
          tick={{ fontSize: 10 }}
          stroke="var(--color-muted-foreground)"
          tickFormatter={(v) => (format === "currency" ? formatGHS(v) : String(v))}
        />
        <Tooltip
          formatter={(v) =>
            format === "currency" ? formatGHS(Number(v)) : String(v)
          }
          contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid var(--color-border)" }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey={valueKey}
          stroke={color}
          strokeWidth={2}
          name={label}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AttendancePieChart({
  data,
}: {
  data: Array<{ status: string; count: number }>;
}) {
  const colors: Record<string, string> = {
    PRESENT: "#059669",
    LATE: "#f59e0b",
    ABSENT: "#dc2626",
    EXCUSED: "#7c3aed",
    SICK: "#0284c7",
  };
  const filtered = data.filter((d) => d.count > 0);
  if (filtered.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
        No attendance data yet
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={filtered}
          dataKey="count"
          nameKey="status"
          innerRadius={50}
          outerRadius={85}
          paddingAngle={2}
        >
          {filtered.map((d, i) => (
            <Cell key={i} fill={colors[d.status] ?? "#64748b"} />
          ))}
        </Pie>
        <Legend iconType="circle" formatter={(v) => <span className="text-xs">{v}</span>} />
        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ClassPerformanceBar({
  data,
}: {
  data: Array<{ className: string; averageScore: number }>;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
        No terminal results posted yet
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
        <YAxis
          type="category"
          dataKey="className"
          tick={{ fontSize: 10 }}
          width={90}
          stroke="var(--color-muted-foreground)"
        />
        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="averageScore" fill="#0284c7" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
