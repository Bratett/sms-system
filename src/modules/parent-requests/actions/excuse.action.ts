"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  isValidDateRange,
  isWithinRetroactiveWindow,
} from "../eligibility";
import { validateAttachment } from "@/modules/messaging/attachments";
import { notifyExcuseSubmitted, notifyExcuseReviewed } from "../notifications";

type AttachmentInput = {
  attachmentKey?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMime?: string;
};

function checkAttachment(input: AttachmentInput): { ok: true } | { ok: false; error: string } {
  if (!input.attachmentKey) return { ok: true };
  if (!input.attachmentMime || !input.attachmentSize) {
    return { ok: false, error: "Attachment metadata incomplete." };
  }
  const v = validateAttachment({
    mimeType: input.attachmentMime,
    size: input.attachmentSize,
  });
  return v.ok ? { ok: true } : v;
}

async function resolveEligibleReviewerUserIds(
  schoolId: string,
  student: {
    boardingStatus: string;
    enrollments: Array<{ classArmId: string | null }>;
    houseAssignment: { houseId: string } | null;
  },
): Promise<string[]> {
  const staffIds = new Set<string>();

  const classArmId = student.enrollments[0]?.classArmId;
  if (classArmId) {
    const arm = await db.classArm.findFirst({
      where: { id: classArmId, schoolId },
      select: { classTeacherId: true },
    });
    if (arm?.classTeacherId) staffIds.add(arm.classTeacherId);
  }

  const houseId = student.houseAssignment?.houseId;
  if (houseId && student.boardingStatus === "BOARDING") {
    const house = await db.house.findFirst({
      where: { id: houseId, schoolId },
      select: { housemasterId: true },
    });
    if (house?.housemasterId) staffIds.add(house.housemasterId);
  }

  if (staffIds.size === 0) return [];

  const staff = await db.staff.findMany({
    where: {
      id: { in: [...staffIds] },
      schoolId,
      userId: { not: null },
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { userId: true },
  });
  return staff
    .map((s) => s.userId)
    .filter((u): u is string => u != null);
}

async function isEligibleReviewerForStudent(
  schoolId: string,
  staffId: string | undefined,
  student: {
    status: string;
    boardingStatus: string;
    enrollments: Array<{ classArmId: string | null }>;
    houseAssignment: { houseId: string } | null;
  },
): Promise<boolean> {
  if (!staffId) return false;
  if (student.status !== "ACTIVE" && student.status !== "SUSPENDED") return false;

  const classArmId = student.enrollments[0]?.classArmId;
  if (classArmId) {
    const arm = await db.classArm.findFirst({
      where: { id: classArmId, schoolId, classTeacherId: staffId },
      select: { id: true },
    });
    if (arm) return true;
  }

  const houseId = student.houseAssignment?.houseId;
  if (houseId && student.boardingStatus === "BOARDING") {
    const house = await db.house.findFirst({
      where: { id: houseId, schoolId, housemasterId: staffId },
      select: { id: true },
    });
    if (house) return true;
  }

  return false;
}

// ─── Submit ───────────────────────────────────────────────────────

export async function submitExcuseRequestAction(input: {
  studentId: string;
  fromDate: Date;
  toDate: Date;
  reason: string;
} & AttachmentInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXCUSE_SUBMIT);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const reason = (input.reason ?? "").trim();
  if (!reason) return { error: "Reason is required." };

  const now = new Date();
  if (!isValidDateRange(input.fromDate, input.toDate, now)) {
    return { error: "Invalid date range." };
  }
  if (!isWithinRetroactiveWindow(input.fromDate, now)) {
    return { error: "Date must be within the last 14 days." };
  }

  const att = checkAttachment(input);
  if (!att.ok) return { error: att.error };

  const student = await db.student.findFirst({
    where: { id: input.studentId, schoolId: ctx.schoolId },
    select: {
      id: true,
      schoolId: true,
      status: true,
      boardingStatus: true,
      firstName: true,
      lastName: true,
      guardians: { select: { guardian: { select: { userId: true } } } },
      enrollments: {
        where: { status: "ACTIVE" },
        take: 1,
        select: { classArmId: true },
      },
      houseAssignment: { select: { houseId: true } },
    },
  });
  if (!student) return { error: "Student not found." };
  if (student.status !== "ACTIVE" && student.status !== "SUSPENDED") {
    return { error: "Student is not currently active." };
  }
  const guardianUserIds = student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  if (!guardianUserIds.includes(userId)) {
    return { error: "You are not authorized to submit for this student." };
  }

  const created = await db.excuseRequest.create({
    data: {
      schoolId: ctx.schoolId,
      studentId: input.studentId,
      submittedByUserId: userId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      reason,
      attachmentKey: input.attachmentKey ?? null,
      attachmentName: input.attachmentName ?? null,
      attachmentSize: input.attachmentSize ?? null,
      attachmentMime: input.attachmentMime ?? null,
      status: "PENDING",
    },
  });

  try {
    const reviewerUserIds = await resolveEligibleReviewerUserIds(ctx.schoolId, student);
    if (reviewerUserIds.length > 0) {
      await notifyExcuseSubmitted({
        requestId: created.id,
        reviewerUserIds,
        studentName: `${student.firstName} ${student.lastName}`,
        fromDate: input.fromDate,
        toDate: input.toDate,
        submitterName: ctx.session.user.name ?? "Parent",
      });
    }
  } catch (err) {
    console.error("notifyExcuseSubmitted failed", { requestId: created.id, err });
  }

  return { data: { id: created.id } };
}

