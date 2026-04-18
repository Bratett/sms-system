"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { transitionWorkflowWithAutoStart } from "@/lib/workflow/engine";
import {
  ADMISSION_WORKFLOW_KEY,
  ADMISSION_EVENTS,
} from "@/lib/workflow/definitions/admission";
import {
  createApplicationSchema,
  reviewApplicationSchema,
  applicationFilterSchema,
  decideApplicationSchema,
  verifyPlacementSchema,
  type CreateApplicationInput,
  type ReviewApplicationInput,
  type ApplicationFilterInput,
  type DecideApplicationInput,
  type VerifyPlacementInput,
} from "@/modules/admissions/schemas/admission.schema";
import type { AdmissionStats } from "@/modules/admissions/types";
import { issueOfferInTx } from "@/modules/admissions/actions/offer.action";
import {
  resolveDecisionAuthority,
  type DecisionType,
} from "@/modules/admissions/services/decision-authority.service";
import {
  validatePlacement,
  shouldAutoAdmitPlacementStudent,
} from "@/modules/admissions/services/placement-validation.service";
import {
  checkAcademicYearCapacity,
  checkBoardingCapacity,
} from "@/modules/admissions/services/capacity.service";
import { getSignedDownloadUrl } from "@/lib/storage/r2";

const ADMISSION_ENTITY = "AdmissionApplication";

function workflowEventForDecision(decision: DecisionType): string {
  switch (decision) {
    case "ACCEPTED":
      return ADMISSION_EVENTS.DECIDE_ACCEPT;
    case "CONDITIONAL_ACCEPT":
      return ADMISSION_EVENTS.DECIDE_CONDITIONAL;
    case "WAITLISTED":
      return ADMISSION_EVENTS.DECIDE_WAITLIST;
    case "REJECTED":
      return ADMISSION_EVENTS.DECIDE_REJECT;
  }
}

