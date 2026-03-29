"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// ── Fee Collection Donut ──────────────────────────────────────

interface FeeChartProps {
  collected: number;
  outstanding: number;
}

const FEE_COLORS = ["#059669", "#e2e8f0"]; // emerald-600, slate-200

function formatGHS(value: number): string {
  if (value >= 1_000_000) return `GHS ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `GHS ${(value / 1_000).toFixed(1)}K`;
  return `GHS ${value.toFixed(0)}`;
}

export function FeeCollectionChart({ collected, outstanding }: FeeChartProps) {
  const data = [
    { name: "Collected", value: collected },
    { name: "Outstanding", value: outstanding },
  ];

  const total = collected + outstanding;
  if (total === 0) return null;

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={FEE_COLORS[index]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [formatGHS(Number(value))]}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
              fontSize: "13px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
          Collected ({formatGHS(collected)})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          Outstanding ({formatGHS(outstanding)})
        </span>
      </div>
    </div>
  );
}

// ── Student Breakdown Bar Chart ───────────────────────────────

interface StudentBreakdownProps {
  male: number;
  female: number;
  boarding: number;
  day: number;
}

const STUDENT_COLORS = {
  male: "#2563eb", // blue
  female: "#e11d48", // pink
  boarding: "#7c3aed", // purple
  day: "#0ea5e9", // sky
};

export function StudentBreakdownChart({ male, female, boarding, day }: StudentBreakdownProps) {
  const genderData = [
    { name: "Male", value: male, fill: STUDENT_COLORS.male },
    { name: "Female", value: female, fill: STUDENT_COLORS.female },
  ];

  const boardingData = [
    { name: "Boarding", value: boarding, fill: STUDENT_COLORS.boarding },
    { name: "Day", value: day, fill: STUDENT_COLORS.day },
  ];

  const data = [
    { category: "Gender", Male: male, Female: female },
    { category: "Residence", Boarding: boarding, Day: day },
  ];

  if (male + female === 0) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" barCategoryGap={12}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
          <YAxis
            type="category"
            dataKey="category"
            tick={{ fontSize: 12 }}
            stroke="var(--color-muted-foreground)"
            width={70}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
              fontSize: "13px",
            }}
          />
          <Bar dataKey="Male" fill={STUDENT_COLORS.male} radius={[0, 4, 4, 0]} />
          <Bar dataKey="Female" fill={STUDENT_COLORS.female} radius={[0, 4, 4, 0]} />
          <Bar dataKey="Boarding" fill={STUDENT_COLORS.boarding} radius={[0, 4, 4, 0]} />
          <Bar dataKey="Day" fill={STUDENT_COLORS.day} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: STUDENT_COLORS.male }} />
          Male ({male})
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: STUDENT_COLORS.female }}
          />
          Female ({female})
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: STUDENT_COLORS.boarding }}
          />
          Boarding ({boarding})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: STUDENT_COLORS.day }} />
          Day ({day})
        </span>
      </div>
    </div>
  );
}
