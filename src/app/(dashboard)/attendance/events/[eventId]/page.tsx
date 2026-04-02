import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";
import { getEventAttendanceAction } from "@/modules/attendance/actions/event-attendance.action";
import { EventDetailClient } from "./event-detail-client";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EventAttendanceDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const { eventId } = await params;

  // Get event details
  const event = await db.academicEvent.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, type: true, startDate: true, endDate: true },
  });

  if (!event) notFound();

  // Get existing attendance records
  const attendanceResult = await getEventAttendanceAction(eventId);

  // Get all active students for recording
  const enrollments = await db.enrollment.findMany({
    where: { status: "ACTIVE" },
    include: {
      student: {
        select: { id: true, studentId: true, firstName: true, lastName: true },
      },
      classArm: {
        select: { name: true, class: { select: { name: true } } },
      },
    },
    orderBy: { student: { firstName: "asc" } },
  });

  const students = enrollments.map((e) => ({
    id: e.student.id,
    studentId: e.student.studentId,
    firstName: e.student.firstName,
    lastName: e.student.lastName,
    className: `${e.classArm.class.name} ${e.classArm.name}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Event Attendance: ${event.title}`}
        description={`Record attendance for this ${event.type.replace(/_/g, " ").toLowerCase()}.`}
        actions={
          <Link
            href="/attendance/events"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Events
          </Link>
        }
      />
      <EventDetailClient
        eventId={event.id}
        students={students}
        existingRecords={attendanceResult.data ?? []}
      />
    </div>
  );
}
