"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PLACEHOLDER_PHOTO_SENTINEL } from "@/lib/pdf/constants";
import { getSignedDownloadUrl } from "@/lib/storage/r2";

/**
 * Resolves a student's photo URL with fallback chain:
 * 1. Student.photoUrl (direct)
 * 2. Most recent VERIFIED StudentDocument with documentType.name = "Passport Photo"
 * 3. PLACEHOLDER_PHOTO_SENTINEL (caller loads bundled asset)
 *
 * This function is normally called internally by `renderStudentIdCardAction`,
 * which already school-scopes its lookup. But because this is a `"use server"`
 * export, direct invocation from a browser could otherwise bypass that gate —
 * so we re-assert the school context here and filter by schoolId.
 */
export async function resolveStudentPhotoUrl(studentId: string): Promise<string> {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return PLACEHOLDER_PHOTO_SENTINEL;

  const student = await db.student.findFirst({
    where: { id: studentId, schoolId: ctx.schoolId },
    select: { id: true, schoolId: true, photoUrl: true },
  });
  if (!student) return PLACEHOLDER_PHOTO_SENTINEL;
  if (student.photoUrl) return student.photoUrl;

  const doc = await db.studentDocument.findFirst({
    where: {
      studentId,
      schoolId: ctx.schoolId,
      verificationStatus: "VERIFIED",
      documentType: { name: "Passport Photo" },
    },
    orderBy: { uploadedAt: "desc" },
    select: { fileKey: true },
  });
  if (!doc) return PLACEHOLDER_PHOTO_SENTINEL;

  return await getSignedDownloadUrl(doc.fileKey);
}
