"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";

// ─── Open/Get Attendance Register ────────────────────────────────────

export async function openAttendanceRegisterAction(data: {
  classArmId: string;
  date: string;
  type?: "DAILY" | "PERIOD";
  periodId?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const type = data.type ?? "DAILY";
  const dateObj = new Date(data.date);
  dateObj.setHours(0, 0, 0, 0);

  let substituteForId: string | undefined;

  // For PERIOD attendance, validate periodId exists
  if (type === "PERIOD" && !data.periodId) {
    return { error: "Period is required for period-based attendance." };
  }

  // If period-based, validate the period exists in the timetable for this class arm + day
  // Also check if user is the scheduled teacher OR an approved substitute
  if (type === "PERIOD" && data.periodId) {
    const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay(); // 1=Mon, 7=Sun
    const currentTerm = await db.term.findFirst({ where: { isCurrent: true } });

    if (currentTerm) {
      const slot = await db.timetableSlot.findFirst({
        where: {
          classArmId: data.classArmId,
          periodId: data.periodId,
          dayOfWeek,
          termId: currentTerm.id,
        },
      });

      if (!slot) {
        return { error: "No timetable slot found for this class, period, and day." };
      }

      // Check if there's an approved substitution for this slot on this date
      const substitution = await db.timetableSubstitution.findFirst({
        where: {
          timetableSlotId: slot.id,
          date: dateObj,
          status: "APPROVED",
          substituteTeacherId: ctx.session.user.id,
        },
      });

      // If the user is a substitute, track it
      if (substitution) {
        substituteForId = slot.teacherId;
      }
    }
  }

  // Check if register already exists for this class/date/type/period
  const existing = await db.attendanceRegister.findFirst({
    where: {
      classArmId: data.classArmId,
      date: dateObj,
      type,
      periodId: data.periodId ?? null,
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
          periodId: existing.periodId,
          status: existing.status,
          takenBy: existing.takenBy,
        },
        records: existing.records.map((r) => ({
          id: r.id,
          studentId: r.studentId,
          status: r.status,
          remarks: r.remarks,
          arrivalTime: r.arrivalTime,
        })),
        students,
        isExisting: true,
      },
    };
  }

  // Create new register
  const register = await db.attendanceRegister.create({
    data: {
      schoolId: ctx.schoolId,
      classArmId: data.classArmId,
      date: dateObj,
      type,
      periodId: data.periodId ?? null,
      takenBy: ctx.session.user.id,
      substituteForId: substituteForId ?? null,
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
        periodId: register.periodId,
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
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

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
        periodId: register.periodId,
        status: register.status,
        takenBy: register.takenBy,
      },
      records: register.records.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        status: r.status,
        remarks: r.remarks,
        arrivalTime: r.arrivalTime,
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
    arrivalTime?: string;
  }>,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ATTENDANCE_CREATE);
  if (denied) return denied;

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
        schoolId: ctx.schoolId,
        registerId,
        studentId: record.studentId,
        status: record.status,
        remarks: record.remarks || null,
        arrivalTime: record.arrivalTime ? new Date(record.arrivalTime) : null,
      },
      update: {
        status: record.status,
        remarks: record.remarks || null,
        arrivalTime: record.arrivalTime ? new Date(record.arrivalTime) : null,
      },
    }),
  );

  await db.$transaction(upserts);

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "AttendanceRegister",
    entityId: registerId,
    module: "attendance",
    description: `Recorded attendance for ${records.length} students`,
    newData: { recordCount: records.length },
  });

  // Dispatch notifications for absent/late students
  const absentStudents = records.filter((r) => r.status === "ABSENT");
  const lateStudents = records.filter((r) => r.status === "LATE");

  if (absentStudents.length > 0 || lateStudents.length > 0) {
    // Get student details and guardian contacts for notifications
    const studentIds = [...absentStudents, ...lateStudents].map((r) => r.studentId);
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        guardians: {
          include: {
            guardian: {
              select: {
                userId: true,
                phone: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    const studentMap = new Map(students.map((s) => [s.id, s]));

    // Notify for absent students
    for (const record of absentStudents) {
      const student = studentMap.get(record.studentId);
      if (!student) continue;

      const guardianRecipients = student.guardians.map((sg) => ({
        userId: sg.guardian.userId ?? undefined,
        phone: sg.guardian.phone ?? undefined,
        email: sg.guardian.email ?? undefined,
        name: `${sg.guardian.firstName} ${sg.guardian.lastName}`,
      }));

      if (guardianRecipients.length > 0) {
        dispatch({
          event: NOTIFICATION_EVENTS.STUDENT_ABSENT,
          title: "Student Absent",
          message: `${student.firstName} ${student.lastName} was marked absent on ${register.date.toLocaleDateString()}.`,
          recipients: guardianRecipients,
          schoolId: register.schoolId,
        }).catch(() => {}); // fire and forget
      }
    }

    // Notify for late students
    for (const record of lateStudents) {
      const student = studentMap.get(record.studentId);
      if (!student) continue;

      const guardianRecipients = student.guardians.map((sg) => ({
        userId: sg.guardian.userId ?? undefined,
        phone: sg.guardian.phone ?? undefined,
        email: sg.guardian.email ?? undefined,
        name: `${sg.guardian.firstName} ${sg.guardian.lastName}`,
      }));

      if (guardianRecipients.length > 0) {
        dispatch({
          event: NOTIFICATION_EVENTS.STUDENT_LATE,
          title: "Student Late",
          message: `${student.firstName} ${student.lastName} was marked late on ${register.date.toLocaleDateString()}.`,
          recipients: guardianRecipients,
          schoolId: register.schoolId,
        }).catch(() => {}); // fire and forget
      }
    }
  }

  return { success: true };
}

// ─── Close Register ──────────────────────────────────────────────────

export async function closeAttendanceRegisterAction(registerId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

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
    userId: ctx.session.user.id,
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
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  where.schoolId = ctx.schoolId;
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
    periodId: reg.periodId,
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
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ATTENDANCE_READ);
  if (denied) return denied;

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
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ATTENDANCE_READ);
  if (denied) return denied;

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
          periodId: true,
        },
      },
    },
    orderBy: { register: { date: "desc" } },
  });

  const data = records.map((r) => ({
    id: r.id,
    date: r.register.date,
    type: r.register.type,
    periodId: r.register.periodId,
    status: r.status,
    remarks: r.remarks,
    arrivalTime: r.arrivalTime,
  }));

  return { data };
}

