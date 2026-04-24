"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { getSignedDownloadUrl, getSignedUploadUrl } from "@/lib/storage/r2";
import {
  validateAttachment,
  buildAttachmentKey,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "@/modules/messaging/attachments";

type Kind = "excuse" | "medical";

// ─── Request Upload URL ────────────────────────────────────────────

export async function getParentRequestAttachmentUploadUrlAction(input: {
  kind: Kind;
  filename: string;
  mimeType: string;
  size: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const perm =
    input.kind === "excuse"
      ? PERMISSIONS.EXCUSE_SUBMIT
      : PERMISSIONS.MEDICAL_DISCLOSURE_SUBMIT;
  const denied = assertPermission(ctx.session, perm);
  if (denied) return denied;

  const validation = validateAttachment({
    mimeType: input.mimeType,
    size: input.size,
  });
  if (!validation.ok) return { error: validation.error };

  // `kind` occupies the "threadId" slot so keys look like:
  // parent-requests/<schoolId>/excuse/<uuid>-<name>
  const key = buildAttachmentKey({
    schoolId: ctx.schoolId,
    threadId: input.kind,
    filename: input.filename,
    prefix: "parent-requests",
  });

  const uploadUrl = await getSignedUploadUrl({
    key,
    contentType: input.mimeType,
    expiresInSeconds: 300,
    maxSizeBytes: MAX_ATTACHMENT_SIZE_BYTES,
  });

  return { data: { uploadUrl, attachmentKey: key } };
}

// ─── Request Download URL ──────────────────────────────────────────

export async function getParentRequestAttachmentUrlAction(input: {
  kind: Kind;
  requestId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const userId = ctx.session.user.id!;

  if (input.kind === "excuse") {
    const req = await db.excuseRequest.findFirst({
      where: { id: input.requestId, schoolId: ctx.schoolId },
    });
    if (!req) return { error: "Request not found." };
    if (!req.attachmentKey) return { error: "No attachment." };

    const isSubmitter = req.submittedByUserId === userId;
    const hasReview = !assertPermission(ctx.session, PERMISSIONS.EXCUSE_REVIEW);
    if (!isSubmitter && !hasReview) return { error: "Request not found." };

    const url = await getSignedDownloadUrl(req.attachmentKey, 300);
    return {
      data: {
        url,
        filename: req.attachmentName ?? "attachment",
        mimeType: req.attachmentMime ?? "application/octet-stream",
        size: req.attachmentSize ?? 0,
      },
    };
  }

  const row = await db.medicalDisclosure.findFirst({
    where: { id: input.requestId, schoolId: ctx.schoolId },
  });
  if (!row) return { error: "Disclosure not found." };
  if (!row.attachmentKey) return { error: "No attachment." };

  const isSubmitter = row.submittedByUserId === userId;
  const hasReview = !assertPermission(ctx.session, PERMISSIONS.MEDICAL_DISCLOSURE_REVIEW);
  if (!isSubmitter && !hasReview) return { error: "Disclosure not found." };

  const url = await getSignedDownloadUrl(row.attachmentKey, 300);
  return {
    data: {
      url,
      filename: row.attachmentName ?? "attachment",
      mimeType: row.attachmentMime ?? "application/octet-stream",
      size: row.attachmentSize ?? 0,
    },
  };
}
