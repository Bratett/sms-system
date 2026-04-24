"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { isRateLimited } from "../eligibility";
import { validateAttachment } from "../attachments";
import { notifyNewMessage } from "../notifications";

// ─── Post Message ──────────────────────────────────────────────────

/** @no-audit Message content is itself the record. Volume would flood audit log. */
export async function postMessageAction(input: {
  threadId: string;
  body: string;
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
  const body = (input.body ?? "").trim();
  if (!body && !input.attachmentKey) return { error: "Message is empty." };

  if (input.attachmentKey) {
    if (!input.attachmentMime || !input.attachmentSize) {
      return { error: "Attachment metadata incomplete." };
    }
    const validation = validateAttachment({
      mimeType: input.attachmentMime,
      size: input.attachmentSize,
    });
    if (!validation.ok) return { error: validation.error };
  }

  const thread = await db.messageThread.findFirst({
    where: { id: input.threadId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
          guardians: { select: { guardian: { select: { userId: true } } } },
        },
      },
      teacher: { select: { firstName: true, lastName: true } },
    },
  });
  if (!thread) return { error: "Thread not found." };

  if (thread.status === "ARCHIVED") return { error: "Thread is archived." };
  if (thread.lockedAt != null) return { error: "Thread is locked." };

  const guardianUserIds = thread.student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  const authorRole: "parent" | "teacher" =
    userId === thread.teacherUserId ? "teacher" : "parent";
  const isParticipant =
    authorRole === "teacher" || guardianUserIds.includes(userId);
  if (!isParticipant) return { error: "You are not a participant of this thread." };

  const recent = await db.message.findMany({
    where: {
      threadId: input.threadId,
      authorUserId: userId,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    select: { createdAt: true },
  });
  if (isRateLimited(recent.map((r) => r.createdAt))) {
    return { error: "Too many messages. Please wait before sending another." };
  }

  const message = await db.message.create({
    data: {
      threadId: input.threadId,
      authorUserId: userId,
      body,
      attachmentKey: input.attachmentKey ?? null,
      attachmentName: input.attachmentName ?? null,
      attachmentSize: input.attachmentSize ?? null,
      attachmentMime: input.attachmentMime ?? null,
    },
  });
  await db.messageThread.update({
    where: { id: input.threadId },
    data: { lastMessageAt: message.createdAt },
  });

  try {
    const recipients =
      authorRole === "teacher"
        ? guardianUserIds
        : [thread.teacherUserId];

    const bodyPreview =
      (body.length > 120 ? body.slice(0, 120) + "…" : body) +
      (input.attachmentName ? ` [attachment: ${input.attachmentName}]` : "");

    const teacherName =
      [thread.teacher?.firstName, thread.teacher?.lastName].filter(Boolean).join(" ") || "(user)";

    await notifyNewMessage({
      messageId: message.id,
      threadId: thread.id,
      recipientUserIds: recipients,
      authorRole,
      studentName: `${thread.student.firstName} ${thread.student.lastName}`,
      authorName: teacherName,
      bodyPreview,
    });
  } catch {
    // swallowed
  }

  return { data: message };
}

// ─── Report Message ────────────────────────────────────────────────

export async function reportMessageAction(input: {
  messageId: string;
  reason: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_REPORT);
  if (denied) return denied;

  const reason = (input.reason ?? "").trim();
  if (!reason) return { error: "Please describe why you're reporting this message." };

  const userId = ctx.session.user.id!;
  const hasAdminRead = !assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_READ);

  const message = await db.message.findFirst({
    where: { id: input.messageId, thread: { schoolId: ctx.schoolId } },
    include: {
      thread: {
        select: {
          schoolId: true,
          teacherUserId: true,
          student: {
            select: {
              guardians: { select: { guardian: { select: { userId: true } } } },
            },
          },
        },
      },
    },
  });
  if (!message) return { error: "Message not found." };

  const guardianUserIds = message.thread.student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  const isParticipant =
    userId === message.thread.teacherUserId || guardianUserIds.includes(userId);
  if (!isParticipant && !hasAdminRead) {
    // Mirror the response shape used by getMessageAttachmentUrlAction to avoid
    // leaking thread existence to non-participants holding messaging:report.
    return { error: "Message not found." };
  }

  const report = await db.messageReport.create({
    data: {
      messageId: input.messageId,
      reportedByUserId: ctx.session.user.id!,
      reason,
      status: "PENDING",
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "CREATE",
    entity: "MessageReport",
    entityId: report.id,
    module: "messaging",
    description: `Reported message ${input.messageId}`,
    newData: { reason, messageId: input.messageId },
  });

  return { success: true, reportId: report.id };
}
