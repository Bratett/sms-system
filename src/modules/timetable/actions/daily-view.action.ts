"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * Get a teacher's daily schedule with attendance status per period.
 * Combines timetable slots with attendance register state.
 */
export async function getTeacherDailyViewAction(date: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { data: { periods: [], schedule: [] } };

  const dateObj = new Date(date);
  dateObj.setHours(0, 0, 0, 0);
  const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay();

  const currentTerm = await db.term.findFirst({ where: { isCurrent: true } });
  if (!currentTerm) return { data: { periods: [], schedule: [] } };

  // Get all periods
  const periods = await db.period.findMany({
    where: { schoolId: school.id, isActive: true },
    orderBy: { order: "asc" },
    select: { id: true, name: true, startTime: true, endTime: true, order: true, type: true },
  });

  // Get teacher's timetable slots for this day
  const slots = await db.timetableSlot.findMany({
    where: {
      teacherId: session.user.id,
      dayOfWeek,
      termId: currentTerm.id,
    },
    include: {
      subject: { select: { name: true, code: true } },
      classArm: { select: { id: true, name: true, class: { select: { name: true } } } },
      period: { select: { id: true, name: true, order: true } },
      room: { select: { name: true } },
    },
  });

  // Check if substitution exists for any slot
  const slotIds = slots.map((s) => s.id);
  const substitutions = slotIds.length > 0
    ? await db.timetableSubstitution.findMany({
        where: {
          timetableSlotId: { in: slotIds },
          date: dateObj,
          status: { in: ["APPROVED", "COMPLETED"] },
        },
        select: { timetableSlotId: true, substituteTeacherId: true },
      })
    : [];
  const substitutionMap = new Map(substitutions.map((s) => [s.timetableSlotId, s]));

  // Get attendance registers for these class arms on this date
  const classArmIds = [...new Set(slots.map((s) => s.classArm.id))];
  const registers = classArmIds.length > 0
    ? await db.attendanceRegister.findMany({
        where: {
          classArmId: { in: classArmIds },
          date: dateObj,
        },
        select: {
          id: true,
          classArmId: true,
          periodId: true,
          type: true,
          status: true,
          _count: { select: { records: true } },
        },
      })
    : [];

  // Build a map: `classArmId-periodId` -> register info
  const registerMap = new Map<string, typeof registers[0]>();
  for (const reg of registers) {
    if (reg.type === "PERIOD" && reg.periodId) {
      registerMap.set(`${reg.classArmId}-${reg.periodId}`, reg);
    }
  }
  // Also check for DAILY registers (no period)
  const dailyRegisters = registers.filter((r) => r.type === "DAILY");
  const dailyRegisterMap = new Map(dailyRegisters.map((r) => [r.classArmId, r]));

  // Build schedule entries
  const slotByPeriod = new Map(slots.map((s) => [s.period.id, s]));

  const schedule = periods.map((period) => {
    const slot = slotByPeriod.get(period.id);

    if (!slot) {
      return {
        periodId: period.id,
        periodName: period.name,
        startTime: period.startTime,
        endTime: period.endTime,
        periodType: period.type,
        isTeaching: false,
        subject: null,
        className: null,
        room: null,
        attendanceStatus: null as string | null,
        attendanceRegisterId: null as string | null,
        recordCount: 0,
        isSubstituted: false,
      };
    }

    const sub = substitutionMap.get(slot.id);
    const isSubstituted = !!sub;

    // Check for attendance register (prefer PERIOD, fallback to DAILY)
    const periodRegister = registerMap.get(`${slot.classArm.id}-${period.id}`);
    const dailyRegister = dailyRegisterMap.get(slot.classArm.id);
    const register = periodRegister ?? dailyRegister;

    return {
      periodId: period.id,
      periodName: period.name,
      startTime: period.startTime,
      endTime: period.endTime,
      periodType: period.type,
      isTeaching: true,
      subject: slot.subject.code || slot.subject.name,
      className: `${slot.classArm.class.name} ${slot.classArm.name}`,
      classArmId: slot.classArm.id,
      room: slot.room?.name ?? null,
      attendanceStatus: register ? register.status : null,
      attendanceRegisterId: register?.id ?? null,
      recordCount: register?._count.records ?? 0,
      isSubstituted,
    };
  });

  return { data: { periods, schedule } };
}