function notificationEventForDecision(decision: DecisionType) {
  switch (decision) {
    case "ACCEPTED":
      return NOTIFICATION_EVENTS.ADMISSION_ACCEPTED;
    case "CONDITIONAL_ACCEPT":
      return NOTIFICATION_EVENTS.ADMISSION_CONDITIONAL;
    case "WAITLISTED":
      return NOTIFICATION_EVENTS.ADMISSION_WAITLISTED;
    case "REJECTED":
      return NOTIFICATION_EVENTS.ADMISSION_REJECTED;
  }
}

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

  // Pre-sign R2 download URLs for documents. Failures are non-fatal — the UI
  // treats a missing downloadUrl as "not available".
  const documentsWithUrls = await Promise.all(
    application.documents.map(async (doc) => {
      let downloadUrl: string | undefined;
      try {
        downloadUrl = await getSignedDownloadUrl(doc.fileKey);
      } catch (err) {
        console.error(
          `[admissions] signed-URL failed for doc ${doc.id}:`,
          (err as Error).message,
        );
      }
      return { ...doc, downloadUrl };
    }),
  );

  const data = {
    ...application,
    documents: documentsWithUrls,
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

/**
 * Record an admission decision. Replaces the free-form `reviewApplicationAction`
 * with full authority-matrix enforcement, decision history (`AdmissionDecision`),
 * optional conditions (for CONDITIONAL_ACCEPT), automatic offer issuance for
 * ACCEPTED outcomes, and workflow-engine transitioning.
 */
export async function decideApplicationAction(
  id: string,
  input: DecideApplicationInput,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const parsed = decideApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.admissionApplication.findUnique({
    where: { id },
    include: {
      interviews: { orderBy: { recordedAt: "desc" }, take: 1 },
    },
  });
  if (!existing || existing.schoolId !== ctx.schoolId) {
    return { error: "Application not found" };
  }
  if (existing.status === "ENROLLED" || existing.status === "CANCELLED") {
    return { error: "Decision cannot be changed once the application is enrolled or cancelled." };
  }

  const latestInterview = existing.interviews[0];
  const score = latestInterview?.totalScore ? Number(latestInterview.totalScore) : null;

  const authority = resolveDecisionAuthority({
    decision: parsed.data.decision,
    score,
    isPlacementStudent: existing.applicationType === "PLACEMENT",
    beceAggregate: existing.jhsAggregate,
  });

  if (authority.requiredPermission) {
    const denied = assertPermission(ctx.session, authority.requiredPermission);
    if (denied) return denied;
  }

  const decidedBy = authority.autoApproved ? "SYSTEM" : ctx.session.user.id!;
  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const decisionRow = await tx.admissionDecision.create({
      data: {
        applicationId: id,
        schoolId: ctx.schoolId,
        decision: parsed.data.decision,
        decidedBy,
        decidedAt: now,
        reason: parsed.data.reason || authority.reason,
        autoDecision: authority.autoApproved,
      },
    });

    if (parsed.data.decision === "CONDITIONAL_ACCEPT" && parsed.data.conditions) {
      await tx.admissionCondition.createMany({
        data: parsed.data.conditions.map((c) => ({
          decisionId: decisionRow.id,
          type: c.type,
          description: c.description,
          deadline: new Date(c.deadline),
        })),
      });
    }

    const updatedApp = await tx.admissionApplication.update({
      where: { id },
      data: {
        status: parsed.data.decision,
        currentStage: parsed.data.decision,
        decisionReason: parsed.data.reason || authority.reason,
        autoDecision: authority.autoApproved,
        reviewedBy: ctx.session.user.id,
        reviewedAt: now,
      },
    });

    let offerExpiryDate: Date | null = null;
    if (parsed.data.decision === "ACCEPTED") {
      const { expiryDate } = await issueOfferInTx(tx, {
        applicationId: id,
        schoolId: ctx.schoolId,
      });
      offerExpiryDate = expiryDate;
    }

    return { decisionRow, updatedApp, offerExpiryDate };
  });

  // Fire workflow event (outside the $transaction — the engine manages its own).
  try {
    await transitionWorkflowWithAutoStart({
      definitionKey: ADMISSION_WORKFLOW_KEY,
      entityType: ADMISSION_ENTITY,
      event: workflowEventForDecision(parsed.data.decision),
      entity: { id, status: existing.status },
      schoolId: ctx.schoolId,
      actor: {
        // Always use the authenticated staff user for the workflow actor so
        // audit/FK constraints resolve; `AdmissionDecision.decidedBy` keeps
        // the SYSTEM sentinel separately when the decision is auto-approved.
        userId: ctx.session.user.id!,
        role: authority.autoApproved ? "system" : "admissions_officer",
      },
      reason: parsed.data.reason || authority.reason,
    });
  } catch (err) {
    // Decision row is already persisted; log but don't reverse.
    console.error("[admissions] decision workflow transition failed:", err);
  }

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: parsed.data.decision === "REJECTED" ? "REJECT" : "APPROVE",
    entity: "AdmissionApplication",
    entityId: id,
    module: "admissions",
    description: `Decision ${parsed.data.decision} on ${existing.applicationNumber} — ${authority.reason}${authority.autoApproved ? " (auto)" : ""}`,
    previousData: { status: existing.status },
    newData: { status: parsed.data.decision, autoDecision: authority.autoApproved },
  });

  await dispatch({
    event: notificationEventForDecision(parsed.data.decision),
    title: `Admission decision: ${parsed.data.decision}`,
    message: `Application ${existing.applicationNumber} — ${parsed.data.decision}.`,
    recipients: [
      {
        name: existing.guardianName,
        phone: existing.guardianPhone,
        email: existing.guardianEmail ?? undefined,
      },
    ],
    schoolId: ctx.schoolId,
  });

  return {
    data: {
      decisionId: result.decisionRow.id,
      status: result.updatedApp.status,
      autoDecision: authority.autoApproved,
      offerExpiryDate: result.offerExpiryDate,
    },
  };
}

