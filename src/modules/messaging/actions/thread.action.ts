"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

type ThreadListRow = {
  id: string;
  studentId: string;
  studentName: string;
  teacherUserId: string;
  teacherName: string;
  status: "ACTIVE" | "ARCHIVED";
  locked: boolean;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount: number;
};

// ─── List Threads ──────────────────────────────────────────────────

export async function getMessageThreadsAction(filters?: {
  studentId?: string;
  status?: "ACTIVE" | "ARCHIVED";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const hasPortalUse = !assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  const hasAdminRead = !assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_READ);
  if (!hasPortalUse && !hasAdminRead) {
    return { error: "Insufficient permissions" };
  }

  const userId = ctx.session.user.id!;

  const where: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    ...(filters?.status ? { status: filters.status } : {}),
    ...(filters?.studentId ? { studentId: filters.studentId } : {}),
  };

  if (!hasAdminRead) {
    where.OR = [
      { teacherUserId: userId },
      { student: { guardians: { some: { guardian: { userId } } } } },
    ];
  }

  const threads = await db.messageThread.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true, systemNote: true },
      },
      reads: {
        where: { userId },
        select: { lastReadAt: true },
      },
    },
  });

  const data: ThreadListRow[] = await Promise.all(
    threads.map(async (t) => {
      const lastReadAt = t.reads[0]?.lastReadAt ?? null;
      const unreadCount = await db.message.count({
        where: {
          threadId: t.id,
          authorUserId: { not: userId },
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
      });
      const lastMsg = t.messages[0];
      return {
        id: t.id,
        studentId: t.studentId,
        studentName: `${t.student.firstName} ${t.student.lastName}`,
        teacherUserId: t.teacherUserId,
        teacherName: t.teacher
          ? `${t.teacher.firstName} ${t.teacher.lastName}`.trim()
          : "(teacher)",
        status: t.status,
        locked: t.lockedAt != null,
        lastMessageAt: t.lastMessageAt,
        lastMessagePreview: lastMsg?.body?.slice(0, 120) ?? null,
        unreadCount,
      };
    }),
  );

  return { data };
}

// ─── Get Single Thread ─────────────────────────────────────────────

export async function getMessageThreadAction(threadId: string, options?: { limit?: number }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const hasPortalUse = !assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  const hasAdminRead = !assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_READ);
  if (!hasPortalUse && !hasAdminRead) return { error: "Insufficient permissions" };

  const userId = ctx.session.user.id!;

  const thread = await db.messageThread.findFirst({
    where: { id: threadId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          guardians: { select: { guardian: { select: { userId: true } } } },
        },
      },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: options?.limit ?? 50,
      },
    },
  });
  if (!thread) return { error: "Thread not found" };

  const guardianUserIds = thread.student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  const isParticipant = userId === thread.teacherUserId || guardianUserIds.includes(userId);

  if (isParticipant) {
    await db.messageThreadRead.upsert({
      where: { threadId_userId: { threadId, userId } },
      create: { threadId, userId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
  }

  return {
    data: {
      id: thread.id,
      studentId: thread.studentId,
      studentName: `${thread.student.firstName} ${thread.student.lastName}`,
      teacher: {
        id: thread.teacher?.id ?? thread.teacherUserId,
        name: thread.teacher
          ? `${thread.teacher.firstName} ${thread.teacher.lastName}`.trim()
          : "(teacher)",
      },
      status: thread.status,
      locked: thread.lockedAt != null,
      lockReason: thread.lockReason,
      messages: thread.messages.slice().reverse(),
      isParticipant,
      isAdmin: hasAdminRead && !isParticipant,
    },
  };
}

// ─── Create Thread ─────────────────────────────────────────────────

export async function createMessageThreadAction(input: {
  studentId: string;
  teacherUserId: string;
  initialBody: string;
  attachmentKey?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMime?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  if (denied) return denied;

  const userId = ctx.session.user.id!;
  const body = (input.initialBody ?? "").trim();
  if (!body) return { error: "Message body is required." };

  const student = await db.student.findFirst({
    where: { id: input.studentId, schoolId: ctx.schoolId },
    select: {
      id: true,
      schoolId: true,
      status: true,
      boardingStatus: true,
      guardians: { select: { guardian: { select: { userId: true } } } },
      enrollments: {
        where: { status: "ACTIVE" },
        select: { classArmId: true },
        take: 1,
      },
      houseAssignment: { select: { houseId: true } },
    },
  });
  if (!student) return { error: "Student not found." };

  const existing = await db.messageThread.findUnique({
    where: {
      studentId_teacherUserId: {
        studentId: input.studentId,
        teacherUserId: input.teacherUserId,
      },
    },
  });

  const guardianUserIds = student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  const callerIsGuardian = guardianUserIds.includes(userId);
  const callerIsTheTeacher = userId === input.teacherUserId;

  if (!existing && !callerIsGuardian && !callerIsTheTeacher) {
    return { error: "You are not allowed to participate in this thread." };
  }

  if (existing) {
    if (callerIsGuardian || callerIsTheTeacher) {
      const msg = await db.message.create({
        data: {
          threadId: existing.id,
          authorUserId: userId,
          body,
          attachmentKey: input.attachmentKey ?? null,
          attachmentName: input.attachmentName ?? null,
          attachmentSize: input.attachmentSize ?? null,
          attachmentMime: input.attachmentMime ?? null,
        },
      });
      await db.messageThread.update({
        where: { id: existing.id },
        data: { lastMessageAt: msg.createdAt },
      });
    }
    return { data: existing };
  }

  const { thread } = await db.$transaction(async (tx) => {
    const t = await tx.messageThread.create({
      data: {
        schoolId: ctx.schoolId,
        studentId: input.studentId,
        teacherUserId: input.teacherUserId,
        status: "ACTIVE",
        lastMessageAt: new Date(),
      },
    });
    await tx.message.create({
      data: {
        threadId: t.id,
        authorUserId: userId,
        body,
        attachmentKey: input.attachmentKey ?? null,
        attachmentName: input.attachmentName ?? null,
        attachmentSize: input.attachmentSize ?? null,
        attachmentMime: input.attachmentMime ?? null,
      },
    });
    return { thread: t };
  });

  return { data: thread };
}

// ─── Mark Thread Read ──────────────────────────────────────────────

/** @no-audit Portal read-state tracking; not a material mutation. */
export async function markThreadReadAction(threadId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  const thread = await db.messageThread.findFirst({
    where: { id: threadId, schoolId: ctx.schoolId },
    select: {
      teacherUserId: true,
      student: { select: { guardians: { select: { guardian: { select: { userId: true } } } } } },
    },
  });
  if (!thread) return { error: "Thread not found" };

  const guardianUserIds = thread.student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  const isParticipant = userId === thread.teacherUserId || guardianUserIds.includes(userId);
  if (!isParticipant) return { success: true };

  await db.messageThreadRead.upsert({
    where: { threadId_userId: { threadId, userId } },
    create: { threadId, userId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });

  return { success: true };
}

// ─── Archive Thread (Admin-callable) ───────────────────────────────

export async function archiveThreadAction(threadId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_REVIEW);
  if (denied) return denied;

  const thread = await db.messageThread.findFirst({
    where: { id: threadId, schoolId: ctx.schoolId },
  });
  if (!thread) return { error: "Thread not found" };

  if (thread.status === "ARCHIVED") return { success: true };

  await db.messageThread.update({
    where: { id: threadId },
    data: { status: "ARCHIVED" },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "MessageThread",
    entityId: threadId,
    module: "messaging",
    description: `Archived message thread ${threadId}`,
  });

  return { success: true };
}
