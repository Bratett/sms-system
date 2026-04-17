"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  startWorkflow,
  transitionWorkflowWithAutoStart,
  WorkflowTransitionError,
} from "@/lib/workflow/engine";
import {
  EXEAT_EVENTS,
  EXEAT_STATES,
  EXEAT_WORKFLOW_KEY,
} from "@/lib/workflow/definitions/exeat";

// ─── Exeats ─────────────────────────────────────────────────────────

export async function getExeatsAction(filters?: {
  status?: string;
  termId?: string;
  studentId?: string;
  type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXEAT_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.termId) where.termId = filters.termId;
  if (filters?.studentId) where.studentId = filters.studentId;
  if (filters?.type) where.type = filters.type;

  const [exeats, total] = await Promise.all([
    db.exeat.findMany({
      where,
      include: {
        approvals: {
          orderBy: { actionAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    }),
    db.exeat.count({ where }),
  ]);

  // Fetch student names
  const studentIds = [...new Set(exeats.map((e) => e.studentId))];
  let studentMap = new Map<string, { name: string; studentNumber: string }>();
  if (studentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, studentId: true },
    });
    studentMap = new Map(
      students.map((s) => [
        s.id,
        { name: `${s.firstName} ${s.lastName}`, studentNumber: s.studentId },
      ]),
    );
  }

  // Filter by search if provided
  let data = exeats.map((e) => ({
    id: e.id,
    exeatNumber: e.exeatNumber,
    studentId: e.studentId,
    studentName: studentMap.get(e.studentId)?.name ?? "Unknown",
    studentNumber: studentMap.get(e.studentId)?.studentNumber ?? "",
    type: e.type,
    reason: e.reason,
    departureDate: e.departureDate,
    departureTime: e.departureTime,
    expectedReturnDate: e.expectedReturnDate,
    actualReturnDate: e.actualReturnDate,
    actualReturnTime: e.actualReturnTime,
    guardianName: e.guardianName,
    guardianPhone: e.guardianPhone,
    status: e.status,
    requestedAt: e.requestedAt,
    approvalCount: e.approvals.length,
  }));

  if (filters?.search) {
    const search = filters.search.toLowerCase();
    data = data.filter(
      (e) =>
        e.studentName.toLowerCase().includes(search) ||
        e.studentNumber.toLowerCase().includes(search) ||
        e.exeatNumber.toLowerCase().includes(search),
    );
  }

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

export async function getExeatAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXEAT_READ);
  if (denied) return denied;

  const exeat = await db.exeat.findUnique({
    where: { id },
    include: {
      approvals: {
        orderBy: { actionAt: "asc" },
      },
    },
  });

  if (!exeat) {
    return { error: "Exeat not found." };
  }

  // Fetch student info
  const student = await db.student.findUnique({
    where: { id: exeat.studentId },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      boardingStatus: true,
      photoUrl: true,
    },
  });

  // Fetch approver names
  const approverIds = exeat.approvals.map((a) => a.approverId);
  let approverMap = new Map<string, string>();
  if (approverIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: approverIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    approverMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  const data = {
    id: exeat.id,
    exeatNumber: exeat.exeatNumber,
    student: student
      ? {
          id: student.id,
          studentId: student.studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          boardingStatus: student.boardingStatus,
          photoUrl: student.photoUrl,
        }
      : null,
    type: exeat.type,
    reason: exeat.reason,
    departureDate: exeat.departureDate,
    departureTime: exeat.departureTime,
    expectedReturnDate: exeat.expectedReturnDate,
    actualReturnDate: exeat.actualReturnDate,
    actualReturnTime: exeat.actualReturnTime,
    guardianName: exeat.guardianName,
    guardianPhone: exeat.guardianPhone,
    status: exeat.status,
    requestedAt: exeat.requestedAt,
    approvals: exeat.approvals.map((a) => ({
      id: a.id,
      approverRole: a.approverRole,
      approverName: approverMap.get(a.approverId) ?? "Unknown",
      action: a.action,
      comments: a.comments,
      actionAt: a.actionAt,
    })),
  };

  return { data };
}

export async function requestExeatAction(data: {
  studentId: string;
  termId: string;
  reason: string;
  type: "NORMAL" | "EMERGENCY" | "MEDICAL" | "WEEKEND" | "VACATION";
  departureDate: string;
  departureTime?: string;
  expectedReturnDate: string;
  guardianName?: string;
  guardianPhone?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXEAT_CREATE);
  if (denied) return denied;

  // Generate exeat number
  const year = new Date().getFullYear();
  const count = await db.exeat.count({
    where: {
      exeatNumber: { startsWith: `EXT/${year}/` },
    },
  });
  const exeatNumber = `EXT/${year}/${String(count + 1).padStart(4, "0")}`;

  const exeat = await db.exeat.create({
    data: {
      schoolId: ctx.schoolId,
      exeatNumber,
      studentId: data.studentId,
      termId: data.termId,
      reason: data.reason,
      type: data.type,
      departureDate: new Date(data.departureDate),
      departureTime: data.departureTime || null,
      expectedReturnDate: new Date(data.expectedReturnDate),
      guardianName: data.guardianName || null,
      guardianPhone: data.guardianPhone || null,
      requestedBy: ctx.session.user.id,
    },
  });

  await startWorkflow({
    definitionKey: EXEAT_WORKFLOW_KEY,
    entityType: "Exeat",
    entityId: exeat.id,
    schoolId: ctx.schoolId,
    startedBy: ctx.session.user.id,
    metadata: { exeatNumber, type: exeat.type },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Exeat",
    entityId: exeat.id,
    module: "boarding",
    description: `Created exeat request ${exeatNumber}`,
    newData: exeat,
  });

  return { data: exeat };
}