/**
 * Backwards-compat wrapper. The existing `reviewApplicationAction` accepted a
 * looser set of statuses (including UNDER_REVIEW, SHORTLISTED) that aren't real
 * decisions. Pre-decision transitions are now handled by interview/workflow
 * actions; terminal decisions route through `decideApplicationAction`.
 */
export async function reviewApplicationAction(
  id: string,
  decision: ReviewApplicationInput,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const parsed = reviewApplicationSchema.safeParse(decision);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  if (parsed.data.status === "ACCEPTED" || parsed.data.status === "REJECTED") {
    return decideApplicationAction(id, {
      decision: parsed.data.status,
      reason: parsed.data.notes || "",
    });
  }

  // Intermediate states (UNDER_REVIEW, SHORTLISTED) — update status only.
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_APPROVE);
  if (denied) return denied;

  const existing = await db.admissionApplication.findUnique({ where: { id } });
  if (!existing || existing.schoolId !== ctx.schoolId) {
    return { error: "Application not found" };
  }

  const updated = await db.admissionApplication.update({
    where: { id },
    data: {
      status: parsed.data.status,
      currentStage: parsed.data.status,
      notes: parsed.data.notes || existing.notes,
      reviewedBy: ctx.session.user.id,
      reviewedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "AdmissionApplication",
    entityId: id,
    module: "admissions",
    description: `Reviewed ${existing.applicationNumber} — status ${parsed.data.status}`,
    previousData: { status: existing.status },
    newData: { status: parsed.data.status },
  });

  return { data: updated };
}

/**
 * Staff-facing placement verification. Re-runs the validation service against
 * the stored application record, flips `placementVerified` on success, and —
 * if all auto-admit preconditions are now met — fires an automatic ACCEPT
 * via `decideApplicationAction`.
 */
export async function verifyPlacementAction(
  id: string,
  input: VerifyPlacementInput = {},
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_VERIFY_PLACEMENT);
  if (denied) return denied;

  const parsed = verifyPlacementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const application = await db.admissionApplication.findUnique({
    where: { id },
    include: { documents: true },
  });
  if (!application || application.schoolId !== ctx.schoolId) {
    return { error: "Application not found" };
  }
  if (application.applicationType !== "PLACEMENT") {
    return { error: "Only placement applications can be verified." };
  }

  // Terminal states can't be verified back into the active pipeline. Without
  // this guard a "verify" click on a REJECTED/WITHDRAWN app with a qualifying
  // BECE aggregate would silently resurrect it into ACCEPTED via auto-admit.
  const VERIFIABLE_STATUSES: readonly typeof application.status[] = [
    "DRAFT",
    "SUBMITTED",
    "PAYMENT_PENDING",
    "DOCUMENTS_PENDING",
    "UNDER_REVIEW",
    "SHORTLISTED",
    "INTERVIEW_SCHEDULED",
    "AWAITING_DECISION",
  ] as const;
  if (!VERIFIABLE_STATUSES.includes(application.status)) {
    return {
      error: `Placement cannot be verified while the application is ${application.status}.`,
    };
  }

  const result = await validatePlacement({
    enrollmentCode: application.enrollmentCode,
    beceIndexNumber: application.beceIndexNumber,
    schoolId: ctx.schoolId,
    academicYearId: application.academicYearId,
    excludeApplicationId: application.id,
  });

  if (!result.valid) {
    return { error: result.errors.join(" ") };
  }

  await db.admissionApplication.update({
    where: { id },
    data: {
      placementVerified: true,
      placementVerifiedAt: new Date(),
      placementVerifiedBy: ctx.session.user.id,
      programPlaced: parsed.data.programPlaced || application.programPlaced,
      notes: parsed.data.notes || application.notes,
    },
  });

  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "APPROVE",
    entity: "AdmissionApplication",
    entityId: id,
    module: "admissions",
    description: `Placement verified for ${application.applicationNumber}`,
    newData: { placementVerified: true },
  });

  // Evaluate auto-admit now that placement is verified.
  const docsComplete = application.documents.length > 0; // documents verification is Phase 4
  const capacity = await checkAcademicYearCapacity({
    schoolId: ctx.schoolId,
    academicYearId: application.academicYearId,
  });

  const autoAdmit = shouldAutoAdmitPlacementStudent({
    isPlacementStudent: true,
    placementVerified: true,
    beceAggregate: application.jhsAggregate,
    documentsComplete: docsComplete,
    hasCapacity: capacity.hasCapacity,
  });

  if (autoAdmit.admit) {
    const decision = await decideApplicationAction(id, {
      decision: "ACCEPTED",
      reason: `Auto-admitted: verified placement student, BECE aggregate ${application.jhsAggregate}`,
    });
    return {
      data: {
        placementVerified: true,
        autoAdmitted: true,
        decision,
      },
    };
  }

  return {
    data: {
      placementVerified: true,
      autoAdmitted: false,
      warnings: result.warnings,
      autoAdmitBlockers: autoAdmit.reasons,
    },
  };
}

