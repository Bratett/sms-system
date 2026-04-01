"use client";

import { format } from "date-fns";
import Link from "next/link";

interface EventRow {
  id: string;
  title: string;
  type: string;
  startDate: Date;
  endDate: Date | null;
  isAllDay: boolean;
  attendanceCount: number;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  SPORTS_DAY: "bg-green-100 text-green-700",
  CULTURAL_EVENT: "bg-purple-100 text-purple-700",
  PTA_MEETING: "bg-blue-100 text-blue-700",
  ORIENTATION: "bg-teal-100 text-teal-700",
  GRADUATION_CEREMONY: "bg-yellow-100 text-yellow-700",
  OTHER: "bg-gray-100 text-gray-700",
};

export function EventAttendanceClient({ events }: { events: EventRow[] }) {
  const attendableEvents = events.filter(
    (e) =>
      e.type !== "EXAM_PERIOD" &&
      e.type !== "HOLIDAY" &&
      e.type !== "HALF_TERM" &&
      e.type !== "MARK_DEADLINE" &&
      e.type !== "REGISTRATION",
  );

  return (
    <>
      {attendableEvents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">
            No attendable events found for the current term. Events like sports days, assemblies, and
            cultural events will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {attendableEvents.map((event) => (
            <div key={event.id} className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{event.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(event.startDate), "dd MMM yyyy")}
                    {event.endDate && ` - ${format(new Date(event.endDate), "dd MMM yyyy")}`}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    EVENT_TYPE_COLORS[event.type] ?? EVENT_TYPE_COLORS.OTHER
                  }`}
                >
                  {event.type.replace(/_/g, " ")}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {event.attendanceCount > 0
                    ? `${event.attendanceCount} recorded`
                    : "No attendance yet"}
                </span>
                <Link
                  href={`/attendance/events/${event.id}`}
                  className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {event.attendanceCount > 0 ? "View / Edit" : "Take Attendance"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
