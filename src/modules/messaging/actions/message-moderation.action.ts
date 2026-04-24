"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Report Queue ──────────────────────────────────────────────────

export async function getMessageReportsAction(filters?: {
  status?: "PENDING" | "DISMISSED" | "ACTIONED";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_REVIEW);
  if (denied) return denied;

  const reports = await db.messageReport.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      message: { thread: { schoolId: ctx.schoolId } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      message: {
        select: {
          id: true,
          body: true,
          authorUserId: true,
          author: { select: { firstName: true, lastName: true } },
          thread: {
            select: {
              id: true,
              studentId: true,
              student: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  return {
    data: reports.map((r) => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      reportedAt: r.createdAt,
      reportedByUserId: r.reportedByUserId,
      message: {
        id: r.message.id,
        body: r.message.body,
        authorName:
          [r.message.author?.firstName, r.message.author?.lastName]
            .filter(Boolean)
            .join(" ") || "(user)",
      },
      thread: {
        id: r.message.thread.id,
        studentName: `${r.message.thread.student.firstName} ${r.message.thread.student.lastName}`,
      },
    })),
  };
}

// ─── Resolve Report ────────────────────────────────────────────────

export async function resolveReportAction(input: {
  reportId: string;
  action: "DISMISS" | "ACTION";
  note?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_REVIEW);
  if (denied) return denied;

  const report = await db.messageReport.findFirst({
    where: {
      id: input.reportId,
      message: { thread: { schoolId: ctx.schoolId } },
    },
  });
  if (!report) return { error: "Report not found." };
  if (report.status !== "PENDING") {
    return { error: "Report has already been resolved." };
  }

  const newStatus = input.action === "DISMISS" ? "DISMISSED" : "ACTIONED";
  await db.messageReport.update({
    where: { id: input.reportId },
    data: {
      status: newStatus,
      resolvedAt: new Date(),
      resolvedByUserId: ctx.session.user.id!,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "MessageReport",
    entityId: input.reportId,
    module: "messaging",
    description: `Resolved report as ${newStatus}${input.note ? `: ${input.note}` : ""}`,
    newData: { status: newStatus, note: input.note },
  });

  return { success: true };
}

// ─── Lock Thread ───────────────────────────────────────────────────

export async function lockThreadAction(input: {
  threadId: string;
  reason: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_REVIEW);
  if (denied) return denied;

  const reason = (input.reason ?? "").trim();
  if (!reason) return { error: "Please provide a reason for locking the thread." };

  const thread = await db.messageThread.findFirst({
    where: { id: input.threadId, schoolId: ctx.schoolId },
  });
  if (!thread) return { error: "Thread not found." };

  // Idempotent: don't overwrite the original lock's provenance (lockedAt /
  // lockedBy) if the thread is already locked. Callers who want to change
  // the reason must unlock first.
  if (thread.lockedAt != null) {
    return { error: "Thread is already locked." };
  }

  await db.messageThread.update({
    where: { id: input.threadId },
    data: {
      lockedAt: new Date(),
      lockedBy: ctx.session.user.id!,
      lockReason: reason,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "MessageThread",
    entityId: input.threadId,
    module: "messaging",
    description: `Locked thread: ${reason}`,
  });

  return { success: true };
}

// ─── Unlock Thread ─────────────────────────────────────────────────

export async function unlockThreadAction(threadId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_REVIEW);
  if (denied) return denied;

  const thread = await db.messageThread.findFirst({
    where: { id: threadId, schoolId: ctx.schoolId },
  });
  if (!thread) return { error: "Thread not found." };

  // No-op + no audit entry when the thread is already unlocked — avoids
  // polluting the audit log with redundant "unlocked" events.
  if (thread.lockedAt == null) {
    return { success: true };
  }

  await db.messageThread.update({
    where: { id: threadId },
    data: { lockedAt: null, lockedBy: null, lockReason: null },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "MessageThread",
    entityId: threadId,
    module: "messaging",
    description: `Unlocked thread`,
  });

  return { success: true };
}
