"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { PERMISSIONS, denyPermission } from "@/lib/permissions";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { getBusinessDays, toDateKey } from "@/modules/hr/utils/business-days";
import {
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  requestLeaveSchema,
  type CreateLeaveTypeInput,
  type UpdateLeaveTypeInput,
  type RequestLeaveInput,
} from "@/modules/hr/schemas/leave.schema";

// ─── Leave Types ─────────────────────────────────────────────

export async function getLeaveTypesAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.LEAVE_READ)) return { error: "Insufficient permissions" };

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const leaveTypes = await db.leaveType.findMany({
    where: { schoolId: school.id },
    orderBy: { name: "asc" },
  });

  const data = leaveTypes.map((lt) => ({
    id: lt.id,
    name: lt.name,
    defaultDays: lt.defaultDays,
    requiresApproval: lt.requiresApproval,
    applicableGender: lt.applicableGender,
    status: lt.status,
  }));

  return { data };
}

export async function createLeaveTypeAction(data: CreateLeaveTypeInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.LEAVE_CREATE)) return { error: "Insufficient permissions" };

  const parsed = createLeaveTypeSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Check for duplicate name
  const existing = await db.leaveType.findUnique({
    where: {
      schoolId_name: {
        schoolId: school.id,
        name: parsed.data.name,
      },
    },
  });

  if (existing) {
    return { error: `A leave type named "${parsed.data.name}" already exists.` };
  }

  const leaveType = await db.leaveType.create({
    data: {
      schoolId: school.id,
      name: parsed.data.name,
      defaultDays: parsed.data.defaultDays,
      requiresApproval: parsed.data.requiresApproval ?? true,
      applicableGender: parsed.data.applicableGender || null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "LeaveType",
    entityId: leaveType.id,
    module: "hr",
    description: `Created leave type "${leaveType.name}"`,
    newData: leaveType,
  });

  return { data: leaveType };
}

