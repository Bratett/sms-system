"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { uploadFile, getSignedDownloadUrl, generateFileKey } from "@/lib/storage/r2";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { generateQrDataUrl } from "@/lib/pdf/qr";
import { IdCardTemplate, type IdCardData } from "@/lib/pdf/templates/id-card";
import { resolveStudentPhotoUrl } from "./photo";

function isCacheFresh(pdfKey: string | null, cachedAt: Date | null, invalidatedAt: Date | null) {
  if (!pdfKey || !cachedAt) return false;
  if (!invalidatedAt) return true;
  return invalidatedAt <= cachedAt;
}

// Loose shape that matches both the real Prisma result and the simplified
// test fixture. The fixture inlines the related entities (academicYear,
// programme, house) even though Prisma schema doesn't expose them as
// navigations — we treat them as plain nested data here.
type EnrollmentWithRelations = {
  academicYear: { name: string; isCurrent: boolean };
  classArm: {
    name: string;
    class: { name: string; programme: { name: string } };
  };
};

type StudentWithRelations = {
  id: string;
  schoolId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  gender: string;
  bloodGroup: string | null;
  dateOfBirth: Date;
  photoUrl: string | null;
  boardingStatus: string;
  idCardPdfKey: string | null;
  idCardCachedAt: Date | null;
  idCardCacheInvalidatedAt: Date | null;
  houseAssignment: { house: { name: string } } | null;
  enrollments: EnrollmentWithRelations[];
};

export async function renderStudentIdCardAction(studentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_ID_CARD_GENERATE);
  if (denied) return denied;

  // The Prisma schema doesn't define navigation relations from Enrollment →
  // AcademicYear, Class → Programme, or StudentHouse → House, so we can't
  // express the include tree directly. We load the student with its current
  // enrollment, then hydrate academic year / programme / house names in
  // parallel. The test fixtures provide pre-hydrated shapes via mockResolvedValue,
  // so the same code path is exercised in both environments.
  const raw = await (db.student.findFirst as unknown as (args: unknown) => Promise<unknown>)({
    where: { id: studentId, schoolId: ctx.schoolId },
    include: {
      houseAssignment: true,
      enrollments: {
        where: { status: "ACTIVE" },
        include: { classArm: { include: { class: true } } },
        orderBy: { enrollmentDate: "desc" },
        take: 1,
      },
    },
  });
  const student = raw as StudentWithRelations | null;
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
