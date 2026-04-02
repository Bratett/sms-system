"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  createApplicationSchema,
  reviewApplicationSchema,
  applicationFilterSchema,
  type CreateApplicationInput,
  type ReviewApplicationInput,
  type ApplicationFilterInput,
} from "@/modules/admissions/schemas/admission.schema";
import type { AdmissionStats } from "@/modules/admissions/types";

export async function getApplicationsAction(filters: ApplicationFilterInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_READ);
  if (denied) return denied;

  const parsed = applicationFilterSchema.safeParse(filters);
  if (!parsed.success) {
    return { error: "Invalid filters" };
  }

  const { search, status, academicYearId, page, pageSize } = parsed.data;

  const where: Record<string, unknown> = {
    schoolId: ctx.schoolId,
  };

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { applicationNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (academicYearId) {
    where.academicYearId = academicYearId;
  }

  const [applications, total] = await Promise.all([
    db.admissionApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.admissionApplication.count({ where }),
  ]);

  // Fetch programme names for preferences
  const programmeIds = [
    ...new Set(
      applications
        .flatMap((a) => [a.programmePreference1Id, a.programmePreference2Id])
        .filter(Boolean) as string[]
    ),
  ];

  const programmes =
    programmeIds.length > 0
      ? await db.programme.findMany({
          where: { id: { in: programmeIds } },
          select: { id: true, name: true },
        })
      : [];

  const programmeMap = new Map(programmes.map((p) => [p.id, p.name]));

  const data = applications.map((app) => ({
    ...app,
    programmePreference1Name: app.programmePreference1Id
      ? programmeMap.get(app.programmePreference1Id) ?? null
      : null,
    programmePreference2Name: app.programmePreference2Id
      ? programmeMap.get(app.programmePreference2Id) ?? null
      : null,
  }));

  return { data: { applications: data, total, page, pageSize } };
}

