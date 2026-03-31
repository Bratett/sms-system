"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── PTC Session CRUD ────────────────────────────────────────────────

export async function createPTCSessionAction(data: {
  academicYearId: string;
  termId: string;
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  slotDuration?: number;
  location?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const ptcSession = await db.pTCSession.create({
    data: {
      schoolId: school.id,
      academicYearId: data.academicYearId,
      termId: data.termId,
      title: data.title,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      slotDuration: data.slotDuration ?? 15,
      location: data.location,
      createdBy: session.user.id!,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "PTCSession",
    entityId: ptcSession.id,
    module: "communication",
    description: `Created PTC session: ${data.title}`,
  });

  return { data: ptcSession };
}

export async function getPTCSessionsAction(filters?: {
  academicYearId?: string;
  termId?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const where: Record<string, unknown> = { schoolId: school.id };
  if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters?.termId) where.termId = filters.termId;

  const sessions = await db.pTCSession.findMany({
    where,
    include: { bookings: { select: { id: true } } },
    orderBy: { date: "desc" },
  });

  const data = sessions.map((s) => ({
    ...s,
    bookingCount: s.bookings.length,
    bookings: undefined,
  }));

  return { data };
}

export async function deletePTCSessionAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  await db.pTCSession.delete({ where: { id } });
  return { data: { deleted: true } };
}

// ─── Slot Management ─────────────────────────────────────────────────

export async function getAvailableSlotsAction(sessionId: string, teacherId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const ptcSession = await db.pTCSession.findUnique({ where: { id: sessionId } });
  if (!ptcSession) return { error: "PTC session not found." };

  // Generate all possible time slots
  const slots: string[] = [];
  const [startH, startM] = ptcSession.startTime.split(":").map(Number);
  const [endH, endM] = ptcSession.endTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  for (let m = startMinutes; m < endMinutes; m += ptcSession.slotDuration) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }

  // Get booked slots for this teacher
  const bookings = await db.pTCBooking.findMany({
    where: { sessionId, teacherId, status: { not: "CANCELLED" } },
    select: { timeSlot: true },
  });
  const bookedSlots = new Set(bookings.map((b) => b.timeSlot));

  const available = slots.map((slot) => ({
    timeSlot: slot,
    isBooked: bookedSlots.has(slot),
  }));

  return { data: available };
}

export async function bookSlotAction(data: {
  sessionId: string;
  teacherId: string;
  parentId: string;
  studentId: string;
  timeSlot: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  // Check if slot is already booked
  const existing = await db.pTCBooking.findFirst({
    where: {
      sessionId: data.sessionId,
      teacherId: data.teacherId,
      timeSlot: data.timeSlot,
      status: { not: "CANCELLED" },
    },
  });

  if (existing) return { error: "This time slot is already booked." };

  const booking = await db.pTCBooking.create({
    data: {
      sessionId: data.sessionId,
      teacherId: data.teacherId,
      parentId: data.parentId,
      studentId: data.studentId,
      timeSlot: data.timeSlot,
    },
  });

  return { data: booking };
}

export async function cancelBookingAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const booking = await db.pTCBooking.findUnique({ where: { id } });
  if (!booking) return { error: "Booking not found." };

  await db.pTCBooking.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return { data: { cancelled: true } };
}

export async function getTeacherPTCScheduleAction(sessionId: string, teacherId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const bookings = await db.pTCBooking.findMany({
    where: { sessionId, teacherId },
    orderBy: { timeSlot: "asc" },
  });

  const studentIds = bookings.map((b) => b.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const data = bookings.map((b) => {
    const student = studentMap.get(b.studentId);
    return {
      ...b,
      studentName: student ? `${student.lastName} ${student.firstName}` : "Unknown",
      studentIdNumber: student?.studentId ?? "",
    };
  });

  return { data };
}
