"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Open/Get Attendance Register ────────────────────────────────────

export async function openAttendanceRegisterAction(data: {
  classArmId: string;
  date: string;
  type?: "DAILY" | "PERIOD";
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const type = data.type ?? "DAILY";
  const dateObj = new Date(data.date);
  // Normalize to start of day
  dateObj.setHours(0, 0, 0, 0);

  // Check if register already exists for this class/date/type
  const existing = await db.attendanceRegister.findFirst({
    where: {
      classArmId: data.classArmId,
      date: dateObj,
      type,
    },
    include: {
      records: {
        include: {
          register: false,
        },
      },
    },
  });

  if (existing) {
    // Return existing register with enrolled students
    const enrollments = await db.enrollment.findMany({
      where: {
        classArmId: data.classArmId,
        status: "ACTIVE",
      },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
      },
      orderBy: { student: { firstName: "asc" } },
    });

    const students = enrollments.map((e) => ({
      id: e.student.id,
      studentId: e.student.studentId,
      firstName: e.student.firstName,
      lastName: e.student.lastName,
      photoUrl: e.student.photoUrl,
    }));

    return {
      data: {
        register: {
          id: existing.id,
          classArmId: existing.classArmId,
          date: existing.date,
          type: existing.type,
          status: existing.status,
          takenBy: existing.takenBy,
        },
        records: existing.records.map((r) => ({
          id: r.id,
          studentId: r.studentId,
          status: r.status,
          remarks: r.remarks,
        })),
        students,
        isExisting: true,
      },
    };
  }

  // Create new register
  const register = await db.attendanceRegister.create({
    data: {
      classArmId: data.classArmId,
      date: dateObj,
      type,
      takenBy: session.user.id!,
    },
  });

  // Get enrolled students
  const enrollments = await db.enrollment.findMany({
    where: {
      classArmId: data.classArmId,
      status: "ACTIVE",
    },
    include: {
      student: {
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
        },
      },
    },
    orderBy: { student: { firstName: "asc" } },
  });

  const students = enrollments.map((e) => ({
    id: e.student.id,
    studentId: e.student.studentId,
    firstName: e.student.firstName,
    lastName: e.student.lastName,
    photoUrl: e.student.photoUrl,
  }));

  return {
    data: {
      register: {
        id: register.id,
        classArmId: register.classArmId,
        date: register.date,
        type: register.type,
        status: register.status,
        takenBy: register.takenBy,
      },
      records: [],
      students,
      isExisting: false,
    },
  };
}

export async function getAttendanceRegisterAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const register = await db.attendanceRegister.findUnique({
    where: { id },
    include: {
      records: true,
    },
  });

  if (!register) {
    return { error: "Attendance register not found." };
  }

  // Get enrolled students
  const enrollments = await db.enrollment.findMany({
    where: {
      classArmId: register.classArmId,
      status: "ACTIVE",
    },
    include: {
      student: {
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
        },
      },
    },
    orderBy: { student: { firstName: "asc" } },
  });

  const students = enrollments.map((e) => ({
    id: e.student.id,
    studentId: e.student.studentId,
    firstName: e.student.firstName,
    lastName: e.student.lastName,
    photoUrl: e.student.photoUrl,
  }));

  return {
    data: {
      register: {
        id: register.id,
        classArmId: register.classArmId,
        date: register.date,
        type: register.type,
        status: register.status,
        takenBy: register.takenBy,
      },
      records: register.records.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        status: r.status,
        remarks: r.remarks,
      })),
      students,
    },
  };
}

// ─── Record Attendance ───────────────────────────────────────────────

export async function recordAttendanceAction(
  registerId: string,
  records: Array<{
    studentId: string;
    status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "SICK";
    remarks?: string;
  }>,
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const register = await db.attendanceRegister.findUnique({
    where: { id: registerId },
  });

  if (!register) {
    return { error: "Attendance register not found." };
  }

  if (register.status === "CLOSED") {
    return { error: "This attendance register is closed and cannot be edited." };
  }

  // Batch upsert attendance records
  const upserts = records.map((record) =>
    db.attendanceRecord.upsert({
      where: {
        registerId_studentId: {
          registerId,
          studentId: record.studentId,
        },
      },
      create: {
        registerId,
        studentId: record.studentId,
        status: record.status,
        remarks: record.remarks || null,
      },
      update: {
        status: record.status,
        remarks: record.remarks || null,
      },
    }),
  );

  await db.$transaction(upserts);

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "AttendanceRegister",
    entityId: registerId,
    module: "attendance",
    description: `Recorded attendance for ${records.length} students`,
    newData: { recordCount: records.length },
  });

  return { success: true };
}

// ─── Close Register ──────────────────────────────────────────────────