export async function enrollApplicationAction(id: string, classArmId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_ENROLL);
  if (denied) return denied;

  const application = await db.admissionApplication.findUnique({
    where: { id },
  });

  if (!application || application.schoolId !== ctx.schoolId) {
    return { error: "Application not found" };
  }

  if (application.status !== "ACCEPTED") {
    return { error: "Only accepted applications can be enrolled." };
  }

  // Guard: offer must have been accepted before enrollment finalises.
  if (application.offerAccepted !== true) {
    return {
      error:
        "The offer has not been accepted. Record offer acceptance before enrolling.",
    };
  }

  // Guard: placement students must be verified before enrollment.
  if (application.applicationType === "PLACEMENT" && !application.placementVerified) {
    return {
      error:
        "Placement has not been verified. Run placement verification before enrolling.",
    };
  }

  // Get current academic year
  const academicYear = await db.academicYear.findFirst({
    where: { isCurrent: true },
  });

  if (!academicYear) {
    return { error: "No active academic year." };
  }

  // Pre-flight capacity check at the academic-year level (hard gate).
  const gradeCapacity = await checkAcademicYearCapacity({
    schoolId: ctx.schoolId,
    academicYearId: academicYear.id,
  });
  if (!gradeCapacity.hasCapacity) {
    return {
      error: `No remaining capacity for ${academicYear.name} (${gradeCapacity.enrolled}/${gradeCapacity.totalCapacity} enrolled).`,
    };
  }

  // Verify class arm exists and has room.
  const classArm = await db.classArm.findUnique({
    where: { id: classArmId },
    include: { class: true, _count: { select: { enrollments: true } } },
  });

  if (!classArm) {
    return { error: "Class arm not found." };
  }
  if (classArm._count.enrollments >= classArm.capacity) {
    return {
      error: `Class arm ${classArm.name} is at capacity (${classArm._count.enrollments}/${classArm.capacity}).`,
    };
  }

  // Boarding capacity is a soft warning — bed allocation is handled by the
  // boarding module after enrollment. We surface the warning in the result.
  const boardingWarnings: string[] = [];
  if (application.boardingStatus === "BOARDING") {
    const boarding = await checkBoardingCapacity({
      schoolId: ctx.schoolId,
      gender: application.gender,
    });
    if (!boarding.hasCapacity) {
      boardingWarnings.push(
        `No free boarding beds for ${application.gender.toLowerCase()} students (${boarding.enrolled}/${boarding.totalCapacity}). Bed allocation must be resolved manually.`,
      );
    }
  }

  // Generate student ID
  const year = new Date().getFullYear();
  const studentCount = await db.student.count({
    where: { schoolId: ctx.schoolId },
  });
  const studentId = `STU/${year}/${String(studentCount + 1).padStart(4, "0")}`;

  const isFreeShs =
    application.applicationType === "PLACEMENT" && application.placementVerified === true;

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
        isFreeShsPlacement: isFreeShs,
      },
    });

    // 5. Update application status to ENROLLED
    const updatedApplication = await tx.admissionApplication.update({
      where: { id },
      data: {
        status: "ENROLLED",
        currentStage: "ENROLLED",
        enrolledStudentId: student.id,
      },
    });

    return { student, guardian, enrollment, updatedApplication };
  });

  // Fire workflow ENROLL event (idempotent).
  try {
    await transitionWorkflowWithAutoStart({
      definitionKey: ADMISSION_WORKFLOW_KEY,
      entityType: ADMISSION_ENTITY,
      event: ADMISSION_EVENTS.ENROLL,
      entity: { id: application.id, status: application.status },
      schoolId: ctx.schoolId,
      actor: { userId: ctx.session.user.id!, role: "admissions_officer" },
    });
  } catch (err) {
    console.error("[admissions] enrollment workflow transition failed:", err);
  }

  await dispatch({
    event: NOTIFICATION_EVENTS.ADMISSION_ENROLLED,
    title: "Student enrolled",
    message: `${application.firstName} ${application.lastName} is now enrolled as ${studentId}.`,
    recipients: [
      {
        name: application.guardianName,
        phone: application.guardianPhone,
        email: application.guardianEmail ?? undefined,
      },
    ],
    schoolId: ctx.schoolId,
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

  return {
    data: {
      student: result.student,
      isFreeShsPlacement: isFreeShs,
      warnings: boardingWarnings,
    },
  };
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

  const [
    total,
    submitted,
    underReview,
    shortlisted,
    accepted,
    rejected,
    enrolled,
    draft,
    paymentPending,
    documentsPending,
    interviewScheduled,
    awaitingDecision,
    conditionalAccept,
    waitlisted,
    offerExpired,
    withdrawn,
    placementTotal,
    placementVerified,
    appealsPending,
  ] = await Promise.all([
    db.admissionApplication.count({ where }),
    db.admissionApplication.count({ where: { ...where, status: "SUBMITTED" } }),
    db.admissionApplication.count({ where: { ...where, status: "UNDER_REVIEW" } }),
    db.admissionApplication.count({ where: { ...where, status: "SHORTLISTED" } }),
    db.admissionApplication.count({ where: { ...where, status: "ACCEPTED" } }),
    db.admissionApplication.count({ where: { ...where, status: "REJECTED" } }),
    db.admissionApplication.count({ where: { ...where, status: "ENROLLED" } }),
    db.admissionApplication.count({ where: { ...where, status: "DRAFT" } }),
    db.admissionApplication.count({ where: { ...where, status: "PAYMENT_PENDING" } }),
    db.admissionApplication.count({ where: { ...where, status: "DOCUMENTS_PENDING" } }),
    db.admissionApplication.count({ where: { ...where, status: "INTERVIEW_SCHEDULED" } }),
    db.admissionApplication.count({ where: { ...where, status: "AWAITING_DECISION" } }),
    db.admissionApplication.count({ where: { ...where, status: "CONDITIONAL_ACCEPT" } }),
    db.admissionApplication.count({ where: { ...where, status: "WAITLISTED" } }),
    db.admissionApplication.count({ where: { ...where, status: "OFFER_EXPIRED" } }),
    db.admissionApplication.count({ where: { ...where, status: "WITHDRAWN" } }),
    db.admissionApplication.count({ where: { ...where, applicationType: "PLACEMENT" } }),
    db.admissionApplication.count({
      where: { ...where, applicationType: "PLACEMENT", placementVerified: true },
    }),
    db.admissionAppeal.count({
      where: { schoolId: ctx.schoolId, status: "PENDING" },
    }),
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
      paymentPending,
      documentsPending,
      interviewScheduled,
      awaitingDecision,
      conditionalAccept,
      waitlisted,
      offerExpired,
      withdrawn,
      placementTotal,
      placementVerified,
      placementUnverified: placementTotal - placementVerified,
      appealsPending,
    },
  };
}
