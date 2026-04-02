import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getEventsWithAttendanceAction } from "@/modules/attendance/actions/event-attendance.action";
import { EventAttendanceClient } from "./event-attendance-client";
import Link from "next/link";

export default async function EventAttendancePage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getEventsWithAttendanceAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Attendance"
        description="Record and view attendance for assemblies, sports days, field trips, and other events."
        actions={
          <Link
            href="/attendance"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Attendance
          </Link>
        }
      />
      <EventAttendanceClient events={result.data ?? []} />
    </div>
  );
}