export async function approveExeatAction(
  id: string,
  role: "housemaster" | "headmaster",
  comments?: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXEAT_APPROVE);
  if (denied) return denied;

  const exeat = await db.exeat.findUnique({ where: { id } });
  if (!exeat) return { error: "Exeat not found." };

  // Domain-level prechecks preserve user-facing messages. The workflow engine
  // also enforces these rules as the canonical state machine.
  let event: string;
  let newStatus: string;
  if (role === "housemaster") {
    if (exeat.status !== "REQUESTED") {
      return { error: "Exeat must be in REQUESTED status for housemaster approval." };
    }
    event = EXEAT_EVENTS.HOUSEMASTER_APPROVE;
    newStatus = EXEAT_STATES.HOUSEMASTER_APPROVED;
  } else {
    const emergencyLike = exeat.type === "EMERGENCY" || exeat.type === "MEDICAL";
    if (emergencyLike) {
      if (exeat.status !== "REQUESTED" && exeat.status !== "HOUSEMASTER_APPROVED") {
        return { error: "Invalid exeat status for headmaster approval." };
      }
    } else if (exeat.status !== "HOUSEMASTER_APPROVED") {
      return { error: "Exeat must be approved by housemaster first." };
    }
    event = EXEAT_EVENTS.HEADMASTER_APPROVE;
    newStatus = EXEAT_STATES.HEADMASTER_APPROVED;
  }

  try {
    await transitionWorkflowWithAutoStart({
      event,
      entity: exeat,
      schoolId: ctx.schoolId,
      actor: { userId: ctx.session.user.id, role },
      reason: comments,
      extraMutations: [
        (tx) =>
          tx.exeatApproval.create({
            data: {
              schoolId: ctx.schoolId,
              exeatId: id,
              approverRole: role,
              approverId: ctx.session.user.id,
              action: "APPROVED",
              comments: comments || null,
            },
          }),
        (tx) =>
          tx.exeat.update({
            where: { id },
            data: { status: newStatus as never },
          }),
      ],
    });
  } catch (err) {
    if (err instanceof WorkflowTransitionError) return { error: err.message };
    throw err;
  }

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Exeat",
    entityId: id,
    module: "boarding",
    description: `${role} approved exeat ${exeat.exeatNumber}`,
    previousData: { status: exeat.status },
    newData: { status: newStatus },
  });

  return { success: true };
}

export async function rejectExeatAction(
  id: string,
  role: "housemaster" | "headmaster",
  comments?: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXEAT_APPROVE);
  if (denied) return denied;

  const exeat = await db.exeat.findUnique({ where: { id } });
  if (!exeat) return { error: "Exeat not found." };

  if (exeat.status === "REJECTED" || exeat.status === "CANCELLED") {
    return { error: "Exeat is already rejected or cancelled." };
  }

  try {
    await transitionWorkflowWithAutoStart({
      definitionKey: EXEAT_WORKFLOW_KEY,
      entityType: "Exeat",
      event: EXEAT_EVENTS.REJECT,
      entity: exeat,
      schoolId: ctx.schoolId,
      actor: { userId: ctx.session.user.id, role },
      reason: comments,
      extraMutations: [
        (tx) =>
          tx.exeatApproval.create({
            data: {
              schoolId: ctx.schoolId,
              exeatId: id,
              approverRole: role,
              approverId: ctx.session.user.id,
              action: "REJECTED",
              comments: comments || null,
            },
          }),
        (tx) =>
          tx.exeat.update({
            where: { id },
            data: { status: EXEAT_STATES.REJECTED },
          }),
      ],
    });
  } catch (err) {
    if (err instanceof WorkflowTransitionError) return { error: err.message };
    throw err;
  }

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Exeat",
    entityId: id,
    module: "boarding",
    description: `${role} rejected exeat ${exeat.exeatNumber}`,
    previousData: { status: exeat.status },
    newData: { status: EXEAT_STATES.REJECTED },
  });

  return { success: true };
}