export async function closeAttendanceRegisterAction(registerId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const register = await db.attendanceRegister.findUnique({
    where: { id: registerId },
  });

  if (!register) {
    return { error: "Attendance register not found." };
  }

  if (register.status === "CLOSED") {
    return { error: "Register is already closed." };
  }

  await db.attendanceRegister.update({
    where: { id: registerId },
    data: { status: "CLOSED" },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "AttendanceRegister",
    entityId: registerId,
    module: "attendance",
    description: "Closed attendance register",
  });

  return { success: true };
}

// ─── Attendance History ──────────────────────────────────────────────

export async function getAttendanceHistoryAction(filters: {
  classArmId?: string;
  date?: string;
  studentId?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (filters.classArmId) where.classArmId = filters.classArmId;
  if (filters.date) {
    const dateObj = new Date(filters.date);
    dateObj.setHours(0, 0, 0, 0);
    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);
    where.date = { gte: dateObj, lt: nextDay };
  }

  const [registers, total] = await Promise.all([
    db.attendanceRegister.findMany({
      where,
      include: {
        records: {
          ...(filters.studentId ? { where: { studentId: filters.studentId } } : {}),
        },
      },
      orderBy: { date: "desc" },
      take: pageSize,
      skip,
    }),
    db.attendanceRegister.count({ where }),
  ]);

  // Get class arm info
  const classArmIds = [...new Set(registers.map((r) => r.classArmId))];
  const classArms = await db.classArm.findMany({
    where: { id: { in: classArmIds } },
    select: {
      id: true,
      name: true,
      class: { select: { name: true } },
    },
  });
  const classArmMap = new Map(
    classArms.map((ca) => [ca.id, `${ca.class.name} ${ca.name}`]),
  );

  const data = registers.map((reg) => ({
    id: reg.id,
    classArmId: reg.classArmId,
    classArmName: classArmMap.get(reg.classArmId) ?? "Unknown",
    date: reg.date,
    type: reg.type,
    status: reg.status,
    recordCount: reg.records.length,
    presentCount: reg.records.filter((r) => r.status === "PRESENT").length,
    absentCount: reg.records.filter((r) => r.status === "ABSENT").length,
    lateCount: reg.records.filter((r) => r.status === "LATE").length,
  }));

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// ─── Attendance Summary ──────────────────────────────────────────────

export async function getAttendanceSummaryAction(classArmId: string, termId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  // Get term date range
  const term = await db.term.findUnique({
    where: { id: termId },
    select: { startDate: true, endDate: true },
  });

  if (!term) {
    return { error: "Term not found." };
  }

  // Get all registers for this class arm within the term date range
  const registers = await db.attendanceRegister.findMany({
    where: {
      classArmId,
      date: {
        gte: term.startDate,
        lte: term.endDate,
      },
    },
    include: {
      records: true,
    },
  });

  const totalDays = registers.length;

  // Get enrolled students
  const enrollments = await db.enrollment.findMany({
    where: {
      classArmId,
      status: "ACTIVE",
    },
    include: {
      student: {
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { student: { firstName: "asc" } },
  });

  // Build per-student summary
  const allRecords = registers.flatMap((r) => r.records);
  const recordsByStudent = new Map<string, typeof allRecords>();

  for (const record of allRecords) {
    const existing = recordsByStudent.get(record.studentId) ?? [];
    existing.push(record);
    recordsByStudent.set(record.studentId, existing);
  }

  const data = enrollments.map((e) => {
    const records = recordsByStudent.get(e.student.id) ?? [];
    const present = records.filter((r) => r.status === "PRESENT").length;
    const absent = records.filter((r) => r.status === "ABSENT").length;
    const late = records.filter((r) => r.status === "LATE").length;
    const excused = records.filter((r) => r.status === "EXCUSED" || r.status === "SICK").length;
    const attendanceRate = totalDays > 0 ? Math.round(((present + late) / totalDays) * 100) : 0;

    return {
      studentId: e.student.id,
      studentNumber: e.student.studentId,
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      totalDays,
      present,
      absent,
      late,
      excused,
      attendanceRate,
    };
  });

  return { data, totalDays };
}

// ─── Student Attendance ──────────────────────────────────────────────

export async function getStudentAttendanceAction(studentId: string, termId?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const where: Record<string, unknown> = {
    studentId,
  };

  // If termId provided, filter registers by term date range
  if (termId) {
    const term = await db.term.findUnique({
      where: { id: termId },
      select: { startDate: true, endDate: true },
    });

    if (term) {
      const registerIds = await db.attendanceRegister.findMany({
        where: {
          date: {
            gte: term.startDate,
            lte: term.endDate,
          },
        },
        select: { id: true },
      });

      where.registerId = { in: registerIds.map((r) => r.id) };
    }
  }

  const records = await db.attendanceRecord.findMany({
    where,
    include: {
      register: {
        select: {
          id: true,
          classArmId: true,
          date: true,
          type: true,
        },
      },
    },
    orderBy: { register: { date: "desc" } },
  });

  const data = records.map((r) => ({
    id: r.id,
    date: r.register.date,
    type: r.register.type,
    status: r.status,
    remarks: r.remarks,
  }));

  return { data };
}
