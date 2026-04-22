"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { uploadFile, getSignedDownloadUrl, generateFileKey } from "@/lib/storage/r2";
import { renderPdfToBuffer, PDF_SYNC_THRESHOLD } from "@/lib/pdf/generator";
import { generateQrDataUrl } from "@/lib/pdf/qr";
import { IdCardTemplate, type IdCardData } from "@/lib/pdf/templates/id-card";
import { enqueuePdfJob } from "@/modules/common/pdf-job-dispatcher";
import { stitchPdfsFromUrls } from "@/lib/pdf/stitch";
import { resolveStudentPhotoUrl } from "./photo";

function isCacheFresh(pdfKey: string | null, cachedAt: Date | null, invalidatedAt: Date | null) {
  if (!pdfKey || !cachedAt) return false;
  if (!invalidatedAt) return true;
  return invalidatedAt <= cachedAt;
}

export async function renderStudentIdCardAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_ID_CARD_GENERATE);
  if (denied) return denied;

  const student = await db.student.findFirst({
    where: { id: studentId, schoolId: ctx.schoolId },
    include: {
      houseAssignment: { include: { house: true } },
      enrollments: {
        where: { status: "ACTIVE" },
        include: {
          academicYear: true,
          classArm: { include: { class: { include: { programme: true } } } },
        },
        orderBy: { enrollmentDate: "desc" },
        take: 1,
      },
    },
  });
  if (!student) return { error: "Student not found" };
  if (student.enrollments.length === 0) return { error: "Student has no active enrollment" };

  if (isCacheFresh(student.idCardPdfKey, student.idCardCachedAt, student.idCardCacheInvalidatedAt)) {
    const url = await getSignedDownloadUrl(student.idCardPdfKey!);
    return { data: { url, cached: true } };
  }

  const school = await db.school.findUnique({ where: { id: ctx.schoolId } });
  if (!school) return { error: "School not found" };

  const photoUrl = await resolveStudentPhotoUrl(studentId);
  const qrDataUrl = await generateQrDataUrl(student.studentId);

  const enrollment = student.enrollments[0]!;
  const data: IdCardData = {
    school: {
      name: school.name,
      motto: school.motto,
      logoUrl: school.logoUrl,
      address: school.address,
      phone: school.phone,
      email: school.email,
    },
    student: {
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      otherNames: student.otherNames,
      photoUrl,
      gender: student.gender,
      bloodGroup: student.bloodGroup,
      dateOfBirth: student.dateOfBirth,
    },
    enrollment: {
      className: enrollment.classArm.class.name,
      classArmName: enrollment.classArm.name,
      programmeName: enrollment.classArm.class.programme.name,
      academicYearName: enrollment.academicYear.name,
    },
    boardingStatus: student.boardingStatus,
    house: student.houseAssignment?.house.name ?? null,
    qrDataUrl,
    issuedAt: new Date(),
  };

  const buffer = await renderPdfToBuffer(IdCardTemplate({ data }));
  const initialKey = generateFileKey("student-id-cards", studentId, `id-card-${Date.now()}.pdf`);
  const uploaded = await uploadFile(initialKey, buffer, "application/pdf");
  const key = uploaded.key;

  const now = new Date();
  await db.student.update({
    where: { id: studentId },
    data: {
      idCardPdfKey: key,
      idCardCachedAt: now,
      idCardCacheInvalidatedAt: null,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "StudentIdCard",
    entityId: studentId,
    module: "students",
    description: `Generated ID card for student ${student.studentId}`,
    metadata: { fileKey: key },
  });

  const url = await getSignedDownloadUrl(key);
  return { data: { url, cached: false } };
}

export async function renderClassIdCardsAction(input: { classArmId: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_ID_CARD_GENERATE);
  if (denied) return denied;

  const enrollments = await db.enrollment.findMany({
    where: { classArmId: input.classArmId, status: "ACTIVE" },
    select: { studentId: true },
  });
  if (enrollments.length === 0) return { error: "No active students in this class arm" };

  if (enrollments.length > PDF_SYNC_THRESHOLD) {
    const jobId = await enqueuePdfJob({
      schoolId: ctx.schoolId,
      kind: "ID_CARD_BATCH",
      params: { classArmId: input.classArmId },
      totalItems: enrollments.length,
      requestedBy: ctx.session.user.id!,
    });
    return { data: { jobId, queued: true } };
  }

  const urls: string[] = [];
  for (const e of enrollments) {
    const res = await renderStudentIdCardAction(e.studentId);
    if ("data" in res) urls.push(res.data.url);
  }
  const buffer = await stitchPdfsFromUrls(urls);
  const initialKey = generateFileKey("id-card-batches", input.classArmId, `batch-${Date.now()}.pdf`);
  const uploaded = await uploadFile(initialKey, buffer, "application/pdf");
  const url = await getSignedDownloadUrl(uploaded.key);

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "IdCardBatch",
    entityId: input.classArmId,
    module: "students",
    description: `Generated ${enrollments.length} ID cards inline`,
    metadata: { fileKey: uploaded.key },
  });

  return { data: { url, queued: false } };
}
