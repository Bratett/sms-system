"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Rooms ──────────────────────────────────────────────────────────

export async function createRoomAction(data: {
  name: string;
  building?: string;
  capacity?: number;
  type: "CLASSROOM" | "LABORATORY" | "HALL" | "FIELD" | "OTHER";
  features?: string[];
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  // Check for duplicate name
  const existing = await db.room.findUnique({
    where: {
      schoolId_name: {
        schoolId: ctx.schoolId,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { error: `A room named "${data.name}" already exists.` };
  }

  const room = await db.room.create({
    data: {
      schoolId: ctx.schoolId,
      name: data.name,
      building: data.building || null,
      capacity: data.capacity ?? null,
      type: data.type,
      features: data.features ?? [],
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Room",
    entityId: room.id,
    module: "timetable",
    description: `Created room "${room.name}"`,
    newData: room,
  });

  return { data: room };
}

export async function getRoomsAction(filters?: {
  type?: string;
  isActive?: boolean;
  search?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };

  if (filters?.type) {
    where.type = filters.type;
  }
  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { building: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const rooms = await db.room.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { timetableSlots: true },
      },
    },
  });

  const data = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    building: room.building,
    capacity: room.capacity,
    type: room.type,
    isActive: room.isActive,
    slotsCount: room._count.timetableSlots,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  }));

  return { data };
}

export async function updateRoomAction(
  id: string,
  data: {
    name?: string;
    building?: string | null;
    capacity?: number | null;
    type?: "CLASSROOM" | "LABORATORY" | "HALL" | "FIELD" | "OTHER";
    isActive?: boolean;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const existing = await db.room.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Room not found." };
  }

  // Check for duplicate name if name is being changed
  if (data.name && data.name !== existing.name) {
    const duplicate = await db.room.findUnique({
      where: {
        schoolId_name: {
          schoolId: ctx.schoolId,
          name: data.name,
        },
      },
    });
    if (duplicate) {
      return { error: `A room named "${data.name}" already exists.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.room.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      building: data.building !== undefined ? data.building : existing.building,
      capacity: data.capacity !== undefined ? data.capacity : existing.capacity,
      type: data.type ?? existing.type,
      isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "Room",
    entityId: id,
    module: "timetable",
    description: `Updated room "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteRoomAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const existing = await db.room.findUnique({
    where: { id },
    include: {
      _count: { select: { timetableSlots: true, examSchedules: true } },
    },
  });

  if (!existing) {
    return { error: "Room not found." };
  }

  if (existing._count.timetableSlots > 0) {
    return { error: "Cannot delete room that is assigned to timetable slots. Remove all slot assignments first." };
  }

  if (existing._count.examSchedules > 0) {
    return { error: "Cannot delete room that is assigned to exam schedules. Remove all exam assignments first." };
  }

  await db.room.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "Room",
    entityId: id,
    module: "timetable",
    description: `Deleted room "${existing.name}"`,
    previousData: existing,
  });

  return { success: true };
}

// ─── Periods ────────────────────────────────────────────────────────

export async function createPeriodAction(data: {
  name: string;
  startTime: string;
  endTime: string;
  order: number;
  type: "LESSON" | "BREAK" | "ASSEMBLY" | "FREE";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  // Check for duplicate order
  const existing = await db.period.findUnique({
    where: {
      schoolId_order: {
        schoolId: ctx.schoolId,
        order: data.order,
      },
    },
  });

  if (existing) {
    return { error: `A period with order ${data.order} already exists.` };
  }

  const period = await db.period.create({
    data: {
      schoolId: ctx.schoolId,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      order: data.order,
      type: data.type,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Period",
    entityId: period.id,
    module: "timetable",
    description: `Created period "${period.name}" (${period.startTime}-${period.endTime})`,
    newData: period,
  });

  return { data: period };
}

export async function getPeriodsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const periods = await db.period.findMany({
    where: { schoolId: ctx.schoolId },
    orderBy: { order: "asc" },
  });

  return { data: periods };
}

export async function updatePeriodAction(
  id: string,
  data: {
    name?: string;
    startTime?: string;
    endTime?: string;
    order?: number;
    type?: "LESSON" | "BREAK" | "ASSEMBLY" | "FREE";
    isActive?: boolean;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const existing = await db.period.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Period not found." };
  }

  // Check for duplicate order if order is being changed
  if (data.order !== undefined && data.order !== existing.order) {
    const duplicate = await db.period.findUnique({
      where: {
        schoolId_order: {
          schoolId: ctx.schoolId,
          order: data.order,
        },
      },
    });
    if (duplicate) {
      return { error: `A period with order ${data.order} already exists.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.period.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      startTime: data.startTime ?? existing.startTime,
      endTime: data.endTime ?? existing.endTime,
      order: data.order !== undefined ? data.order : existing.order,
      type: data.type ?? existing.type,
      isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "Period",
    entityId: id,
    module: "timetable",
    description: `Updated period "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deletePeriodAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const existing = await db.period.findUnique({
    where: { id },
    include: {
      _count: { select: { timetableSlots: true } },
    },
  });

  if (!existing) {
    return { error: "Period not found." };
  }

  if (existing._count.timetableSlots > 0) {
    return { error: "Cannot delete period that has timetable slots assigned. Remove all slot assignments first." };
  }

  await db.period.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "Period",
    entityId: id,
    module: "timetable",
    description: `Deleted period "${existing.name}"`,
    previousData: existing,
  });

  return { success: true };
}

