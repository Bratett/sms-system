import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, hasApiPermission } from "@/lib/api/auth";
import { apiError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { generateIcal } from "@/modules/timetable/lib/ical-generator";

/**
 * GET /api/v1/timetable/ical?type=student|teacher|room&id=xxx
 *
 * Returns an iCalendar (.ics) file for the specified timetable view.
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if ("error" in authResult) {
    return apiError(authResult.error, authResult.status);
  }

  if (!hasApiPermission(authResult, "timetable:slots:read")) {
    return apiError("Insufficient permissions", 403);
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type"); // student, teacher, room
  const id = searchParams.get("id");

  if (!type || !id) {
    return apiError("type and id query parameters are required", 400);
  }

  if (!["student", "teacher", "room"].includes(type)) {
    return apiError("type must be student, teacher, or room", 400);
  }

  const currentTerm = await db.term.findFirst({
    where: { isCurrent: true },
    select: { id: true, startDate: true, endDate: true, name: true },
  });

  if (!currentTerm) {
    return apiError("No active term found", 404);
  }

  // Build query based on type
  let where: Record<string, unknown> = { termId: currentTerm.id };
  let calendarName = "Timetable";

  if (type === "student") {
    // Get enrollment to find classArmId
    const enrollment = await db.enrollment.findFirst({
      where: { studentId: id, status: "ACTIVE" },
      orderBy: { academicYearId: "desc" },
      select: { classArmId: true },
    });
    if (!enrollment) return apiError("Student enrollment not found", 404);

    where.classArmId = enrollment.classArmId;

    const student = await db.student.findUnique({
      where: { id },
      select: { firstName: true, lastName: true },
    });
    calendarName = student ? `${student.firstName} ${student.lastName} - Timetable` : "Student Timetable";
  } else if (type === "teacher") {
    where.teacherId = id;

    const user = await db.user.findUnique({
      where: { id },
      select: { firstName: true, lastName: true },
    });
    calendarName = user ? `${user.firstName} ${user.lastName} - Teaching Schedule` : "Teacher Timetable";
  } else if (type === "room") {
    where.roomId = id;

    const room = await db.room.findUnique({
      where: { id },
      select: { name: true },
    });
    calendarName = room ? `${room.name} - Room Schedule` : "Room Timetable";
  }

  const slots = await db.timetableSlot.findMany({
    where,
    include: {
      subject: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
      classArm: { select: { name: true, class: { select: { name: true } } } },
      period: { select: { startTime: true, endTime: true } },
      room: { select: { name: true } },
    },
  });

  const events = slots.map((slot) => ({
    subject: slot.subject.name,
    teacher: `${slot.teacher.firstName} ${slot.teacher.lastName}`,
    className: `${slot.classArm.class.name} ${slot.classArm.name}`,
    room: slot.room?.name,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.period.startTime,
    endTime: slot.period.endTime,
    termStartDate: currentTerm.startDate,
    termEndDate: currentTerm.endDate,
  }));

  const icalContent = generateIcal({
    events,
    calendarName,
    description: `Schedule for ${currentTerm.name}`,
  });

  return new NextResponse(icalContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${calendarName.replace(/[^a-zA-Z0-9-_]/g, "_")}.ics"`,
    },
  });
}
