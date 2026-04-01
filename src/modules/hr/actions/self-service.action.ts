"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { decryptOptional } from "@/lib/crypto/field-encrypt";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { getBusinessDays, toDateKey } from "@/modules/hr/utils/business-days";
import { z } from "zod";

// ─── Helpers ────────────────────────────────────────────────

async function getMyStaffRecord(userId: string) {
  const staff = await db.staff.findFirst({
    where: { userId, deletedAt: null },
    include: {
      employments: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { startDate: "desc" },
      },
    },
  });
  return staff;
}

// ─── My Profile ─────────────────────────────────────────────

export async function getMyStaffProfileAction() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const staff = await db.staff.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    include: {
      employments: { orderBy: { startDate: "desc" } },
    },
  });

  if (!staff) return { error: "No staff profile linked to your account." };

  // Get department names
  const deptIds = staff.employments.map((e) => e.departmentId).filter(Boolean) as string[];
  const departments = deptIds.length > 0
    ? await db.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })
    : [];
  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  // Get leave balances
  const leaveBalances = await db.leaveBalance.findMany({
    where: { staffId: staff.id },
    include: { leaveType: { select: { name: true } } },
    orderBy: { leaveType: { name: "asc" } },
  });

  return {
    data: {
      id: staff.id,
      staffId: staff.staffId,
      firstName: staff.firstName,
      lastName: staff.lastName,
      otherNames: staff.otherNames,
      dateOfBirth: staff.dateOfBirth,
      gender: staff.gender,
      phone: staff.phone,
      email: staff.email,
      address: staff.address,
      region: staff.region,
      ghanaCardNumber: decryptOptional(staff.ghanaCardNumber),
      ssnitNumber: decryptOptional(staff.ssnitNumber),
      tinNumber: decryptOptional(staff.tinNumber),
      staffType: staff.staffType,
      specialization: staff.specialization,
      photoUrl: staff.photoUrl,
      status: staff.status,
      employments: staff.employments.map((e) => ({
        id: e.id,
        position: e.position,
        rank: e.rank,
        departmentName: e.departmentId ? deptMap.get(e.departmentId) ?? null : null,
        startDate: e.startDate,
        endDate: e.endDate,
        appointmentType: e.appointmentType,
        salaryGrade: e.salaryGrade,
        status: e.status,
      })),
      leaveBalances: leaveBalances.map((lb) => ({
        id: lb.id,
        leaveTypeName: lb.leaveType.name,
        totalDays: lb.totalDays,
        usedDays: lb.usedDays,
        remainingDays: lb.remainingDays,
      })),
    },
  };
}

// ─── Update My Profile (restricted fields) ──────────────────

const updateMyProfileSchema = z.object({
  phone: z.string().min(1).optional(),
  address: z.string().optional(),
  region: z.string().optional(),
});

export async function updateMyProfileAction(data: z.infer<typeof updateMyProfileSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const parsed = updateMyProfileSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input" };

  const staff = await getMyStaffRecord(session.user.id);
  if (!staff) return { error: "No staff profile linked to your account." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};
  if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
  if (parsed.data.address !== undefined) updateData.address = parsed.data.address || null;
  if (parsed.data.region !== undefined) updateData.region = parsed.data.region || null;

  const updated = await db.staff.update({
    where: { id: staff.id },
    data: updateData,
  });

  await audit({
    userId: session.user.id,
    action: "UPDATE",
    entity: "Staff",
    entityId: staff.id,
    module: "hr",
    description: `Staff self-service profile update by "${staff.firstName} ${staff.lastName}"`,
    newData: updateData,
  });

  return { success: true };
}

// ─── Request My Leave ───────────────────────────────────────

