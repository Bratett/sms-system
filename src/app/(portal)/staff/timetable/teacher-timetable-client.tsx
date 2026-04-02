"use client";

import { PageHeader } from "@/components/layout/page-header";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

interface PeriodInfo {
  name: string;
  startTime: string;
  endTime: string;
  order: number;
  type: string;
}

interface TimetableEntry {
  id: string;
  dayOfWeek: number;
  period: PeriodInfo;
  subject: { name: string; code: string | null };
  className: string;
  room: string | null;
}

export function TeacherTimetableClient({
  timetable,
  periods,
}: {
  timetable: TimetableEntry[];
  periods: PeriodInfo[];
}) {
  // Build a lookup: key = `${dayOfWeek}-${period.order}`
  const slotMap = new Map<string, TimetableEntry>();
  for (const entry of timetable) {
    slotMap.set(`${entry.dayOfWeek}-${entry.period.order}`, entry);
  }

  const activePeriods = periods.sort((a, b) => a.order - b.order);

  // Count teaching periods
  const totalTeachingPeriods = timetable.length;
  const periodsPerDay = DAYS.map(
    (_, i) => timetable.filter((t) => t.dayOfWeek === i + 1).length,
  );

  if (timetable.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Teaching Schedule"
          description="View your weekly teaching timetable."
        />
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">
            No teaching schedule found for the current term.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Teaching Schedule"
        description="View your weekly teaching timetable."
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-md border bg-primary/5 p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Periods/Week</p>
          <p className="text-xl font-bold text-primary">{totalTeachingPeriods}</p>
        </div>
        {DAYS.map((day, i) => (
          <div key={day} className="rounded-md border p-3 text-center">
            <p className="text-xs text-muted-foreground">{day}</p>
            <p className="text-xl font-bold">{periodsPerDay[i]}</p>
          </div>
        ))}
      </div>

      {/* Weekly Grid */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Period
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Time
              </th>
              {DAYS.map((day) => (
                <th
                  key={day}
                  className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {activePeriods.map((period) => {
              const isBreak = period.type === "BREAK" || period.type === "ASSEMBLY";
              return (
                <tr key={period.order} className={isBreak ? "bg-muted/30" : ""}>
                  <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                    {period.name}
                    {isBreak && (
                      <span className="ml-2 inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        {period.type}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {period.startTime} - {period.endTime}
                  </td>
                  {DAYS.map((_, dayIndex) => {
                    const dayOfWeek = dayIndex + 1;
                    const entry = slotMap.get(`${dayOfWeek}-${period.order}`);

                    if (isBreak) {
                      return (
                        <td
                          key={dayIndex}
                          className="px-2 py-2 text-center text-xs text-muted-foreground"
                        >
                          {dayIndex === 0 ? period.name : ""}
                        </td>
                      );
                    }

                    return (
                      <td key={dayIndex} className="px-2 py-2 text-sm">
                        {entry ? (
                          <div className="rounded-md border bg-primary/5 p-2 text-xs">
                            <div className="font-semibold text-primary">
                              {entry.subject.code || entry.subject.name}
                            </div>
                            <div className="text-muted-foreground">{entry.className}</div>
                            {entry.room && (
                              <div className="text-muted-foreground">{entry.room}</div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-md bg-green-50 p-2 text-center text-xs text-green-600">
                            Free
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
