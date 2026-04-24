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

  // Batch unread-count computation: one query fetches all candidate messages
  // (not authored by the caller) across all listed threads, then we group and
  // apply per-thread lastReadAt cutoffs in memory. Typical thread-list size
  // makes this cheaper than one count() per thread.
  const threadIds = threads.map((t) => t.id);
  const candidateMessages =
    threadIds.length > 0
      ? await db.message.findMany({
          where: {
            threadId: { in: threadIds },
            authorUserId: { not: userId },
          },
          select: { threadId: true, createdAt: true },
        })
      : [];

  const unreadByThread = new Map<string, number>();
  const lastReadByThread = new Map<string, Date | null>();
  for (const t of threads) {
    lastReadByThread.set(t.id, t.reads[0]?.lastReadAt ?? null);
    unreadByThread.set(t.id, 0);
  }
  for (const m of candidateMessages) {
    const lastReadAt = lastReadByThread.get(m.threadId) ?? null;
    if (lastReadAt && m.createdAt <= lastReadAt) continue;
    unreadByThread.set(m.threadId, (unreadByThread.get(m.threadId) ?? 0) + 1);
  }

  const data: ThreadListRow[] = threads.map((t) => {
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
      unreadCount: unreadByThread.get(t.id) ?? 0,
    };
  });

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

  const guardianUserIds = student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  const callerIsGuardian = guardianUserIds.includes(userId);
  const callerIsTheTeacher = userId === input.teacherUserId;

  // Participation guard FIRST — prevents enumeration of existing (student, teacher) pairs
  // by non-participants holding messaging:portal:use in the same school.
  if (!callerIsGuardian && !callerIsTheTeacher) {
    return { error: "You are not allowed to participate in this thread." };
  }

  const existing = await db.messageThread.findFirst({
    where: {
      studentId: input.studentId,
      teacherUserId: input.teacherUserId,
      status: "ACTIVE",
    },
  });

  if (existing) {
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

// ─── Eligible Counterparts (New-Conversation Picker) ──────────────

export type CounterpartOption = {
  studentId: string;
  studentName: string;
  teacherUserId: string;
  teacherName: string;
  role: "class_teacher" | "housemaster";
};

/** @no-audit Read-only helper for the new-conversation picker. */
export async function getEligibleCounterpartsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  if (denied) return denied;

  const userId = ctx.session.user.id!;

  // Guardian.userId is nullable — findUnique returns null for non-guardians, which is handled below.
  const guardian = await db.guardian.findUnique({
    where: { userId },
    include: {
      students: {
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              status: true,
              boardingStatus: true,
              schoolId: true,
              enrollments: {
                where: { status: "ACTIVE" },
                take: 1,
                select: {
                  classArm: {
                    select: {
                      id: true,
                      classTeacherId: true,
                    },
                  },
                },
              },
              houseAssignment: {
                select: {
                  house: {
                    select: {
                      id: true,
                      housemasterId: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const counterparts: CounterpartOption[] = [];

  if (guardian) {
    // Collect distinct Staff IDs (class teachers + housemasters) to batch-resolve into Users.
    const staffIds = new Set<string>();
    for (const sg of guardian.students) {
      const s = sg.student;
      if (s.schoolId !== ctx.schoolId) continue;
      if (s.status !== "ACTIVE" && s.status !== "SUSPENDED") continue;

      const classTeacherId = s.enrollments[0]?.classArm?.classTeacherId;
      if (classTeacherId) staffIds.add(classTeacherId);

      if (s.boardingStatus === "BOARDING") {
        const hmId = s.houseAssignment?.house?.housemasterId;
        if (hmId) staffIds.add(hmId);
      }
    }

    const staffRows =
      staffIds.size > 0
        ? await db.staff.findMany({
            where: { id: { in: [...staffIds] }, schoolId: ctx.schoolId },
            select: { id: true, userId: true, firstName: true, lastName: true },
          })
        : [];
    const staffById = new Map(staffRows.map((r) => [r.id, r]));

    for (const sg of guardian.students) {
      const s = sg.student;
      if (s.schoolId !== ctx.schoolId) continue;
      if (s.status !== "ACTIVE" && s.status !== "SUSPENDED") continue;

      const studentName = `${s.firstName} ${s.lastName}`;

      // Class-teacher counterpart
      const classTeacherId = s.enrollments[0]?.classArm?.classTeacherId;
      if (classTeacherId) {
        const staff = staffById.get(classTeacherId);
        if (staff?.userId) {
          const teacherName =
            [staff.firstName, staff.lastName].filter(Boolean).join(" ") || "Class teacher";
          counterparts.push({
            studentId: s.id,
            studentName,
            teacherUserId: staff.userId,
            teacherName,
            role: "class_teacher",
          });
        }
      }

      // Housemaster counterpart (boarding students only)
      if (s.boardingStatus === "BOARDING") {
        const hmId = s.houseAssignment?.house?.housemasterId;
        if (hmId) {
          const staff = staffById.get(hmId);
          if (staff?.userId) {
            const teacherName =
              [staff.firstName, staff.lastName].filter(Boolean).join(" ") || "Housemaster";
            counterparts.push({
              studentId: s.id,
              studentName,
              teacherUserId: staff.userId,
              teacherName,
              role: "housemaster",
            });
          }
        }
      }
    }
  }

  return { data: counterparts };
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