export async function updateLeaveTypeAction(id: string, data: UpdateLeaveTypeInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.LEAVE_CREATE)) return { error: "Insufficient permissions" };

  const parsed = updateLeaveTypeSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.leaveType.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Leave type not found." };
  }

  const previousData = { ...existing };

  const updated = await db.leaveType.update({
    where: { id },
    data: {
      name: parsed.data.name ?? existing.name,
      defaultDays: parsed.data.defaultDays ?? existing.defaultDays,
      requiresApproval: parsed.data.requiresApproval ?? existing.requiresApproval,
      applicableGender:
        parsed.data.applicableGender !== undefined
          ? parsed.data.applicableGender || null
          : existing.applicableGender,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "LeaveType",
    entityId: id,
    module: "hr",
    description: `Updated leave type "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteLeaveTypeAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.LEAVE_CREATE)) return { error: "Insufficient permissions" };

  const existing = await db.leaveType.findUnique({
    where: { id },
    include: { _count: { select: { leaveRequests: true } } },
  });

  if (!existing) {
    return { error: "Leave type not found." };
  }

  if (existing._count.leaveRequests > 0) {
    return {
      error: `Cannot delete "${existing.name}" because it has ${existing._count.leaveRequests} leave request(s) linked to it.`,
    };
  }

  await db.leaveType.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "LeaveType",
    entityId: id,
    module: "hr",
    description: `Deleted leave type "${existing.name}"`,
    previousData: existing,
  });

  return { success: true };
}

// ─── Leave Balances ──────────────────────────────────────────

export async function initializeLeaveBalancesAction(staffId: string, academicYearId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.LEAVE_CREATE)) return { error: "Insufficient permissions" };

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff) {
    return { error: "Staff member not found." };
  }

  const leaveTypes = await db.leaveType.findMany({
    where: {
      schoolId: school.id,
      status: "ACTIVE",
      OR: [
        { applicableGender: null },
        { applicableGender: staff.gender },
      ],
    },
  });

  let created = 0;
  for (const lt of leaveTypes) {
    const existing = await db.leaveBalance.findUnique({
      where: {
        staffId_leaveTypeId_academicYearId: {
          staffId,
          leaveTypeId: lt.id,
          academicYearId,
        },
      },
    });

    if (!existing) {
      await db.leaveBalance.create({
        data: {
          staffId,
          leaveTypeId: lt.id,
          academicYearId,
          totalDays: lt.defaultDays,
          remainingDays: lt.defaultDays,
        },
      });
      created++;
    }
  }

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "LeaveBalance",
    module: "hr",
    description: `Initialized ${created} leave balances for staff "${staff.firstName} ${staff.lastName}"`,
    metadata: { staffId, academicYearId, created },
  });

  return { data: { created } };
}

// ─── Bulk Initialize Leave Balances ──────────────────────────

export async function bulkInitializeLeaveBalancesAction(academicYearId: string, staffIds?: string[]) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.LEAVE_CREATE)) return { error: "Insufficient permissions" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  // Get target staff — either specified IDs or all active staff
  const staffWhere = staffIds && staffIds.length > 0
    ? { id: { in: staffIds }, schoolId: school.id, deletedAt: null }
    : { schoolId: school.id, status: "ACTIVE" as const, deletedAt: null };
  const staffMembers = await db.staff.findMany({
    where: staffWhere,
    select: { id: true, firstName: true, lastName: true, gender: true },
  });

  if (staffMembers.length === 0) return { error: "No staff members found." };

  const leaveTypes = await db.leaveType.findMany({
    where: { schoolId: school.id, status: "ACTIVE" },
  });

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const staff of staffMembers) {
    const applicableTypes = leaveTypes.filter(
      (lt) => !lt.applicableGender || lt.applicableGender === staff.gender,
    );

    for (const lt of applicableTypes) {
      const existing = await db.leaveBalance.findUnique({
        where: {
          staffId_leaveTypeId_academicYearId: {
            staffId: staff.id,
            leaveTypeId: lt.id,
            academicYearId,
          },
        },
      });

      if (!existing) {
        await db.leaveBalance.create({
          data: {
            staffId: staff.id,
            leaveTypeId: lt.id,
            academicYearId,
            totalDays: lt.defaultDays,
            remainingDays: lt.defaultDays,
          },
        });
        totalCreated++;
      } else {
        totalSkipped++;
      }
    }
  }

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "LeaveBalance",
    module: "hr",
    description: `Bulk initialized leave balances for ${staffMembers.length} staff members (${totalCreated} created, ${totalSkipped} skipped)`,
    metadata: { academicYearId, staffCount: staffMembers.length, created: totalCreated, skipped: totalSkipped },
  });

  return { data: { staffCount: staffMembers.length, created: totalCreated, skipped: totalSkipped } };
}

// ─── Leave Requests ──────────────────────────────────────────

export async function getLeaveRequestsAction(filters?: {
  staffId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.LEAVE_READ)) return { error: "Insufficient permissions" };

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    staff: { schoolId: school.id },
  };

  if (filters?.staffId) {
    where.staffId = filters.staffId;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  const [requests, total] = await Promise.all([
    db.leaveRequest.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { appliedAt: "desc" },
      include: {
        staff: { select: { firstName: true, lastName: true } },
        leaveType: { select: { name: true } },
      },
    }),
    db.leaveRequest.count({ where }),
  ]);

  const data = requests.map((r) => ({
    id: r.id,
    staffId: r.staffId,
    staffName: `${r.staff.firstName} ${r.staff.lastName}`,
    leaveTypeName: r.leaveType.name,
    startDate: r.startDate,
    endDate: r.endDate,
    daysRequested: r.daysRequested,
    reason: r.reason,
    status: r.status,
    appliedAt: r.appliedAt,
    reviewedBy: r.reviewedBy,
    reviewNotes: r.reviewNotes,
  }));

  return { data, total, page, pageSize };
}

export async function requestLeaveAction(data: RequestLeaveInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.LEAVE_CREATE)) return { error: "Insufficient permissions" };

  const parsed = requestLeaveSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const staff = await db.staff.findUnique({ where: { id: parsed.data.staffId } });
  if (!staff) {
    return { error: "Staff member not found." };
  }

  const leaveType = await db.leaveType.findUnique({ where: { id: parsed.data.leaveTypeId } });
  if (!leaveType) {
    return { error: "Leave type not found." };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);

  if (endDate < startDate) {
    return { error: "End date must be after start date." };
  }

  // Fetch public holidays in the date range for accurate business day calculation
  const holidays = await db.publicHoliday.findMany({
    where: {
      schoolId: school.id,
      date: { gte: startDate, lte: endDate },
    },
    select: { date: true },
  });
  const holidaySet = new Set<string>(holidays.map((h: { date: Date }) => toDateKey(h.date)));

  const daysRequested = getBusinessDays(startDate, endDate, holidaySet);

  if (daysRequested <= 0) {
    return { error: "The selected dates contain no business days." };
  }

  // Check leave balance (find the latest academic year balance)
  const balance = await db.leaveBalance.findFirst({
    where: {
      staffId: parsed.data.staffId,
      leaveTypeId: parsed.data.leaveTypeId,
    },
    orderBy: { academicYearId: "desc" },
  });

  if (balance && balance.remainingDays < daysRequested) {
    return {
      error: `Insufficient leave balance. Available: ${balance.remainingDays} days, Requested: ${daysRequested} days.`,
    };
  }

  const request = await db.leaveRequest.create({
    data: {
      staffId: parsed.data.staffId,
      leaveTypeId: parsed.data.leaveTypeId,
      startDate,
      endDate,
      daysRequested,
      reason: parsed.data.reason || null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "LeaveRequest",
    entityId: request.id,
    module: "hr",
    description: `Leave request by "${staff.firstName} ${staff.lastName}" for ${daysRequested} days (${leaveType.name})`,
    newData: request,
  });

  // Notify HR admins about new leave request
  dispatch({
    event: NOTIFICATION_EVENTS.LEAVE_REQUESTED,
    title: "New Leave Request",
    message: `${staff.firstName} ${staff.lastName} has requested ${daysRequested} days of ${leaveType.name} leave.`,
    recipients: [], // In-app notification created for admins with LEAVE_APPROVE permission
    schoolId: school.id,
  }).catch(() => {}); // Fire-and-forget

  return { data: request };
}

export async function approveLeaveAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.LEAVE_APPROVE)) return { error: "Insufficient permissions" };

  const request = await db.leaveRequest.findUnique({
    where: { id },
    include: { staff: true, leaveType: true },
  });

  if (!request) {
    return { error: "Leave request not found." };
  }

  if (request.status !== "PENDING") {
    return { error: "Only pending requests can be approved." };
  }

  // Update request status
  const updated = await db.leaveRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
    },
  });

  // Deduct from balance
  const balance = await db.leaveBalance.findFirst({
    where: {
      staffId: request.staffId,
      leaveTypeId: request.leaveTypeId,
    },
    orderBy: { academicYearId: "desc" },
  });

  if (balance) {
    await db.leaveBalance.update({
      where: { id: balance.id },
      data: {
        usedDays: balance.usedDays + request.daysRequested,
        remainingDays: balance.remainingDays - request.daysRequested,
      },
    });
  }

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "LeaveRequest",
    entityId: id,
    module: "hr",
    description: `Approved leave request for "${request.staff.firstName} ${request.staff.lastName}" (${request.daysRequested} days ${request.leaveType.name})`,
    previousData: request,
    newData: updated,
  });

  // Notify the staff member
  if (request.staff.userId) {
    const user = await db.user.findUnique({
      where: { id: request.staff.userId },
      select: { id: true, email: true },
    });
    const school = await db.school.findFirst();
    if (user && school) {
      dispatch({
        event: NOTIFICATION_EVENTS.LEAVE_APPROVED,
        title: "Leave Request Approved",
        message: `Your ${request.leaveType.name} leave request for ${request.daysRequested} day(s) has been approved.`,
        recipients: [{ userId: user.id, email: user.email ?? undefined, name: `${request.staff.firstName} ${request.staff.lastName}` }],
        schoolId: school.id,
      }).catch(() => {});
    }
  }

  return { data: updated };
}

export async function rejectLeaveAction(id: string, notes: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.LEAVE_APPROVE)) return { error: "Insufficient permissions" };

  const request = await db.leaveRequest.findUnique({
    where: { id },
    include: { staff: true, leaveType: true },
  });

  if (!request) {
    return { error: "Leave request not found." };
  }

  if (request.status !== "PENDING") {
    return { error: "Only pending requests can be rejected." };
  }

  const updated = await db.leaveRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      reviewNotes: notes || null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "LeaveRequest",
    entityId: id,
    module: "hr",
    description: `Rejected leave request for "${request.staff.firstName} ${request.staff.lastName}" (${request.leaveType.name})`,
    previousData: request,
    newData: updated,
  });

  // Notify the staff member
  if (request.staff.userId) {
    const user = await db.user.findUnique({
      where: { id: request.staff.userId },
      select: { id: true, email: true },
    });
    const school = await db.school.findFirst();
    if (user && school) {
      dispatch({
        event: NOTIFICATION_EVENTS.LEAVE_REJECTED,
        title: "Leave Request Rejected",
        message: `Your ${request.leaveType.name} leave request has been rejected.${notes ? ` Reason: ${notes}` : ""}`,
        recipients: [{ userId: user.id, email: user.email ?? undefined, name: `${request.staff.firstName} ${request.staff.lastName}` }],
        schoolId: school.id,
      }).catch(() => {});
    }
  }

  return { data: updated };
}

export async function cancelLeaveAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.LEAVE_APPROVE)) return { error: "Insufficient permissions" };

  const request = await db.leaveRequest.findUnique({
    where: { id },
    include: { staff: true, leaveType: true },
  });

  if (!request) {
    return { error: "Leave request not found." };
  }

  if (request.status !== "PENDING" && request.status !== "APPROVED") {
    return { error: "Only pending or approved requests can be cancelled." };
  }

  const wasApproved = request.status === "APPROVED";

  const updated = await db.leaveRequest.update({
    where: { id },
    data: {
      status: "CANCELLED",
    },
  });

  // Restore balance if was approved
  if (wasApproved) {
    const balance = await db.leaveBalance.findFirst({
      where: {
        staffId: request.staffId,
        leaveTypeId: request.leaveTypeId,
      },
      orderBy: { academicYearId: "desc" },
    });

    if (balance) {
      await db.leaveBalance.update({
        where: { id: balance.id },
        data: {
          usedDays: Math.max(0, balance.usedDays - request.daysRequested),
          remainingDays: balance.remainingDays + request.daysRequested,
        },
      });
    }
  }

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "LeaveRequest",
    entityId: id,
    module: "hr",
    description: `Cancelled leave request for "${request.staff.firstName} ${request.staff.lastName}" (${request.leaveType.name})`,
    previousData: request,
    newData: updated,
  });

  return { data: updated };
}
