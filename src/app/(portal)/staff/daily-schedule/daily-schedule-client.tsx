"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { PageHeader } from "@/components/layout/page-header";
import { getTeacherDailyViewAction } from "@/modules/timetable/actions/daily-view.action";

interface ScheduleEntry {
  periodId: string;
  periodName: string;
  startTime: string;
  endTime: string;
  periodType: string;
  isTeaching: boolean;
  subject: string | null;
  className: string | null;
  classArmId?: string;
  room: string | null;
  attendanceStatus: string | null;
  attendanceRegisterId: string | null;
  recordCount: number;
  isSubstituted: boolean;
}

export function DailyScheduleClient({
  initialSchedule,
  initialDate,
}: {
  initialSchedule: ScheduleEntry[];
  initialDate: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [schedule, setSchedule] = useState(initialSchedule);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  function handleDateChange(date: string) {
    setSelectedDate(date);
    startTransition(async () => {
      const result = await getTeacherDailyViewAction(date);
      if (result.data) {
        setSchedule(result.data.schedule);
      }
    });
  }

  const teachingCount = schedule.filter((s) => s.isTeaching).length;
  const attendanceTaken = schedule.filter(
    (s) => s.isTeaching && s.attendanceStatus === "CLOSED",
  ).length;
  const attendancePending = schedule.filter(
    (s) => s.isTeaching && (!s.attendanceStatus || s.attendanceStatus === "OPEN"),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Daily Schedule"
        description="View today's teaching schedule with attendance status."
      />

      {/* Date Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            const prev = new Date(selectedDate);
            prev.setDate(prev.getDate() - 1);
            handleDateChange(format(prev, "yyyy-MM-dd"));
          }}
          disabled={isPending}
          className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
        >
          Previous
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => handleDateChange(e.target.value)}
          disabled={isPending}
          className="rounded-md border px-3 py-2 text-sm"
        />
        <button
          onClick={() => {
            const next = new Date(selectedDate);
            next.setDate(next.getDate() + 1);
            handleDateChange(format(next, "yyyy-MM-dd"));
          }}
          disabled={isPending}
          className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
        >
          Next
        </button>
        <span className="ml-2 text-sm font-medium">
          {format(new Date(selectedDate), "EEEE, d MMMM yyyy")}
        </span>
        {isPending && <span className="text-xs text-muted-foreground">Loading...</span>}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border bg-primary/5 p-3 text-center">
          <p className="text-xs text-muted-foreground">Teaching Periods</p>
          <p className="text-xl font-bold text-primary">{teachingCount}</p>
        </div>
        <div className="rounded-md border bg-green-50 p-3 text-center">
          <p className="text-xs text-green-600">Attendance Taken</p>
          <p className="text-xl font-bold text-green-700">{attendanceTaken}</p>
        </div>
        <div className="rounded-md border bg-amber-50 p-3 text-center">
          <p className="text-xs text-amber-600">Attendance Pending</p>
          <p className="text-xl font-bold text-amber-700">{attendancePending}</p>
        </div>
      </div>

      {/* Schedule Timeline */}
      <div className="space-y-2">
        {schedule.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            No schedule for this day.
          </div>
        ) : (
          schedule.map((entry) => {
            const isBreak = entry.periodType === "BREAK" || entry.periodType === "ASSEMBLY";

            if (isBreak) {
              return (
                <div
                  key={entry.periodId}
                  className="flex items-center gap-4 rounded-md bg-muted/50 px-4 py-2"
                >
                  <div className="w-24 text-xs text-muted-foreground">
                    {entry.startTime} - {entry.endTime}
                  </div>
                  <div className="text-sm text-muted-foreground">{entry.periodName}</div>
                </div>
              );
            }

            if (!entry.isTeaching) {
              return (
                <div
                  key={entry.periodId}
                  className="flex items-center gap-4 rounded-md border border-dashed px-4 py-3"
                >
                  <div className="w-24 text-xs text-muted-foreground">
                    {entry.startTime} - {entry.endTime}
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {entry.periodName}
                  </div>
                  <span className="ml-auto rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">
                    Free Period
                  </span>
                </div>
              );
            }

            // Teaching period
            const attendanceColor =
              entry.attendanceStatus === "CLOSED"
                ? "border-l-green-500 bg-green-50/50"
                : entry.attendanceStatus === "OPEN"
                  ? "border-l-amber-500 bg-amber-50/50"
                  : "border-l-gray-300";

            return (
              <div
                key={entry.periodId}
                className={`flex items-center gap-4 rounded-md border border-l-4 px-4 py-3 ${attendanceColor}`}
              >
                <div className="w-24 shrink-0">
                  <div className="text-xs text-muted-foreground">
                    {entry.startTime} - {entry.endTime}
                  </div>
                  <div className="text-xs font-medium">{entry.periodName}</div>
                </div>

                <div className="flex-1">
                  <div className="font-semibold text-primary">{entry.subject}</div>
                  <div className="text-sm text-muted-foreground">
                    {entry.className}
                    {entry.room && ` - ${entry.room}`}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {entry.isSubstituted && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                      Substituted
                    </span>
                  )}

                  {entry.attendanceStatus === "CLOSED" ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Done ({entry.recordCount})
                    </span>
                  ) : entry.attendanceStatus === "OPEN" ? (
                    <a
                      href={`/attendance/take?classArmId=${entry.classArmId}`}
                      className="rounded-md bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                    >
                      Continue
                    </a>
                  ) : (
                    <a
                      href={`/attendance/take?classArmId=${entry.classArmId}`}
                      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Take Attendance
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
