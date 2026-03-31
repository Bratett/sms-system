"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Generate Seating Arrangement ────────────────────────────────────

export async function generateSeatingArrangementAction(
  examScheduleId: string,
  strategy: "SEQUENTIAL" | "RANDOM" | "ALPHABETICAL" = "ALPHABETICAL",
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const exam = await db.examSchedule.findUnique({
    where: { id: examScheduleId },
    include: { class: { include: { classArms: { select: { id: true } } } } },
  });

  if (!exam) return { error: "Exam schedule not found." };

  // Get all enrolled students in this class's arms
  const classArmIds = exam.class.classArms.map((a) => a.id);
  const enrollments = await db.enrollment.findMany({
    where: { classArmId: { in: classArmIds }, academicYearId: exam.academicYearId, status: "ACTIVE" },
    include: { student: { select: { id: true, firstName: true, lastName: true } } },
  });

  let students = enrollments.map((e) => e.student);

  // Sort based on strategy
  if (strategy === "ALPHABETICAL") {
    students.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  } else if (strategy === "RANDOM") {
    for (let i = students.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [students[i], students[j]] = [students[j], students[i]];
    }
  }

  // Get available rooms
  const rooms = await db.room.findMany({
    where: { schoolId: exam.schoolId, isActive: true },
    orderBy: { name: "asc" },
  });

  if (rooms.length === 0) return { error: "No rooms configured." };

  // Clear existing arrangements
  await db.examSeatingArrangement.deleteMany({ where: { examScheduleId } });

  // Assign seats
  const arrangements: Array<{
    examScheduleId: string;
    studentId: string;
    seatNumber: string;
    roomId: string;
  }> = [];

  let roomIndex = 0;
  let seatInRoom = 1;
  const roomCapacities = new Map(rooms.map((r) => [r.id, r.capacity ?? 40]));

  for (const student of students) {
    const room = rooms[roomIndex];
    const capacity = roomCapacities.get(room.id) ?? 40;

    arrangements.push({
      examScheduleId,
      studentId: student.id,
      seatNumber: String(seatInRoom).padStart(3, "0"),
      roomId: room.id,
    });

    seatInRoom++;
    if (seatInRoom > capacity) {
      seatInRoom = 1;
      roomIndex++;
      if (roomIndex >= rooms.length) roomIndex = 0; // wrap around if needed
    }
  }

  if (arrangements.length > 0) {
    await db.examSeatingArrangement.createMany({ data: arrangements });
  }

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "ExamSeatingArrangement",
    entityId: examScheduleId,
    module: "timetable",
    description: `Generated ${arrangements.length} seating arrangements (${strategy})`,
  });

  return { data: { created: arrangements.length, roomsUsed: new Set(arrangements.map((a) => a.roomId)).size } };
}

// ─── Get Seating Arrangement ─────────────────────────────────────────

export async function getSeatingArrangementAction(examScheduleId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const arrangements = await db.examSeatingArrangement.findMany({
    where: { examScheduleId },
    include: {
      room: { select: { id: true, name: true, building: true } },
    },
    orderBy: [{ roomId: "asc" }, { seatNumber: "asc" }],
  });

  const studentIds = arrangements.map((a) => a.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const data = arrangements.map((a) => {
    const student = studentMap.get(a.studentId);
    return {
      id: a.id,
      seatNumber: a.seatNumber,
      roomId: a.roomId,
      roomName: a.room.name,
      building: a.room.building,
      studentId: a.studentId,
      studentIdNumber: student?.studentId ?? "",
      studentName: student ? `${student.lastName} ${student.firstName}` : "Unknown",
    };
  });

  return { data };
}

// ─── Generate Score Sheet Data ───────────────────────────────────────

export async function generateScoreSheetAction(examScheduleId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const exam = await db.examSchedule.findUnique({
    where: { id: examScheduleId },
    include: {
      subject: { select: { name: true, code: true } },
      class: { select: { name: true } },
    },
  });

  if (!exam) return { error: "Exam schedule not found." };

  const arrangements = await db.examSeatingArrangement.findMany({
    where: { examScheduleId },
    include: { room: { select: { name: true } } },
    orderBy: [{ roomId: "asc" }, { seatNumber: "asc" }],
  });

  const studentIds = arrangements.map((a) => a.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const scoreSheet = {
    subject: exam.subject.name,
    subjectCode: exam.subject.code,
    className: exam.class.name,
    date: exam.date,
    startTime: exam.startTime,
    endTime: exam.endTime,
    students: arrangements.map((a) => {
      const student = studentMap.get(a.studentId);
      return {
        seatNumber: a.seatNumber,
        room: a.room.name,
        studentId: student?.studentId ?? "",
        studentName: student ? `${student.lastName} ${student.firstName}` : "Unknown",
        score: null as number | null,
      };
    }),
  };

  return { data: scoreSheet };
}