// ─── Generate Attendance Registers from Timetable ───────────────────

export async function generateDailyRegistersFromTimetableAction(data: {
  classArmId: string;
  date: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const dateObj = new Date(data.date);
  dateObj.setHours(0, 0, 0, 0);
  const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay();

  const currentTerm = await db.term.findFirst({ where: { isCurrent: true } });
  if (!currentTerm) {
    return { error: "No active term found." };
  }

  // Get timetable slots for this class arm on this day
  const slots = await db.timetableSlot.findMany({
    where: {
      classArmId: data.classArmId,
      dayOfWeek,
      termId: currentTerm.id,
    },
    include: {
      period: { select: { id: true, name: true, type: true } },
    },
  });

  // Filter to lesson periods only
  const lessonSlots = slots.filter((s) => s.period.type === "LESSON");

  if (lessonSlots.length === 0) {
    return { error: "No lesson periods found in the timetable for this day." };
  }

  let created = 0;
  let existing = 0;

  for (const slot of lessonSlots) {
    // Check if register already exists
    const existingRegister = await db.attendanceRegister.findFirst({
      where: {
        classArmId: data.classArmId,
        date: dateObj,
        type: "PERIOD",
        periodId: slot.period.id,
      },
    });

    if (existingRegister) {
      existing++;
      continue;
    }

    await db.attendanceRegister.create({
      data: {
        schoolId: ctx.schoolId,
        classArmId: data.classArmId,
        date: dateObj,
        type: "PERIOD",
        periodId: slot.period.id,
        takenBy: ctx.session.user.id,
      },
    });
    created++;
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "AttendanceRegister",
    entityId: data.classArmId,
    module: "attendance",
    description: `Generated ${created} period-based attendance registers from timetable`,
    metadata: { classArmId: data.classArmId, date: data.date, created, existing },
  });

  return { data: { created, existing, total: lessonSlots.length } };
}
