"use server";

import sharp from "sharp";
import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  getObject,
  uploadFile,
  deleteFile,
  getSignedDownloadUrl,
} from "@/lib/storage/r2";

interface SetPhotoInput {
  studentId: string;
  fileKey: string; // temporary R2 key from /api/upload
}

interface RemovePhotoInput {
  studentId: string;
}

/**
 * Pulls the temp upload from R2, resizes to 800x800 JPEG (q85) via sharp,
 * writes to a stable per-student key, updates Student.photoUrl to that key,
 * deletes the temp upload, and audits.
 */
export async function setStudentPhotoAction(input: SetPhotoInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_UPDATE);
  if (denied) return denied;

  const student = await db.student.findFirst({
    where: { id: input.studentId, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (!student) return { error: "Student not found" };

  let resized: Buffer;
  try {
    const sourceBuffer = await getObject(input.fileKey);
    resized = await sharp(sourceBuffer)
      .rotate() // honor EXIF orientation
      .resize({ width: 800, height: 800, fit: "cover", position: "centre" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    // Best-effort cleanup of the temp upload before returning
    await deleteFile(input.fileKey).catch(() => {});
    console.error("[setStudentPhotoAction] sharp failed:", err);
    return { error: "Could not process image" };
  }

  const stableKey = `students/${input.studentId}/photo.jpg`;
  await uploadFile({
    key: stableKey,
    body: resized,
    contentType: "image/jpeg",
  });

  await db.student.update({
    where: { id: input.studentId },
    data: { photoUrl: stableKey },
  });

  // Best-effort cleanup of the temp upload (don't block on failure)
  await deleteFile(input.fileKey).catch((err) => {
    console.error("[setStudentPhotoAction] failed to delete temp upload:", err);
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Student",
    entityId: input.studentId,
    module: "student",
    description: "Updated student photo",
  });

  // Return a freshly signed URL so the client can refresh the avatar immediately
  const photoSrc = await getSignedDownloadUrl(stableKey);
  return { data: { photoKey: stableKey, photoSrc } };
}

/**
 * Clears Student.photoUrl. If the stored value is an R2 key (no scheme), also
 * deletes the R2 object. Legacy URL values are nulled but not deleted (we don't
 * own external URLs).
 */
export async function removeStudentPhotoAction(input: RemovePhotoInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_UPDATE);
  if (denied) return denied;

  const student = await db.student.findFirst({
    where: { id: input.studentId, schoolId: ctx.schoolId },
    select: { id: true, photoUrl: true },
  });
  if (!student) return { error: "Student not found" };

  if (student.photoUrl == null) {
    return { data: { ok: true } };
  }

  const isKey = !student.photoUrl.startsWith("http");

  if (isKey) {
    await deleteFile(student.photoUrl).catch((err) => {
      console.error("[removeStudentPhotoAction] failed to delete R2 object:", err);
    });
  }

  await db.student.update({
    where: { id: input.studentId },
    data: { photoUrl: null },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "Student",
    entityId: input.studentId,
    module: "student",
    description: "Removed student photo",
  });

  return { data: { ok: true } };
}
