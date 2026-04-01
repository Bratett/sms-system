"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  createFinancialAidApplicationSchema,
  reviewFinancialAidSchema,
  type CreateFinancialAidApplicationInput,
  type ReviewFinancialAidInput,
} from "@/modules/finance/schemas/financial-aid.schema";

export async function getFinancialAidApplicationsAction(filters?: {
  status?: string;
  academicYearId?: string;
  aidType?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: school.id };
  if (filters?.status) where.status = filters.status;
  if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters?.aidType) where.aidType = filters.aidType;

  const [applications, total] = await Promise.all([
    db.financialAidApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.financialAidApplication.count({ where }),
  ]);

  // Resolve student, user, term, and academic year info
  const studentIds = [...new Set(applications.map((a) => a.studentId))];
  const userIds = [
    ...new Set([
      ...applications.map((a) => a.submittedBy),
      ...applications.map((a) => a.reviewedBy).filter(Boolean) as string[],
    ]),
  ];
  const termIds = [...new Set(applications.map((a) => a.termId))];
  const ayIds = [...new Set(applications.map((a) => a.academicYearId))];

  const [students, users, terms, academicYears] = await Promise.all([
    db.student.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        enrollments: {
          where: { status: "ACTIVE" },
          include: { classArm: { include: { class: { select: { name: true } } } } },
          take: 1,
        },
      },
    }),
    db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.term.findMany({
      where: { id: { in: termIds } },
      select: { id: true, name: true },
    }),
    db.academicYear.findMany({
      where: { id: { in: ayIds } },
      select: { id: true, name: true },
    }),
  ]);

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  const termMap = new Map(terms.map((t) => [t.id, t.name]));
  const ayMap = new Map(academicYears.map((ay) => [ay.id, ay.name]));

  const data = applications.map((app) => {
    const student = studentMap.get(app.studentId);
    const enrollment = student?.enrollments[0];
    return {
      ...app,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
      studentIdNumber: student?.studentId ?? "Unknown",
      className: enrollment
        ? `${enrollment.classArm.class.name} ${enrollment.classArm.name}`
        : "N/A",
      termName: termMap.get(app.termId) ?? "Unknown",
      academicYearName: ayMap.get(app.academicYearId) ?? "Unknown",
      submittedByName: userMap.get(app.submittedBy) ?? "Unknown",
      reviewedByName: app.reviewedBy ? userMap.get(app.reviewedBy) ?? null : null,
    };
  });

  return {
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function createFinancialAidApplicationAction(data: CreateFinancialAidApplicationInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createFinancialAidApplicationSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  // Verify student exists
  const student = await db.student.findUnique({
    where: { id: parsed.data.studentId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!student) return { error: "Student not found" };

  // Check for duplicate application
  const existing = await db.financialAidApplication.findFirst({
    where: {
      schoolId: school.id,
      studentId: parsed.data.studentId,
      academicYearId: parsed.data.academicYearId,
      termId: parsed.data.termId,
      status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
    },
  });
  if (existing) {
    return { error: "An active financial aid application already exists for this student and term" };
  }

  const application = await db.financialAidApplication.create({
    data: {
      schoolId: school.id,
      studentId: parsed.data.studentId,
      academicYearId: parsed.data.academicYearId,
      termId: parsed.data.termId,
      aidType: parsed.data.aidType,
      requestedAmount: parsed.data.requestedAmount,
      reason: parsed.data.reason,
      householdIncome: parsed.data.householdIncome,
      numberOfDependents: parsed.data.numberOfDependents,
      supportingDocs: parsed.data.supportingDocs ?? [],
      submittedBy: session.user.id!,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "FinancialAidApplication",
    entityId: application.id,
    module: "finance",
    description: `Created ${parsed.data.aidType} financial aid application for ${student.firstName} ${student.lastName} (GHS ${parsed.data.requestedAmount})`,
  });

  return { data: application };
}

export async function reviewFinancialAidAction(data: ReviewFinancialAidInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = reviewFinancialAidSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const application = await db.financialAidApplication.findUnique({
    where: { id: parsed.data.applicationId },
  });
  if (!application) return { error: "Application not found" };
  if (application.status !== "SUBMITTED" && application.status !== "UNDER_REVIEW") {
    return { error: "Only submitted or under-review applications can be reviewed" };
  }

  const updated = await db.financialAidApplication.update({
    where: { id: parsed.data.applicationId },
    data: {
      status: parsed.data.status,
      approvedAmount: parsed.data.status === "APPROVED" ? parsed.data.approvedAmount : null,
      reviewedBy: session.user.id!,
      reviewedAt: new Date(),
      reviewNotes: parsed.data.reviewNotes,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "FinancialAidApplication",
    entityId: parsed.data.applicationId,
    module: "finance",
    description: `${parsed.data.status} financial aid application (${parsed.data.status === "APPROVED" ? `GHS ${parsed.data.approvedAmount}` : "rejected"})`,
  });

  return { data: updated };
}

export async function markUnderReviewAction(applicationId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const application = await db.financialAidApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) return { error: "Application not found" };
  if (application.status !== "SUBMITTED") {
    return { error: "Only submitted applications can be marked as under review" };
  }

  await db.financialAidApplication.update({
    where: { id: applicationId },
    data: { status: "UNDER_REVIEW" },
  });

  return { data: { success: true } };
}

export async function getFinancialAidSummaryAction(academicYearId?: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const where: Record<string, unknown> = { schoolId: school.id };
  if (academicYearId) where.academicYearId = academicYearId;

  const applications = await db.financialAidApplication.findMany({ where });

  const totalRequested = applications.reduce((sum, a) => sum + a.requestedAmount, 0);
  const approved = applications.filter((a) => a.status === "APPROVED" || a.status === "DISBURSED");
  const totalApproved = approved.reduce((sum, a) => sum + (a.approvedAmount ?? 0), 0);

  const byType = new Map<string, { type: string; count: number; requested: number; approved: number }>();
  for (const app of applications) {
    const entry = byType.get(app.aidType) ?? { type: app.aidType, count: 0, requested: 0, approved: 0 };
    entry.count++;
    entry.requested += app.requestedAmount;
    if (app.status === "APPROVED" || app.status === "DISBURSED") {
      entry.approved += app.approvedAmount ?? 0;
    }
    byType.set(app.aidType, entry);
  }

  const byStatus = new Map<string, number>();
  for (const app of applications) {
    byStatus.set(app.status, (byStatus.get(app.status) ?? 0) + 1);
  }

  return {
    data: {
      totalApplications: applications.length,
      totalRequested,
      totalApproved,
      approvalRate: applications.length > 0
        ? (approved.length / applications.length) * 100
        : 0,
      byType: Array.from(byType.values()),
      byStatus: Object.fromEntries(byStatus),
    },
  };
}