const requestMyLeaveSchema = z.object({
  leaveTypeId: z.string().min(1, "Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().optional(),
});

export async function requestMyLeaveAction(data: z.infer<typeof requestMyLeaveSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const parsed = requestMyLeaveSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const staff = await getMyStaffRecord(session.user.id);
  if (!staff) return { error: "No staff profile linked to your account." };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const leaveType = await db.leaveType.findUnique({ where: { id: parsed.data.leaveTypeId } });
  if (!leaveType) return { error: "Leave type not found." };

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (endDate < startDate) return { error: "End date must be after start date." };

  // Fetch holidays for accurate business day calculation
  const holidays = await db.publicHoliday.findMany({
    where: { schoolId: school.id, date: { gte: startDate, lte: endDate } },
    select: { date: true },
  });
  const holidaySet = new Set<string>(holidays.map((h: { date: Date }) => toDateKey(h.date)));
  const daysRequested = getBusinessDays(startDate, endDate, holidaySet);

  if (daysRequested <= 0) return { error: "The selected dates contain no business days." };

  // Check balance
  const balance = await db.leaveBalance.findFirst({
    where: { staffId: staff.id, leaveTypeId: parsed.data.leaveTypeId },
    orderBy: { academicYearId: "desc" },
  });
  if (balance && balance.remainingDays < daysRequested) {
    return { error: `Insufficient balance. Available: ${balance.remainingDays} days, Requested: ${daysRequested} days.` };
  }

  const request = await db.leaveRequest.create({
    data: {
      staffId: staff.id,
      leaveTypeId: parsed.data.leaveTypeId,
      startDate,
      endDate,
      daysRequested,
      reason: parsed.data.reason || null,
    },
  });

  await audit({
    userId: session.user.id,
    action: "CREATE",
    entity: "LeaveRequest",
    entityId: request.id,
    module: "hr",
    description: `Self-service leave request by "${staff.firstName} ${staff.lastName}" for ${daysRequested} days (${leaveType.name})`,
    newData: request,
  });

  // Notify HR admins
  dispatch({
    event: NOTIFICATION_EVENTS.LEAVE_REQUESTED,
    title: "New Leave Request",
    message: `${staff.firstName} ${staff.lastName} has requested ${daysRequested} days of ${leaveType.name} leave.`,
    recipients: [],
    schoolId: school.id,
  }).catch(() => {});

  return { data: request };
}

// ─── My Payslips ────────────────────────────────────────────

export async function getMyPayslipsAction(filters?: { year?: number }) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const staff = await getMyStaffRecord(session.user.id);
  if (!staff) return { error: "No staff profile linked to your account." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { staffId: staff.id };
  if (filters?.year) {
    where.payrollPeriod = { year: filters.year };
  }

  const entries = await db.payrollEntry.findMany({
    where,
    include: {
      payrollPeriod: {
        select: { month: true, year: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Only show approved/paid payroll entries
  const data = entries
    .filter((e) => e.payrollPeriod.status !== "DRAFT")
    .map((e) => ({
      id: e.id,
      month: e.payrollPeriod.month,
      year: e.payrollPeriod.year,
      basicSalary: e.basicSalary,
      totalAllowances: e.totalAllowances,
      totalDeductions: e.totalDeductions,
      netPay: e.netPay,
      details: e.details as {
        allowances: { name: string; amount: number }[];
        deductions: { name: string; amount: number }[];
      } | null,
      status: e.payrollPeriod.status,
    }));

  return { data };
}

// ─── My Attendance ──────────────────────────────────────────

export async function getMyAttendanceAction(month: number, year: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const staff = await getMyStaffRecord(session.user.id);
  if (!staff) return { error: "No staff profile linked to your account." };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const records = await db.staffAttendance.findMany({
    where: {
      schoolId: school.id,
      staffId: staff.id,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: "asc" },
  });

  const summary: Record<string, number> = {
    PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, HALF_DAY: 0, ON_LEAVE: 0, HOLIDAY: 0,
  };
  for (const r of records) {
    summary[r.status] = (summary[r.status] || 0) + 1;
  }

  return {
    data: {
      records: records.map((r) => ({
        date: r.date,
        status: r.status,
        clockIn: r.clockIn,
        clockOut: r.clockOut,
        remarks: r.remarks,
      })),
      summary,
      totalRecords: records.length,
    },
  };
}

// ─── My Leave Requests ──────────────────────────────────────

export async function getMyLeaveRequestsAction(filters?: { status?: string; page?: number }) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const staff = await getMyStaffRecord(session.user.id);
  if (!staff) return { error: "No staff profile linked to your account." };

  const page = filters?.page ?? 1;
  const pageSize = 25;
  const skip = (page - 1) * pageSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { staffId: staff.id };
  if (filters?.status) where.status = filters.status;

  const [requests, total] = await Promise.all([
    db.leaveRequest.findMany({
      where,
      include: { leaveType: { select: { name: true } } },
      orderBy: { appliedAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.leaveRequest.count({ where }),
  ]);

  return {
    data: requests.map((r) => ({
      id: r.id,
      leaveTypeName: r.leaveType.name,
      startDate: r.startDate,
      endDate: r.endDate,
      daysRequested: r.daysRequested,
      reason: r.reason,
      status: r.status,
      appliedAt: r.appliedAt,
      reviewNotes: r.reviewNotes,
    })),
    total,
    page,
    pageSize,
  };
}

// ─── My Timetable (Teacher Portal) ─────────────────────────

export async function getMyTeacherTimetableAction() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const currentTerm = await db.term.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });

  if (!currentTerm) {
    return { data: { timetable: [], periods: [] } };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { data: { timetable: [], periods: [] } };
  }

  const [slots, periods] = await Promise.all([
    db.timetableSlot.findMany({
      where: {
        teacherId: session.user.id,
        termId: currentTerm.id,
      },
      include: {
        subject: { select: { name: true, code: true } },
        classArm: {
          select: {
            name: true,
            class: { select: { name: true } },
          },
        },
        period: { select: { name: true, startTime: true, endTime: true, order: true, type: true } },
        room: { select: { name: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { period: { order: "asc" } }],
    }),
    db.period.findMany({
      where: { schoolId: school.id, isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true, startTime: true, endTime: true, order: true, type: true },
    }),
  ]);

  const timetable = slots.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    period: s.period,
    subject: s.subject,
    className: `${s.classArm.class.name} ${s.classArm.name}`,
    room: s.room?.name || null,
  }));

  return { data: { timetable, periods } };
}
