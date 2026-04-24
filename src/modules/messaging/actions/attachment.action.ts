"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { getSignedDownloadUrl, getSignedUploadUrl } from "@/lib/storage/r2";
import { validateAttachment, buildAttachmentKey } from "../attachments";

export async function getMessageAttachmentUploadUrlAction(input: {
  threadId: string;
  filename: string;
  mimeType: string;
  size: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  if (denied) return denied;

  const validation = validateAttachment({ mimeType: input.mimeType, size: input.size });
  if (!validation.ok) return { error: validation.error };

  const userId = ctx.session.user.id!;

  const thread = await db.messageThread.findFirst({
    where: { id: input.threadId, schoolId: ctx.schoolId },
    include: {
      student: {
        select: { guardians: { select: { guardian: { select: { userId: true } } } } },
      },
    },
  });
  if (!thread) return { error: "Thread not found." };
  const guardianUserIds = thread.student.guardians
    .map((g) => g.guardian.userId)
    .filter((id): id is string => id != null);
  const isParticipant =
    userId === thread.teacherUserId || guardianUserIds.includes(userId);
  if (!isParticipant) return { error: "You are not a participant of this thread." };

  const key = buildAttachmentKey({
    schoolId: ctx.schoolId,
    threadId: input.threadId,
    filename: input.filename,
  });

  const url = await getSignedUploadUrl({
    key,
    contentType: input.mimeType,
    expiresInSeconds: 300,
  });

  return { data: { uploadUrl: url, attachmentKey: key } };
}

export async function getMessageAttachmentUrlAction(messageId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const hasPortalUse = !assertPermission(ctx.session, PERMISSIONS.MESSAGING_PORTAL_USE);
  const hasAdminRead = !assertPermission(ctx.session, PERMISSIONS.MESSAGING_ADMIN_READ);
  if (!hasPortalUse && !hasAdminRead) return { error: "Insufficient permissions" };

  const userId = ctx.session.user.id!;

  const message = await db.message.findFirst({
    where: { id: messageId, thread: { schoolId: ctx.schoolId } },
    include: {
      thread: {
        include: {
          student: {
            select: { guardians: { select: { guardian: { select: { userId: true } } } } },
          },
        },
      },
    },
  });
  if (!message) return { error: "Message not found." };
  if (!message.attachmentKey) return { error: "Message has no attachment." };

  if (!hasAdminRead) {
    const guardianUserIds = message.thread.student.guardians
      .map((g) => g.guardian.userId)
      .filter((id): id is string => id != null);
    const isParticipant =
      userId === message.thread.teacherUserId || guardianUserIds.includes(userId);
    if (!isParticipant) return { error: "You are not a participant of this thread." };
  }

  const url = await getSignedDownloadUrl(message.attachmentKey, 300);
  return {
    data: {
      url,
      filename: message.attachmentName ?? "attachment",
      mimeType: message.attachmentMime ?? "application/octet-stream",
      size: message.attachmentSize ?? 0,
    },
  };
}
