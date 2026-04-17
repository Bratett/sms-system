"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStudentAttendanceAction } from "@/modules/attendance/actions/attendance.action";

interface AttendanceRecord {
  id: string;
  date: Date;
  type: string;
  status: string;
  remarks: string | null;
  arrivalTime: Date | null;
}

interface TermOption {
  id: string;
  name: string;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function StudentAttendanceSection({
  studentId,
  terms,
  defaultTermId,
}: {
  studentId: string;
  terms: TermOption[];
  defaultTermId?: string;
}) {
  const [termId, setTermId] = useState<string>(defaultTermId ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const res = await getStudentAttendanceAction(studentId, termId || undefined);
      if (cancelled) return;
      if ("error" in res) {
        setError(res.error as string);
        setLoading(false);
        return;
      }
      setRecords((res.data ?? []) as unknown as AttendanceRecord[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [studentId, termId]);

  const counts = records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const present = counts.PRESENT ?? 0;
  const absent = counts.ABSENT ?? 0;
  const late = counts.LATE ?? 0;
  const excused = counts.EXCUSED ?? 0;
  const sick = counts.SICK ?? 0;
  const total = records.length;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Term selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">Term:</label>
        <select
          value={termId}
          onChange={(e) => setTermId(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All terms</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading attendance…</div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-red-600">Error: {error}</div>
      ) : (
        <>
          {/* Summary pills */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
            <SummaryPill label="Attendance Rate" value={`${rate}%`} tone="primary" />
            <SummaryPill label="Present" value={String(present)} tone="green" />
            <SummaryPill label="Absent" value={String(absent)} tone="red" />
            <SummaryPill label="Late" value={String(late)} tone="amber" />
            <SummaryPill label="Excused" value={String(excused)} tone="slate" />
            <SummaryPill label="Sick" value={String(sick)} tone="blue" />
          </div>

          {/* Records table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Recent Records</h3>
              <Link
                href={`/attendance?studentId=${studentId}`}
                className="text-xs text-primary hover:underline"
              >
                View full record →
              </Link>
            </div>
            {records.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No attendance records for this term.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 10).map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-3 py-2">{formatDate(r.date)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.type}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.remarks ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "green" | "red" | "amber" | "slate" | "blue";
}) {
  const toneClasses: Record<typeof tone, string> = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-700 dark:text-green-400",
    red: "bg-red-500/10 text-red-700 dark:text-red-400",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    slate: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  };
  return (
    <div className={`rounded-lg border border-border p-3 ${toneClasses[tone]}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