// ─── Withdraw ─────────────────────────────────────────────────────

export async function withdrawExcuseRequestAction(requestId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXCUSE_SUBMIT);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const req = await db.excuseRequest.findFirst({
    where: { id: requestId, schoolId: ctx.schoolId },
    select: { submittedByUserId: true, status: true },
  });
  if (!req) return { error: "Request not found." };
  if (req.submittedByUserId !== userId) {
    return { error: "You can only withdraw your own requests." };
  }
  if (req.status !== "PENDING") {
    return { error: "Already reviewed" };
  }

  await db.excuseRequest.update({
    where: { id: requestId },
    data: { status: "WITHDRAWN" },
  });

  return { success: true };
}

// ─── Get Mine ─────────────────────────────────────────────────────

/** @no-audit Read-only. */
export async function getMyExcuseRequestsAction(filters?: {
  status?: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXCUSE_SUBMIT);
  if (denied) return denied;

  const rows = await db.excuseRequest.findMany({
    where: {
      schoolId: ctx.schoolId,
      submittedByUserId: ctx.session.user.id!,
      ...(filters?.status ? { status: filters.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return { data: rows };
}

// ─── Get Pending (reviewer queue) ─────────────────────────────────

/** @no-audit Read-only. */
export async function getPendingExcuseRequestsAction(filters?: { studentId?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXCUSE_REVIEW);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const staff = await db.staff.findFirst({
    where: { userId, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (!staff) return { data: [] };

  const [arms, houses] = await Promise.all([
    db.classArm.findMany({
      where: { classTeacherId: staff.id, schoolId: ctx.schoolId },
      select: { id: true },
    }),
    db.house.findMany({
      where: { housemasterId: staff.id, schoolId: ctx.schoolId },
      select: { id: true },
    }),
  ]);
  const armIds = arms.map((a) => a.id);
  const houseIds = houses.map((h) => h.id);

  if (armIds.length === 0 && houseIds.length === 0) return { data: [] };

  const orClauses: Array<Record<string, unknown>> = [];
  if (armIds.length > 0) {
    orClauses.push({
      enrollments: { some: { status: "ACTIVE", classArmId: { in: armIds } } },
    });
  }
  if (houseIds.length > 0) {
    orClauses.push({
      boardingStatus: "BOARDING",
      houseAssignment: { houseId: { in: houseIds } },
    });
  }

  const rows = await db.excuseRequest.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "PENDING",
      ...(filters?.studentId ? { studentId: filters.studentId } : {}),
      student: { OR: orClauses as never },
    },
    orderBy: { createdAt: "asc" },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      submittedBy: { select: { firstName: true, lastName: true } },
    },
  });

  return { data: rows };
}

// ─── Get One ──────────────────────────────────────────────────────

/** @no-audit Read-only. */
export async function getExcuseRequestAction(requestId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const userId = ctx.session.user.id!;

  const row = await db.excuseRequest.findFirst({
    where: { id: requestId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          boardingStatus: true,
          enrollments: { where: { status: "ACTIVE" }, take: 1, select: { classArmId: true } },
          houseAssignment: { select: { houseId: true } },
        },
      },
      submittedBy: { select: { id: true, firstName: true, lastName: true } },
      reviewer: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!row) return { error: "Request not found." };

  const isSubmitter = row.submittedByUserId === userId;
  const hasReviewPerm = !assertPermission(ctx.session, PERMISSIONS.EXCUSE_REVIEW);
  if (!isSubmitter && !hasReviewPerm) {
    return { error: "Request not found." };
  }

  return { data: row };
}

// ─── Approve ──────────────────────────────────────────────────────

export async function approveExcuseRequestAction(input: {
  requestId: string;
  reviewNote?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXCUSE_REVIEW);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const row = await db.excuseRequest.findFirst({
    where: { id: input.requestId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          boardingStatus: true,
          schoolId: true,
          enrollments: { where: { status: "ACTIVE" }, take: 1, select: { classArmId: true } },
          houseAssignment: { select: { houseId: true } },
        },
      },
    },
  });
  if (!row) return { error: "Request not found." };
  if (row.status !== "PENDING") return { error: "Already reviewed" };

  const staff = await db.staff.findFirst({
    where: { userId, schoolId: ctx.schoolId },
    select: { id: true, firstName: true, lastName: true },
  });
  const eligible = await isEligibleReviewerForStudent(ctx.schoolId, staff?.id, row.student);
  if (!eligible) {
    return { error: "You are not assigned to this student's class arm or house." };
  }

  await db.$transaction(async (tx) => {
    await tx.excuseRequest.update({
      where: { id: row.id },
      data: {
        status: "APPROVED",
        reviewerUserId: userId,
        reviewNote: input.reviewNote?.trim() || null,
        reviewedAt: new Date(),
      },
    });
    await tx.attendanceRecord.updateMany({
      where: {
        studentId: row.studentId,
        status: { in: ["ABSENT", "LATE", "SICK"] },
        register: {
          schoolId: ctx.schoolId,
          date: { gte: row.fromDate, lte: row.toDate },
        },
      },
      data: { status: "EXCUSED" },
    });
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "ExcuseRequest",
    entityId: row.id,
    module: "parent-requests",
    description: `Approved excuse request ${row.id}`,
    newData: { status: "APPROVED", reviewNote: input.reviewNote ?? null },
  });

  try {
    await notifyExcuseReviewed({
      requestId: row.id,
      submitterUserId: row.submittedByUserId,
      outcome: "APPROVED",
      reviewerName: [staff?.firstName, staff?.lastName].filter(Boolean).join(" ") || "Reviewer",
      reviewNote: input.reviewNote,
      studentName: `${row.student.firstName} ${row.student.lastName}`,
    });
  } catch (err) {
    console.error("notifyExcuseReviewed failed", { requestId: row.id, err });
  }

  return { success: true };
}

// ─── Reject ───────────────────────────────────────────────────────

export async function rejectExcuseRequestAction(input: {
  requestId: string;
  reviewNote: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXCUSE_REVIEW);
  if (denied) return denied;

  const reviewNote = (input.reviewNote ?? "").trim();
  if (!reviewNote) return { error: "A review note is required to reject." };

  const userId = ctx.session.user.id!;
  const row = await db.excuseRequest.findFirst({
    where: { id: input.requestId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          boardingStatus: true,
          schoolId: true,
          enrollments: { where: { status: "ACTIVE" }, take: 1, select: { classArmId: true } },
          houseAssignment: { select: { houseId: true } },
        },
      },
    },
  });
  if (!row) return { error: "Request not found." };
  if (row.status !== "PENDING") return { error: "Already reviewed" };

  const staff = await db.staff.findFirst({
    where: { userId, schoolId: ctx.schoolId },
    select: { id: true, firstName: true, lastName: true },
  });
  const eligible = await isEligibleReviewerForStudent(ctx.schoolId, staff?.id, row.student);
  if (!eligible) {
    return { error: "You are not assigned to this student's class arm or house." };
  }

  await db.excuseRequest.update({
    where: { id: row.id },
    data: {
      status: "REJECTED",
      reviewerUserId: userId,
      reviewNote,
      reviewedAt: new Date(),
    },
  });

  await audit({
    userId,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "ExcuseRequest",
    entityId: row.id,
    module: "parent-requests",
    description: `Rejected excuse request ${row.id}`,
    newData: { status: "REJECTED", reviewNote },
  });

  try {
    await notifyExcuseReviewed({
      requestId: row.id,
      submitterUserId: row.submittedByUserId,
      outcome: "REJECTED",
      reviewerName: [staff?.firstName, staff?.lastName].filter(Boolean).join(" ") || "Reviewer",
      reviewNote,
      studentName: `${row.student.firstName} ${row.student.lastName}`,
    });
  } catch (err) {
    console.error("notifyExcuseReviewed failed", { requestId: row.id, err });
  }

  return { success: true };
}