// ─── Timetable Slots ────────────────────────────────────────────────

export async function createTimetableSlotAction(data: {
  academicYearId: string;
  termId: string;
  classArmId: string;
  subjectId: string;
  teacherId: string;
  periodId: string;
  roomId?: string;
  dayOfWeek: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TIMETABLE_CREATE);
  if (denied) return denied;

  // ── Conflict Detection ──────────────────────────────────────────

  // 1. Check class arm conflict: no class arm double-booked at same period+day+term
  const classArmConflict = await db.timetableSlot.findUnique({
    where: {
      classArmId_periodId_dayOfWeek_termId: {
        classArmId: data.classArmId,
        periodId: data.periodId,
        dayOfWeek: data.dayOfWeek,
        termId: data.termId,
      },
    },
    include: {
      subject: { select: { name: true } },
    },
  });

  if (classArmConflict) {
    return {
      error: `Class arm conflict: This class arm already has "${classArmConflict.subject.name}" scheduled at this period on this day.`,
    };
  }

  // 2. Check teacher conflict: no teacher double-booked at same period+day+term
  const teacherConflict = await db.timetableSlot.findFirst({
    where: {
      teacherId: data.teacherId,
      periodId: data.periodId,
      dayOfWeek: data.dayOfWeek,
      termId: data.termId,
    },
    include: {
      classArm: {
        select: { name: true, class: { select: { name: true } } },
      },
      subject: { select: { name: true } },
    },
  });

  if (teacherConflict) {
    return {
      error: `Teacher conflict: This teacher is already assigned to teach "${teacherConflict.subject.name}" for ${teacherConflict.classArm.class.name} ${teacherConflict.classArm.name} at this period on this day.`,
    };
  }

  // 3. Check room conflict: no room double-booked at same period+day+term
  if (data.roomId) {
    const roomConflict = await db.timetableSlot.findFirst({
      where: {
        roomId: data.roomId,
        periodId: data.periodId,
        dayOfWeek: data.dayOfWeek,
        termId: data.termId,
      },
      include: {
        classArm: {
          select: { name: true, class: { select: { name: true } } },
        },
        subject: { select: { name: true } },
      },
    });

    if (roomConflict) {
      return {
        error: `Room conflict: This room is already booked for "${roomConflict.subject.name}" (${roomConflict.classArm.class.name} ${roomConflict.classArm.name}) at this period on this day.`,
      };
    }
  }

  // ── Create the slot ─────────────────────────────────────────────

  const slot = await db.timetableSlot.create({
    data: {
      schoolId: ctx.schoolId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      classArmId: data.classArmId,
      subjectId: data.subjectId,
      teacherId: data.teacherId,
      periodId: data.periodId,
      roomId: data.roomId || null,
      dayOfWeek: data.dayOfWeek,
    },
    include: {
      subject: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
      period: { select: { name: true } },
      room: { select: { name: true } },
      classArm: {
        select: { name: true, class: { select: { name: true } } },
      },
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "TimetableSlot",
    entityId: slot.id,
    module: "timetable",
    description: `Created timetable slot: ${slot.subject.name} for ${slot.classArm.class.name} ${slot.classArm.name} on day ${slot.dayOfWeek} at ${slot.period.name}`,
    newData: slot,
  });

  return { data: slot };
}

export async function getTimetableAction(filters: {
  classArmId?: string;
  teacherId?: string;
  roomId?: string;
  termId?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TIMETABLE_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };

  if (filters.classArmId) {
    where.classArmId = filters.classArmId;
  }
  if (filters.teacherId) {
    where.teacherId = filters.teacherId;
  }
  if (filters.roomId) {
    where.roomId = filters.roomId;
  }
  if (filters.termId) {
    where.termId = filters.termId;
  }

  const slots = await db.timetableSlot.findMany({
    where,
    include: {
      subject: { select: { id: true, name: true, code: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      period: {
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
          order: true,
          type: true,
        },
      },
      room: { select: { id: true, name: true, building: true } },
      classArm: {
        select: {
          id: true,
          name: true,
          class: { select: { id: true, name: true } },
        },
      },
      term: { select: { id: true, name: true } },
      academicYear: { select: { id: true, name: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { period: { order: "asc" } }],
  });

  const data = slots.map((slot) => ({
    id: slot.id,
    dayOfWeek: slot.dayOfWeek,
    subject: slot.subject,
    teacher: {
      id: slot.teacher.id,
      name: `${slot.teacher.firstName} ${slot.teacher.lastName}`,
    },
    period: slot.period,
    room: slot.room,
    classArm: {
      id: slot.classArm.id,
      name: slot.classArm.name,
      className: slot.classArm.class.name,
      classId: slot.classArm.class.id,
    },
    term: slot.term,
    academicYear: slot.academicYear,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  }));

  return { data };
}

export async function updateTimetableSlotAction(
  id: string,
  data: {
    subjectId?: string;
    teacherId?: string;
    periodId?: string;
    roomId?: string | null;
    dayOfWeek?: number;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TIMETABLE_UPDATE);
  if (denied) return denied;

  const existing = await db.timetableSlot.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Timetable slot not found." };
  }

  // Determine the effective values after update
  const effectiveTeacherId = data.teacherId ?? existing.teacherId;
  const effectivePeriodId = data.periodId ?? existing.periodId;
  const effectiveDayOfWeek = data.dayOfWeek ?? existing.dayOfWeek;
  const effectiveClassArmId = existing.classArmId;
  const effectiveTermId = existing.termId;
  const effectiveRoomId = data.roomId !== undefined ? data.roomId : existing.roomId;

  // ── Conflict Detection ──────────────────────────────────────────

  // 1. Check class arm conflict (only if period or day changed)
  if (data.periodId || data.dayOfWeek) {
    const classArmConflict = await db.timetableSlot.findFirst({
      where: {
        classArmId: effectiveClassArmId,
        periodId: effectivePeriodId,
        dayOfWeek: effectiveDayOfWeek,
        termId: effectiveTermId,
        NOT: { id },
      },
      include: {
        subject: { select: { name: true } },
      },
    });

    if (classArmConflict) {
      return {
        error: `Class arm conflict: This class arm already has "${classArmConflict.subject.name}" scheduled at this period on this day.`,
      };
    }
  }

  // 2. Check teacher conflict
  if (data.teacherId || data.periodId || data.dayOfWeek) {
    const teacherConflict = await db.timetableSlot.findFirst({
      where: {
        teacherId: effectiveTeacherId,
        periodId: effectivePeriodId,
        dayOfWeek: effectiveDayOfWeek,
        termId: effectiveTermId,
        NOT: { id },
      },
      include: {
        classArm: {
          select: { name: true, class: { select: { name: true } } },
        },
        subject: { select: { name: true } },
      },
    });

    if (teacherConflict) {
      return {
        error: `Teacher conflict: This teacher is already assigned to teach "${teacherConflict.subject.name}" for ${teacherConflict.classArm.class.name} ${teacherConflict.classArm.name} at this period on this day.`,
      };
    }
  }

  // 3. Check room conflict
  if (effectiveRoomId && (data.roomId || data.periodId || data.dayOfWeek)) {
    const roomConflict = await db.timetableSlot.findFirst({
      where: {
        roomId: effectiveRoomId,
        periodId: effectivePeriodId,
        dayOfWeek: effectiveDayOfWeek,
        termId: effectiveTermId,
        NOT: { id },
      },
      include: {
        classArm: {
          select: { name: true, class: { select: { name: true } } },
        },
        subject: { select: { name: true } },
      },
    });

    if (roomConflict) {
      return {
        error: `Room conflict: This room is already booked for "${roomConflict.subject.name}" (${roomConflict.classArm.class.name} ${roomConflict.classArm.name}) at this period on this day.`,
      };
    }
  }

  // ── Update the slot ─────────────────────────────────────────────

  const previousData = { ...existing };

  const updated = await db.timetableSlot.update({
    where: { id },
    data: {
      subjectId: data.subjectId ?? existing.subjectId,
      teacherId: data.teacherId ?? existing.teacherId,
      periodId: data.periodId ?? existing.periodId,
      roomId: data.roomId !== undefined ? data.roomId : existing.roomId,
      dayOfWeek: data.dayOfWeek ?? existing.dayOfWeek,
    },
    include: {
      subject: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
      period: { select: { name: true } },
      classArm: {
        select: { name: true, class: { select: { name: true } } },
      },
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "TimetableSlot",
    entityId: id,
    module: "timetable",
    description: `Updated timetable slot: ${updated.subject.name} for ${updated.classArm.class.name} ${updated.classArm.name}`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteTimetableSlotAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TIMETABLE_DELETE);
  if (denied) return denied;

  const existing = await db.timetableSlot.findUnique({
    where: { id },
    include: {
      subject: { select: { name: true } },
      classArm: {
        select: { name: true, class: { select: { name: true } } },
      },
      period: { select: { name: true } },
    },
  });

  if (!existing) {
    return { error: "Timetable slot not found." };
  }

  await db.timetableSlot.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "TimetableSlot",
    entityId: id,
    module: "timetable",
    description: `Deleted timetable slot: ${existing.subject.name} for ${existing.classArm.class.name} ${existing.classArm.name} at ${existing.period.name}`,
    previousData: existing,
  });

  return { success: true };
}