export async function recordDepartureAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXEAT_APPROVE);
  if (denied) return denied;

  const exeat = await db.exeat.findUnique({ where: { id } });
  if (!exeat) return { error: "Exeat not found." };

  if (exeat.status !== "HEADMASTER_APPROVED") {
    return { error: "Exeat must be approved by headmaster before recording departure." };
  }

  try {
    await transitionWorkflowWithAutoStart({
      definitionKey: EXEAT_WORKFLOW_KEY,
      entityType: "Exeat",
      event: EXEAT_EVENTS.DEPART,
      entity: exeat,
      schoolId: ctx.schoolId,
      actor: { userId: ctx.session.user.id },
      extraMutations: [
        (tx) =>
          tx.exeat.update({
            where: { id },
            data: { status: EXEAT_STATES.DEPARTED },
          }),
      ],
    });
  } catch (err) {
    if (err instanceof WorkflowTransitionError) return { error: err.message };
    throw err;
  }

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Exeat",
    entityId: id,
    module: "boarding",
    description: `Recorded departure for exeat ${exeat.exeatNumber}`,
    previousData: { status: exeat.status },
    newData: { status: EXEAT_STATES.DEPARTED },
  });

  return { success: true };
}

export async function recordReturnAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXEAT_APPROVE);
  if (denied) return denied;

  const exeat = await db.exeat.findUnique({ where: { id } });
  if (!exeat) return { error: "Exeat not found." };

  if (exeat.status !== "DEPARTED" && exeat.status !== "OVERDUE") {
    return { error: "Exeat must be in DEPARTED or OVERDUE status." };
  }

  const now = new Date();

  try {
    await transitionWorkflowWithAutoStart({
      definitionKey: EXEAT_WORKFLOW_KEY,
      entityType: "Exeat",
      event: EXEAT_EVENTS.RETURN,
      entity: exeat,
      schoolId: ctx.schoolId,
      actor: { userId: ctx.session.user.id },
      extraMutations: [
        (tx) =>
          tx.exeat.update({
            where: { id },
            data: {
              status: EXEAT_STATES.RETURNED,
              actualReturnDate: now,
              actualReturnTime: now.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          }),
      ],
    });
  } catch (err) {
    if (err instanceof WorkflowTransitionError) return { error: err.message };
    throw err;
  }

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Exeat",
    entityId: id,
    module: "boarding",
    description: `Recorded return for exeat ${exeat.exeatNumber}`,
    previousData: { status: exeat.status },
    newData: { status: EXEAT_STATES.RETURNED, actualReturnDate: now },
  });

  return { success: true };
}

export async function getOverdueExeatsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXEAT_READ);
  if (denied) return denied;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const exeats = await db.exeat.findMany({
    where: {
      status: "DEPARTED",
      expectedReturnDate: { lt: now },
    },
    orderBy: { expectedReturnDate: "asc" },
  });

  // Fetch student names
  const studentIds = exeats.map((e) => e.studentId);
  let studentMap = new Map<string, { name: string; studentNumber: string }>();
  if (studentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, studentId: true },
    });
    studentMap = new Map(
      students.map((s) => [
        s.id,
        { name: `${s.firstName} ${s.lastName}`, studentNumber: s.studentId },
      ]),
    );
  }

  const data = exeats.map((e) => ({
    id: e.id,
    exeatNumber: e.exeatNumber,
    studentName: studentMap.get(e.studentId)?.name ?? "Unknown",
    studentNumber: studentMap.get(e.studentId)?.studentNumber ?? "",
    expectedReturnDate: e.expectedReturnDate,
    daysOverdue: Math.floor(
      (now.getTime() - new Date(e.expectedReturnDate).getTime()) / (1000 * 60 * 60 * 24),
    ),
  }));

  return { data };
}

export async function getExeatStatsAction(termId?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXEAT_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = {};
  if (termId) where.termId = termId;

  const [
    total,
    requested,
    housemasterApproved,
    headmasterApproved,
    rejected,
    departed,
    returned,
    overdue,
    cancelled,
  ] = await Promise.all([
    db.exeat.count({ where }),
    db.exeat.count({ where: { ...where, status: "REQUESTED" } }),
    db.exeat.count({ where: { ...where, status: "HOUSEMASTER_APPROVED" } }),
    db.exeat.count({ where: { ...where, status: "HEADMASTER_APPROVED" } }),
    db.exeat.count({ where: { ...where, status: "REJECTED" } }),
    db.exeat.count({ where: { ...where, status: "DEPARTED" } }),
    db.exeat.count({ where: { ...where, status: "RETURNED" } }),
    db.exeat.count({ where: { ...where, status: "OVERDUE" } }),
    db.exeat.count({ where: { ...where, status: "CANCELLED" } }),
  ]);

  // Also count overdue based on departed + past expected return
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const overdueActual = await db.exeat.count({
    where: {
      ...where,
      status: "DEPARTED",
      expectedReturnDate: { lt: now },
    },
  });

  return {
    data: {
      total,
      requested,
      housemasterApproved,
      headmasterApproved,
      rejected,
      departed,
      returned,
      overdue: overdue + overdueActual,
      cancelled,
    },
  };
}
