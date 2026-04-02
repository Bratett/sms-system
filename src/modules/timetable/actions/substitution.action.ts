"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";

// ─── Create Substitution ─────────────────────────────────────────────

export async function createSubstitutionAction(data: {
  timetableSlotId: string;
  substituteTeacherId: string;
  date: string;
  reason?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBSTITUTION_CREATE);
  if (denied) return denied;

  // Get the timetable slot
  const slot = await db.timetableSlot.findUnique({
    where: { id: data.timetableSlotId },
    include: {
      subject: { select: { name: true } },
      classArm: { select: { name: true, class: { select: { name: true } } } },
      period: { select: { name: true, startTime: true, endTime: true } },
    },
  });

  if (!slot) return { error: "Timetable slot not found." };

  const dateObj = new Date(data.date);
  dateObj.setHours(0, 0, 0, 0);

  // Check for existing substitution on same slot and date
  const existing = await db.timetableSubstitution.findUnique({
    where: {
      timetableSlotId_date: {
        timetableSlotId: data.timetableSlotId,
        date: dateObj,
      },
    },
  });

  if (existing) {
    return { error: "A substitution already exists for this slot on this date." };
  }

  // Check substitute teacher is not already scheduled
  const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay();
  const currentTerm = await db.term.findFirst({ where: { isCurrent: true } });

  if (currentTerm) {
    const conflict = await db.timetableSlot.findFirst({
      where: {
        teacherId: data.substituteTeacherId,
        periodId: slot.periodId,
        dayOfWeek,
        termId: currentTerm.id,
      },
    });

    if (conflict) {
      return { error: "Substitute teacher is already scheduled for this period on this day." };
    }
  }

  const substitution = await db.timetableSubstitution.create({
    data: {
      schoolId: ctx.schoolId,
      timetableSlotId: data.timetableSlotId,
      originalTeacherId: slot.teacherId,
      substituteTeacherId: data.substituteTeacherId,
      date: dateObj,
      reason: data.reason || null,
      createdBy: ctx.session.user.id,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "TimetableSubstitution",
    entityId: substitution.id,
    module: "timetable",
    description: `Created substitution for ${slot.subject.name} (${slot.classArm.class.name} ${slot.classArm.name})`,
  });

  // Notify substitute teacher
  const substituteUser = await db.user.findUnique({
    where: { id: data.substituteTeacherId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (substituteUser) {
    dispatch({
      event: NOTIFICATION_EVENTS.SUBSTITUTION_ASSIGNED,
      title: "Substitution Assigned",
      message: `You have been assigned to cover ${slot.subject.name} for ${slot.classArm.class.name} ${slot.classArm.name} on ${dateObj.toLocaleDateString()} at ${slot.period.startTime}-${slot.period.endTime}.`,
      recipients: [{ userId: substituteUser.id, email: substituteUser.email ?? undefined }],
      schoolId: ctx.schoolId,
    }).catch(() => {});
  }

  return { data: { id: substitution.id } };
}

// ─── Approve Substitution ────────────────────────────────────────────

export async function approveSubstitutionAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBSTITUTION_APPROVE);
  if (denied) return denied;

  const substitution = await db.timetableSubstitution.findUnique({
    where: { id },
  });

  if (!substitution) return { error: "Substitution not found." };
  if (substitution.status !== "PENDING") return { error: "Substitution is not pending." };

  await db.timetableSubstitution.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedBy: ctx.session.user.id,
      approvedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "APPROVE",
    entity: "TimetableSubstitution",
    entityId: id,
    module: "timetable",
    description: "Approved substitution",
  });

  return { success: true };
}

// ─── Reject Substitution ─────────────────────────────────────────────

export async function rejectSubstitutionAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBSTITUTION_APPROVE);
  if (denied) return denied;

  const substitution = await db.timetableSubstitution.findUnique({
    where: { id },
  });

  if (!substitution) return { error: "Substitution not found." };
  if (substitution.status !== "PENDING") return { error: "Substitution is not pending." };

  await db.timetableSubstitution.update({
    where: { id },
    data: { status: "REJECTED" },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "REJECT",
    entity: "TimetableSubstitution",
    entityId: id,
    module: "timetable",
    description: "Rejected substitution",
  });

  return { success: true };
}

// ─── Get Substitutions ───────────────────────────────────────────────

export async function getSubstitutionsAction(filters?: {
  date?: string;
  status?: string;
  teacherId?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUBSTITUTION_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.status) where.status = filters.status;
  if (filters?.teacherId) {
    where.OR = [
      { originalTeacherId: filters.teacherId },
      { substituteTeacherId: filters.teacherId },
    ];
  }
  if (filters?.date) {
    const dateObj = new Date(filters.date);
    dateObj.setHours(0, 0, 0, 0);
    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);
    where.date = { gte: dateObj, lt: nextDay };
  }

  const [substitutions, total] = await Promise.all([
    db.timetableSubstitution.findMany({
      where,
      include: {
        timetableSlot: {
          include: {
            subject: { select: { name: true } },
            classArm: { select: { name: true, class: { select: { name: true } } } },
            period: { select: { name: true, startTime: true, endTime: true } },
          },
        },
      },
      orderBy: { date: "desc" },
      take: pageSize,
      skip,
    }),
    db.timetableSubstitution.count({ where }),
  ]);

  // Get teacher names
  const teacherIds = [
    ...new Set(
      substitutions.flatMap((s) => [s.originalTeacherId, s.substituteTeacherId]),
    ),
  ];
  const teachers = await db.user.findMany({
    where: { id: { in: teacherIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const teacherMap = new Map(
    teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`]),
  );

  const data = substitutions.map((s) => ({
    id: s.id,
    date: s.date,
    status: s.status,
    reason: s.reason,
    originalTeacher: teacherMap.get(s.originalTeacherId) ?? "Unknown",
    substituteTeacher: teacherMap.get(s.substituteTeacherId) ?? "Unknown",
    subject: s.timetableSlot.subject.name,
    className: `${s.timetableSlot.classArm.class.name} ${s.timetableSlot.classArm.name}`,
    period: `${s.timetableSlot.period.name} (${s.timetableSlot.period.startTime}-${s.timetableSlot.period.endTime})`,
    createdAt: s.createdAt,
  }));

  return {
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// ─── Get Available Substitutes ───────────────────────────────────────

export async function getAvailableSubstitutesAction(data: {
  periodId: string;
  dayOfWeek: number;
  date: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const currentTerm = await db.term.findFirst({ where: { isCurrent: true } });
  if (!currentTerm) return { data: [] };

  // Get all teachers scheduled for this period on this day
  const scheduledSlots = await db.timetableSlot.findMany({
    where: {
      periodId: data.periodId,
      dayOfWeek: data.dayOfWeek,
      termId: currentTerm.id,
      schoolId: ctx.schoolId,
    },
    select: { teacherId: true },
  });
  const scheduledTeacherIds = new Set(scheduledSlots.map((s) => s.teacherId));

  // Get all active teaching staff
  const staff = await db.staff.findMany({
    where: {
      schoolId: ctx.schoolId,
      staffType: "TEACHING",
      status: "ACTIVE",
      deletedAt: null,
      userId: { not: null },
    },
    select: {
      userId: true,
      firstName: true,
      lastName: true,
    },
  });

  // Filter out scheduled teachers
  const available = staff
    .filter((s) => s.userId && !scheduledTeacherIds.has(s.userId))
    .map((s) => ({
      id: s.userId!,
      name: `${s.firstName} ${s.lastName}`,
    }));

  return { data: available };
}