export async function getApplicationAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const application = await db.admissionApplication.findUnique({
    where: { id },
    include: {
      documents: {
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  if (!application) {
    return { error: "Application not found" };
  }

  // Fetch programme names
  const programmeIds = [
    application.programmePreference1Id,
    application.programmePreference2Id,
  ].filter(Boolean) as string[];

  const programmes =
    programmeIds.length > 0
      ? await db.programme.findMany({
          where: { id: { in: programmeIds } },
          select: { id: true, name: true },
        })
      : [];

  const programmeMap = new Map(programmes.map((p) => [p.id, p.name]));

  const data = {
    ...application,
    programmePreference1Name: application.programmePreference1Id
      ? programmeMap.get(application.programmePreference1Id) ?? null
      : null,
    programmePreference2Name: application.programmePreference2Id
      ? programmeMap.get(application.programmePreference2Id) ?? null
      : null,
  };

  return { data };
}

export async function createApplicationAction(input: CreateApplicationInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_CREATE);
  if (denied) return denied;

  const parsed = createApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  // Get current academic year
  const academicYear = await db.academicYear.findFirst({
    where: { isCurrent: true },
  });

  if (!academicYear) {
    return { error: "No active academic year. Please set a current academic year first." };
  }

  // Generate application number
  const year = new Date().getFullYear();
  const count = await db.admissionApplication.count({
    where: { schoolId: ctx.schoolId },
  });
  const applicationNumber = `APP/${year}/${String(count + 1).padStart(4, "0")}`;

  const data = parsed.data;

  const application = await db.admissionApplication.create({
    data: {
      schoolId: ctx.schoolId,
      academicYearId: academicYear.id,
      applicationNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      otherNames: data.otherNames || null,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender,
      previousSchool: data.previousSchool || null,
      jhsIndexNumber: data.jhsIndexNumber || null,
      jhsAggregate: data.jhsAggregate ?? null,
      programmePreference1Id: data.programmePreference1Id || null,
      programmePreference2Id: data.programmePreference2Id || null,
      guardianName: data.guardianName,
      guardianPhone: data.guardianPhone,
      guardianEmail: data.guardianEmail || null,
      guardianRelationship: data.guardianRelationship || null,
      guardianAddress: data.guardianAddress || null,
      guardianOccupation: data.guardianOccupation || null,
      boardingStatus: data.boardingStatus,
      applicationType: "STANDARD",
      applicationSource: "STAFF",
      notes: data.notes || null,
      status: "SUBMITTED",
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "AdmissionApplication",
    entityId: application.id,
    module: "admissions",
    description: `Created admission application ${applicationNumber} for ${data.firstName} ${data.lastName}`,
    newData: application,
  });

  return { data: application };
}

export async function updateApplicationAction(
  id: string,
  input: CreateApplicationInput
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const parsed = createApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.admissionApplication.findUnique({
    where: { id },
  });

  if (!existing) {
    return { error: "Application not found" };
  }

  if (existing.status !== "DRAFT" && existing.status !== "SUBMITTED") {
    return { error: "Application can only be updated when in DRAFT or SUBMITTED status." };
  }

  const previousData = { ...existing };
  const data = parsed.data;

  const updated = await db.admissionApplication.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      otherNames: data.otherNames || null,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender,
      previousSchool: data.previousSchool || null,
      jhsIndexNumber: data.jhsIndexNumber || null,
      jhsAggregate: data.jhsAggregate ?? null,
      programmePreference1Id: data.programmePreference1Id || null,
      programmePreference2Id: data.programmePreference2Id || null,
      guardianName: data.guardianName,
      guardianPhone: data.guardianPhone,
      guardianEmail: data.guardianEmail || null,
      guardianRelationship: data.guardianRelationship || null,
      guardianAddress: data.guardianAddress || null,
      guardianOccupation: data.guardianOccupation || null,
      boardingStatus: data.boardingStatus,
      notes: data.notes || null,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "AdmissionApplication",
    entityId: id,
    module: "admissions",
    description: `Updated admission application ${existing.applicationNumber}`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function reviewApplicationAction(
  id: string,
  decision: ReviewApplicationInput
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_APPROVE);
  if (denied) return denied;

  const parsed = reviewApplicationSchema.safeParse(decision);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.admissionApplication.findUnique({
    where: { id },
  });

  if (!existing) {
    return { error: "Application not found" };
  }

  const previousData = { ...existing };

  const updated = await db.admissionApplication.update({
    where: { id },
    data: {
      status: parsed.data.status,
      notes: parsed.data.notes || existing.notes,
      reviewedBy: ctx.session.user.id,
      reviewedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "AdmissionApplication",
    entityId: id,
    module: "admissions",
    description: `Reviewed admission application ${existing.applicationNumber} - Status: ${parsed.data.status}`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function enrollApplicationAction(id: string, classArmId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const application = await db.admissionApplication.findUnique({
    where: { id },
  });

  if (!application) {
    return { error: "Application not found" };
  }

  if (application.status !== "ACCEPTED") {
    return { error: "Only accepted applications can be enrolled." };
  }

  // Get current academic year
  const academicYear = await db.academicYear.findFirst({
    where: { isCurrent: true },
  });

  if (!academicYear) {
    return { error: "No active academic year." };
  }

  // Verify class arm exists
  const classArm = await db.classArm.findUnique({
    where: { id: classArmId },
    include: { class: true },
  });

  if (!classArm) {
    return { error: "Class arm not found." };
  }

  // Generate student ID
  const year = new Date().getFullYear();
  const studentCount = await db.student.count({
    where: { schoolId: ctx.schoolId },
  });
  const studentId = `STU/${year}/${String(studentCount + 1).padStart(4, "0")}`;

  // Create student, guardian, enrollment in a transaction
  const result = await db.$transaction(async (tx) => {
    // 1. Create Student record
    const student = await tx.student.create({
      data: {
        schoolId: ctx.schoolId,
        studentId,
        firstName: application.firstName,
        lastName: application.lastName,
        otherNames: application.otherNames,
        dateOfBirth: application.dateOfBirth,
        gender: application.gender,
        boardingStatus: application.boardingStatus,
        status: "ACTIVE",
      },
    });

    // 2. Create Guardian record
    const nameParts = application.guardianName.trim().split(/\s+/);
    const guardianFirstName = nameParts[0] || application.guardianName;
    const guardianLastName = nameParts.slice(1).join(" ") || application.guardianName;

    const guardian = await tx.guardian.create({
      data: {
        schoolId: ctx.schoolId,
        firstName: guardianFirstName,
        lastName: guardianLastName,
        phone: application.guardianPhone,
        email: application.guardianEmail,
        occupation: application.guardianOccupation,
        address: application.guardianAddress,
        relationship: application.guardianRelationship,
      },
    });

    // 3. Link guardian to student (isPrimary = true)
    await tx.studentGuardian.create({
      data: {
        schoolId: ctx.schoolId,
        studentId: student.id,
        guardianId: guardian.id,
        isPrimary: true,
      },
    });

    // 4. Create Enrollment record
    const enrollment = await tx.enrollment.create({
      data: {
        schoolId: ctx.schoolId,
        studentId: student.id,
        classArmId,
        academicYearId: academicYear.id,
        status: "ACTIVE",
      },
    });

    // 5. Update application status to ENROLLED
    const updatedApplication = await tx.admissionApplication.update({
      where: { id },
      data: {
        status: "ENROLLED",
        enrolledStudentId: student.id,
      },
    });

    return { student, guardian, enrollment, updatedApplication };
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "Student",
    entityId: result.student.id,
    module: "admissions",
    description: `Enrolled student ${studentId} from admission application ${application.applicationNumber}`,
    newData: {
      student: result.student,
      guardian: result.guardian,
      enrollment: result.enrollment,
    },
  });

  return { data: result.student };
}

export async function deleteApplicationAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const application = await db.admissionApplication.findUnique({
    where: { id },
  });

  if (!application) {
    return { error: "Application not found" };
  }

  if (application.status !== "DRAFT") {
    return { error: "Only draft applications can be deleted." };
  }

  await db.admissionApplication.delete({
    where: { id },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "DELETE",
    entity: "AdmissionApplication",
    entityId: id,
    module: "admissions",
    description: `Deleted admission application ${application.applicationNumber}`,
    previousData: application,
  });

  return { success: true };
}

export async function getAdmissionStatsAction(academicYearId?: string): Promise<{
  data?: AdmissionStats;
  error?: string;
}> {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = {
    schoolId: ctx.schoolId,
  };

  if (academicYearId) {
    where.academicYearId = academicYearId;
  }

  const [total, submitted, underReview, shortlisted, accepted, rejected, enrolled, draft] =
    await Promise.all([
      db.admissionApplication.count({ where }),
      db.admissionApplication.count({ where: { ...where, status: "SUBMITTED" } }),
      db.admissionApplication.count({ where: { ...where, status: "UNDER_REVIEW" } }),
      db.admissionApplication.count({ where: { ...where, status: "SHORTLISTED" } }),
      db.admissionApplication.count({ where: { ...where, status: "ACCEPTED" } }),
      db.admissionApplication.count({ where: { ...where, status: "REJECTED" } }),
      db.admissionApplication.count({ where: { ...where, status: "ENROLLED" } }),
      db.admissionApplication.count({ where: { ...where, status: "DRAFT" } }),
    ]);

  return {
    data: {
      total,
      submitted,
      underReview,
      shortlisted,
      accepted,
      rejected,
      enrolled,
      draft,
    },
  };
}
