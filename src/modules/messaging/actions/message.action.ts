"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { isRateLimited } from "../eligibility";
import {
  validateAttachment,
  ALLOWED_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "../attachments";
import { notifyNewMessage } from "../notifications";
import { headObject, deleteFile } from "@/lib/storage/r2";

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

  // Server-side HEAD verification of the uploaded object. Catches lies about
  // MIME type or size that slipped past the client-side validate step and
  // aren't enforced by the signed-URL Content-Length binding alone (e.g.
  // content-type spoofing). Rejects + deletes on any mismatch.
  if (input.attachmentKey) {
    const head = await headObject(input.attachmentKey);
    if (!head) {
      return { error: "Uploaded attachment was not found in storage." };
    }
    const allowedMimes: readonly string[] = ALLOWED_MIME_TYPES;
    const sizeMismatch = head.contentLength !== input.attachmentSize;
    const mimeMismatch = head.contentType !== input.attachmentMime;
    const tooLarge = head.contentLength > MAX_ATTACHMENT_SIZE_BYTES;
    const mimeNotAllowed = !allowedMimes.includes(head.contentType);
    if (sizeMismatch || mimeMismatch || tooLarge || mimeNotAllowed) {
      try {
        await deleteFile(input.attachmentKey);
      } catch {
        // best-effort cleanup
      }
      return { error: "Uploaded attachment did not match declared metadata." };
    }
  }

  const thread = await db.messageThread.findFirst({
    where: { id: input.threadId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
          guardians: {
            select: {
              guardian: {
                select: { userId: true, firstName: true, lastName: true },
              },
            },
          },
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

  const { message } = await db.$transaction(async (tx) => {
    const m = await tx.message.create({
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
    await tx.messageThread.update({
      where: { id: input.threadId },
      data: { lastMessageAt: m.createdAt },
    });
    return { message: m };
  });

  try {
    const recipients =
      authorRole === "teacher"
        ? guardianUserIds
        : [thread.teacherUserId];

    const bodyPreview =
      (body.length > 120 ? body.slice(0, 120) + "…" : body) +
      (input.attachmentName ? ` [attachment: ${input.attachmentName}]` : "");

    let authorName = "(user)";
    if (authorRole === "teacher") {
      authorName =
        [thread.teacher?.firstName, thread.teacher?.lastName]
          .filter(Boolean)
          .join(" ") || "(user)";
    } else {
      const guardianRow = thread.student.guardians.find(
        (g) => g.guardian.userId === userId,
      );
      if (guardianRow) {
        authorName =
          [guardianRow.guardian.firstName, guardianRow.guardian.lastName]
            .filter(Boolean)
            .join(" ") || "Parent";
      } else {
        authorName = "Parent";
      }
    }

    await notifyNewMessage({
      messageId: message.id,
      threadId: thread.id,
      recipientUserIds: recipients,
      authorRole,
      studentName: `${thread.student.firstName} ${thread.student.lastName}`,
      authorName,
      bodyPreview,
    });
  } catch (err) {
    // Best-effort: the message is already persisted. Log so the fan-out
    // failure is observable without breaking the post-message flow.
    console.error("notification fan-out failed", {
      threadId: thread.id,
      messageId: message.id,
      err,
    });
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
