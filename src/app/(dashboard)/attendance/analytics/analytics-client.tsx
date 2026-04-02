"use client";

import { useState, useTransition, useEffect } from "react";
import {
  getAttendanceByDayAction,
  getAttendanceByPeriodAction,
  getAttendanceTrendAction,
  getChronicAbsenteeismAction,
} from "@/modules/attendance/actions/attendance-analytics.action";

interface TermOption {
  id: string;
  name: string;
  isCurrent: boolean;
  academicYearName: string;
}

interface DayStat {
  dayOfWeek: number;
  dayName: string;
  attendanceRate: number;
  totalRecords: number;
}

interface TrendStat {
  week: string;
  attendanceRate: number;
  totalRecords: number;
}

interface AbsentStudent {
  studentId: string;
  studentNumber: string;
  studentName: string;
  absenceRate: number;
  absent: number;
  total: number;
}

interface AbsenteeismData {
  students: AbsentStudent[];
  totalStudents: number;
  chronicallyAbsentCount: number;
  threshold: number;
}

export function AnalyticsClient({ terms }: { terms: TermOption[] }) {
  const [isPending, startTransition] = useTransition();
  const currentTerm = terms.find((t) => t.isCurrent);
  const [selectedTermId, setSelectedTermId] = useState(currentTerm?.id ?? "");
  const [dayStats, setDayStats] = useState<DayStat[]>([]);
  const [periodStats, setPeriodStats] = useState<Array<{ periodId: string; periodName: string; attendanceRate: number; totalRecords: number }>>([]);
  const [trendStats, setTrendStats] = useState<TrendStat[]>([]);
  const [absenteeism, setAbsenteeism] = useState<AbsenteeismData | null>(null);

  function loadData(termId: string) {
    if (!termId) return;
    startTransition(async () => {
      const [dayResult, periodResult, trendResult, absentResult] = await Promise.all([
        getAttendanceByDayAction(termId),
        getAttendanceByPeriodAction(termId),
        getAttendanceTrendAction(termId),
        getChronicAbsenteeismAction(termId),
      ]);
      if (dayResult.data) setDayStats(dayResult.data);
      if (periodResult.data) setPeriodStats(periodResult.data);
      if (trendResult.data) setTrendStats(trendResult.data);
      if (absentResult.data) setAbsenteeism(absentResult.data);
    });
  }

  useEffect(() => {
    if (selectedTermId) loadData(selectedTermId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTermChange(termId: string) {
    setSelectedTermId(termId);
    loadData(termId);
  }

  return (
    <>
      {/* Term Selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">Term:</label>
        <select
          value={selectedTermId}
          onChange={(e) => handleTermChange(e.target.value)}
          disabled={isPending}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Select term</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.academicYearName} - {t.name} {t.isCurrent ? "(Current)" : ""}
            </option>
          ))}
        </select>
        {isPending && <span className="text-xs text-muted-foreground">Loading...</span>}
      </div>

      {!selectedTermId && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Select a term to view analytics.
        </div>
      )}

      {selectedTermId && !isPending && (
        <div className="space-y-6">
          {/* Attendance by Day of Week */}
          {dayStats.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 font-semibold">Attendance Rate by Day of Week</h3>
              <div className="grid grid-cols-5 gap-2">
                {dayStats.map((d) => (
                  <div key={d.dayOfWeek} className="text-center">
                    <div className="text-xs text-muted-foreground">{d.dayName}</div>
                    <div className="mt-1 flex items-end justify-center gap-0.5">
                      <div
                        className={`w-12 rounded-t ${
                          d.attendanceRate >= 90
                            ? "bg-green-500"
                            : d.attendanceRate >= 75
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{ height: `${Math.max(d.attendanceRate * 0.8, 8)}px` }}
                      />
                    </div>
                    <div className="mt-1 text-sm font-bold">{d.attendanceRate}%</div>
                    <div className="text-xs text-muted-foreground">{d.totalRecords} records</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attendance by Period */}
          {periodStats.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 font-semibold">Attendance Rate by Period</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {periodStats.map((p) => (
                  <div key={p.periodId} className="text-center">
                    <div className="text-xs text-muted-foreground">{p.periodName}</div>
                    <div className="mt-1 flex items-end justify-center">
                      <div
                        className={`w-12 rounded-t ${
                          p.attendanceRate >= 90
                            ? "bg-green-500"
                            : p.attendanceRate >= 75
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{ height: `${Math.max(p.attendanceRate * 0.6, 8)}px` }}
                      />
                    </div>
                    <div className="mt-1 text-sm font-bold">{p.attendanceRate}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weekly Trend */}
          {trendStats.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 font-semibold">Weekly Attendance Trend</h3>
              <div className="overflow-x-auto">
                <div className="flex items-end gap-1" style={{ minWidth: trendStats.length * 60 }}>
                  {trendStats.map((t) => (
                    <div key={t.week} className="flex-1 text-center min-w-[50px]">
                      <div
                        className={`mx-auto w-8 rounded-t ${
                          t.attendanceRate >= 90
                            ? "bg-green-500"
                            : t.attendanceRate >= 75
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{ height: `${Math.max(t.attendanceRate * 0.6, 4)}px` }}
                      />
                      <div className="mt-1 text-xs font-medium">{t.attendanceRate}%</div>
                      <div className="text-[10px] text-muted-foreground">{t.week.slice(5)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chronic Absenteeism */}
          {absenteeism && (
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Chronic Absenteeism</h3>
                <span className="text-sm text-muted-foreground">
                  Threshold: {absenteeism.threshold}% absence rate
                </span>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Students</p>
                  <p className="text-xl font-bold">{absenteeism.totalStudents}</p>
                </div>
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-center">
                  <p className="text-xs text-red-600">Chronically Absent</p>
                  <p className="text-xl font-bold text-red-700">{absenteeism.chronicallyAbsentCount}</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Rate</p>
                  <p className="text-xl font-bold">
                    {absenteeism.totalStudents > 0
                      ? Math.round((absenteeism.chronicallyAbsentCount / absenteeism.totalStudents) * 100)
                      : 0}%
                  </p>
                </div>
              </div>

              {absenteeism.students.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium">#</th>
                        <th className="px-3 py-2 text-left font-medium">Student</th>
                        <th className="px-3 py-2 text-center font-medium">Absent</th>
                        <th className="px-3 py-2 text-center font-medium">Total</th>
                        <th className="px-3 py-2 text-center font-medium">Absence Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absenteeism.students.slice(0, 20).map((s, i) => (
                        <tr key={s.studentId} className="border-b last:border-0">
                          <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{s.studentName}</div>
                            <div className="text-xs text-muted-foreground font-mono">{s.studentNumber}</div>
                          </td>
                          <td className="px-3 py-2 text-center text-red-600 font-medium">{s.absent}</td>
                          <td className="px-3 py-2 text-center">{s.total}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                              {s.absenceRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {absenteeism.students.length > 20 && (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      Showing top 20 of {absenteeism.students.length} students
                    </p>
                  )}
                </div>
              )}

              {absenteeism.students.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  No chronically absent students found.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
