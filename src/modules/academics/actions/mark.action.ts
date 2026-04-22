"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { logMarkChange } from "@/modules/academics/utils/mark-audit";

// ─── Mark Entry Data ─────────────────────────────────────────────────

export async function getMarkEntryDataAction(
  subjectId: string,
  classArmId: string,
  assessmentTypeId: string,
  termId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MARKS_READ);
  if (denied) return denied;

  // Get assessment type info
  const assessmentType = await db.assessmentType.findUnique({
    where: { id: assessmentTypeId },
    select: { id: true, name: true, maxScore: true, category: true, weight: true },
  });

  if (!assessmentType) {
    return { error: "Assessment type not found." };
  }

  // Get students enrolled in this class arm (active enrollments)
  const enrollments = await db.enrollment.findMany({
    where: {
      classArmId,
      status: "ACTIVE",
    },
    include: {
      student: {
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          otherNames: true,
        },
      },
    },
    orderBy: {
      student: { lastName: "asc" },
    },
  });

  const students = enrollments.map((e) => ({
    id: e.student.id,
    studentId: e.student.studentId,
    firstName: e.student.firstName,
    lastName: e.student.lastName,
    otherNames: e.student.otherNames,
    fullName: `${e.student.lastName}, ${e.student.firstName}${e.student.otherNames ? ` ${e.student.otherNames}` : ""}`,
  }));

  // Get existing marks for this combination
  const existingMarks = await db.mark.findMany({
    where: {
      subjectId,
      classArmId,
      assessmentTypeId,
      termId,
    },
    select: {
      id: true,
      studentId: true,
      score: true,
      status: true,
    },
  });

  const marksMap = Object.fromEntries(
    existingMarks.map((m) => [m.studentId, { id: m.id, score: m.score, status: m.status }]),
  );

  return {
    data: {
      assessmentType,
      students,
      marks: marksMap,
    },
  };
}

// ─── Enter / Upsert Marks ───────────────────────────────────────────

export async function enterMarksAction(data: {
  subjectId: string;
  classArmId: string;
  assessmentTypeId: string;
  termId: string;
  academicYearId: string;
  marks: Array<{ studentId: string; score: number }>;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MARKS_CREATE);
  if (denied) return denied;

  // Validate assessment type exists and get maxScore + deadline info
  const assessmentType = await db.assessmentType.findUnique({
    where: { id: data.assessmentTypeId },
    select: { id: true, name: true, maxScore: true, entryDeadline: true, isLocked: true },
  });

  if (!assessmentType) {
    return { error: "Assessment type not found." };
  }

  // Check deadline enforcement
  if (assessmentType.isLocked) {
    return { error: `Mark entry for "${assessmentType.name}" is locked by an administrator.` };
  }
  if (assessmentType.entryDeadline && new Date() > assessmentType.entryDeadline) {
    return { error: `Mark entry deadline for "${assessmentType.name}" has passed (${assessmentType.entryDeadline.toLocaleDateString()}).` };
  }

  // Validate all scores are within range
  const invalidMarks = data.marks.filter(
    (m) => m.score < 0 || m.score > assessmentType.maxScore,
  );

  if (invalidMarks.length > 0) {
    return {
      error: `${invalidMarks.length} mark(s) have scores outside the valid range (0 - ${assessmentType.maxScore}).`,
    };
  }

  // Check if any marks for this set are already APPROVED
  const approvedMarks = await db.mark.findMany({
    where: {
      subjectId: data.subjectId,
      classArmId: data.classArmId,
      assessmentTypeId: data.assessmentTypeId,
      termId: data.termId,
      status: "APPROVED",
    },
    select: { id: true },
  });

  if (approvedMarks.length > 0) {
    return {
      error: "Cannot modify marks that have already been approved. Please contact an administrator.",
    };
  }

  // Fetch existing marks for audit trail
  const existingMarks = await db.mark.findMany({
    where: {
      subjectId: data.subjectId,
      assessmentTypeId: data.assessmentTypeId,
      termId: data.termId,
      studentId: { in: data.marks.map((m) => m.studentId) },
    },
    select: { id: true, studentId: true, score: true, status: true },
  });
  const existingMap = new Map(existingMarks.map((m) => [m.studentId, m]));

  // Batch upsert marks in DRAFT status
  const results = await db.$transaction(
    data.marks.map((mark) =>
      db.mark.upsert({
        where: {
          studentId_subjectId_assessmentTypeId_termId: {
            studentId: mark.studentId,
            subjectId: data.subjectId,
            assessmentTypeId: data.assessmentTypeId,
            termId: data.termId,
          },
        },
        update: {
          score: mark.score,
          maxScore: assessmentType.maxScore,
          enteredBy: ctx.session.user.id!,
          enteredAt: new Date(),
          status: "DRAFT",
          approvedBy: null,
          approvedAt: null,
        },
        create: {
          schoolId: ctx.schoolId,
          studentId: mark.studentId,
          subjectId: data.subjectId,
          classArmId: data.classArmId,
          assessmentTypeId: data.assessmentTypeId,
          termId: data.termId,
          academicYearId: data.academicYearId,
          score: mark.score,
          maxScore: assessmentType.maxScore,
          enteredBy: ctx.session.user.id!,
          status: "DRAFT",
        },
      }),
    ),
  );

  // Log audit trail for changed marks
  for (const result of results) {
    const existing = existingMap.get(result.studentId);
    if (existing && existing.score !== result.score) {
      await logMarkChange({
        schoolId: ctx.schoolId,
        markId: result.id,
        studentId: result.studentId,
        subjectId: data.subjectId,
        assessmentTypeId: data.assessmentTypeId,
        termId: data.termId,
        previousScore: existing.score,
        newScore: result.score,
        previousStatus: existing.status,
        newStatus: result.status,
        changedBy: ctx.session.user.id!,
      });
    }
  }

  // Mark data for (studentId, termId) has changed — invalidate any cached
  // report card PDFs for the affected students+term so the next render rebuilds.
  await db.reportCardPdfCache.updateMany({
    where: {
      studentId: { in: results.map((r) => r.studentId) },
      termId: data.termId,
    },
    data: { invalidatedAt: new Date() },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "Mark",
    module: "academics",
    description: `Entered ${results.length} mark(s) for assessment "${assessmentType.name}" (saved as DRAFT)`,
    metadata: {
      subjectId: data.subjectId,
      classArmId: data.classArmId,
      assessmentTypeId: data.assessmentTypeId,
      termId: data.termId,
      markCount: results.length,
    },
  });

  return { data: { count: results.length } };
}

// ─── Submit Marks for Approval ───────────────────────────────────────

export async function submitMarksForApprovalAction(
  subjectId: string,
  classArmId: string,
  assessmentTypeId: string,
  termId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MARKS_CREATE);
  if (denied) return denied;

  // Check submission deadline
  const assessmentType = await db.assessmentType.findUnique({
    where: { id: assessmentTypeId },
    select: { name: true, submissionDeadline: true, isLocked: true },
  });

  if (assessmentType?.isLocked) {
    return { error: `Submission for "${assessmentType.name}" is locked by an administrator.` };
  }
  if (assessmentType?.submissionDeadline && new Date() > assessmentType.submissionDeadline) {
    return { error: `Submission deadline for "${assessmentType.name}" has passed (${assessmentType.submissionDeadline.toLocaleDateString()}).` };
  }

  // Find all DRAFT marks for this combination
  const draftMarks = await db.mark.findMany({
    where: {
      subjectId,
      classArmId,
      assessmentTypeId,
      termId,
      status: "DRAFT",
    },
    select: { id: true, studentId: true },
  });

  if (draftMarks.length === 0) {
    return { error: "No draft marks found to submit for approval." };
  }

  await db.mark.updateMany({
    where: {
      subjectId,
      classArmId,
      assessmentTypeId,
      termId,
      status: "DRAFT",
    },
    data: {
      status: "SUBMITTED",
    },
  });

  // Invalidate cached report cards for every affected student in this term.
  await db.reportCardPdfCache.updateMany({
    where: { studentId: { in: draftMarks.map((m) => m.studentId) }, termId },
    data: { invalidatedAt: new Date() },
  });

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "Mark",
    module: "academics",
    description: `Submitted ${draftMarks.length} mark(s) for approval`,
    metadata: {
      subjectId,
      classArmId,
      assessmentTypeId,
      termId,
      markCount: draftMarks.length,
    },
  });

  return { data: { count: draftMarks.length } };
}

// ─── Get Submitted Marks (for approval view) ────────────────────────

export async function getSubmittedMarksAction(filters?: {
  subjectId?: string;
  classArmId?: string;
  termId?: string;
  status?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MARKS_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = {};
  if (filters?.subjectId) where.subjectId = filters.subjectId;
  if (filters?.classArmId) where.classArmId = filters.classArmId;
  if (filters?.termId) where.termId = filters.termId;
  if (filters?.status) where.status = filters.status;

  // Get all marks matching filters
  const marks = await db.mark.findMany({
    where,
    include: {
      subject: { select: { id: true, name: true, code: true } },
      assessmentType: { select: { id: true, name: true, category: true, maxScore: true } },
    },
    orderBy: { enteredAt: "desc" },
  });

  // Group marks by subject + classArm + assessmentType + term
  const groupMap = new Map<
    string,
    {
      subjectId: string;
      subjectName: string;
      subjectCode: string | null;
      classArmId: string;
      assessmentTypeId: string;
      assessmentTypeName: string;
      assessmentCategory: string;
      maxScore: number;
      termId: string;
      status: string;
      enteredBy: string;
      marksCount: number;
      totalScore: number;
      submittedAt: Date | null;
    }
  >();

  for (const mark of marks) {
    const key = `${mark.subjectId}|${mark.classArmId}|${mark.assessmentTypeId}|${mark.termId}`;
    const existing = groupMap.get(key);

    if (existing) {
      existing.marksCount += 1;
      existing.totalScore += mark.score;
      // Use the latest status in the group (they should all be the same)
      if (mark.status !== existing.status) {
        // Mixed statuses - prioritize SUBMITTED over DRAFT
        existing.status = mark.status;
      }
    } else {
      groupMap.set(key, {
        subjectId: mark.subjectId,
        subjectName: mark.subject.name,
        subjectCode: mark.subject.code,
        classArmId: mark.classArmId,
        assessmentTypeId: mark.assessmentTypeId,
        assessmentTypeName: mark.assessmentType.name,
        assessmentCategory: mark.assessmentType.category,
        maxScore: mark.assessmentType.maxScore,
        termId: mark.termId,
        status: mark.status,
        enteredBy: mark.enteredBy,
        marksCount: 1,
        totalScore: mark.score,
        submittedAt: mark.enteredAt,
      });
    }
  }

  // Resolve class arm names
  const classArmIds = [...new Set(marks.map((m) => m.classArmId))];
  const classArms = await db.classArm.findMany({
    where: { id: { in: classArmIds } },
    include: {
      class: { select: { name: true } },
    },
  });
  const classArmMap = new Map(
    classArms.map((ca) => [ca.id, `${ca.class.name} ${ca.name}`]),
  );

  // Resolve user names for enteredBy
  const userIds = [...new Set(marks.map((m) => m.enteredBy))];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const userMap = new Map(
    users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
  );

  // Resolve term names
  const termIds = [...new Set(marks.map((m) => m.termId))];
  const terms = await db.term.findMany({
    where: { id: { in: termIds } },
    select: { id: true, name: true },
  });
  const termMap = new Map(terms.map((t) => [t.id, t.name]));

  const groups = [...groupMap.values()].map((g) => ({
    ...g,
    classArmName: classArmMap.get(g.classArmId) ?? "Unknown",
    enteredByName: userMap.get(g.enteredBy) ?? "Unknown",
    termName: termMap.get(g.termId) ?? "Unknown",
    averageScore: g.marksCount > 0 ? g.totalScore / g.marksCount : 0,
  }));

  return { data: groups };
}

// ─── Get Individual Marks for a Group ────────────────────────────────

export async function getMarkDetailsAction(
  subjectId: string,
  classArmId: string,
  assessmentTypeId: string,
  termId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MARKS_READ);
  if (denied) return denied;

  const marks = await db.mark.findMany({
    where: {
      subjectId,
      classArmId,
      assessmentTypeId,
      termId,
    },
    orderBy: { enteredAt: "desc" },
  });

  // Get student details
  const studentIds = marks.map((m) => m.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
    },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const data = marks.map((m) => {
    const student = studentMap.get(m.studentId);
    return {
      id: m.id,
      studentId: m.studentId,
      studentNumber: student?.studentId ?? "---",
      studentName: student
        ? `${student.lastName}, ${student.firstName}`
        : "Unknown",
      score: m.score,
      maxScore: m.maxScore,
      status: m.status,
      enteredAt: m.enteredAt,
    };
  });

  return { data };
}

// ─── Approve Marks ───────────────────────────────────────────────────

export async function approveMarksAction(
  subjectId: string,
  classArmId: string,
  assessmentTypeId: string,
  termId: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MARKS_APPROVE);
  if (denied) return denied;

  const submittedMarks = await db.mark.findMany({
    where: {
      subjectId,
      classArmId,
      assessmentTypeId,
      termId,
      status: "SUBMITTED",
    },
    select: { id: true, studentId: true, score: true },
  });

  if (submittedMarks.length === 0) {
    return { error: "No submitted marks found to approve." };
  }

  await db.mark.updateMany({
    where: {
      subjectId,
      classArmId,
      assessmentTypeId,
      termId,
      status: "SUBMITTED",
    },
    data: {
      status: "APPROVED",
      approvedBy: ctx.session.user.id!,
      approvedAt: new Date(),
    },
  });

  // Approving marks promotes the scores into the pool used by report card
  // generation; existing cached PDFs are stale.
  await db.reportCardPdfCache.updateMany({
    where: { studentId: { in: submittedMarks.map((m) => m.studentId) }, termId },
    data: { invalidatedAt: new Date() },
  });

  // Log audit trail for status change
  for (const mark of submittedMarks) {
    await logMarkChange({
      schoolId: ctx.schoolId,
      markId: mark.id,
      studentId: mark.studentId,
      subjectId,
      assessmentTypeId,
      termId,
      previousScore: mark.score,
      newScore: mark.score,
      previousStatus: "SUBMITTED",
      newStatus: "APPROVED",
      changedBy: ctx.session.user.id!,
    });
  }

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "Mark",
    module: "academics",
    description: `Approved ${submittedMarks.length} mark(s)`,
    metadata: {
      subjectId,
      classArmId,
      assessmentTypeId,
      termId,
      markCount: submittedMarks.length,
    },
  });

  return { data: { count: submittedMarks.length } };
}

// ─── Reject Marks ────────────────────────────────────────────────────

export async function rejectMarksAction(
  subjectId: string,
  classArmId: string,
  assessmentTypeId: string,
  termId: string,
  reason: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MARKS_APPROVE);
  if (denied) return denied;

  if (!reason.trim()) {
    return { error: "A reason is required when rejecting marks." };
  }

  const submittedMarks = await db.mark.findMany({
    where: {
      subjectId,
      classArmId,
      assessmentTypeId,
      termId,
      status: "SUBMITTED",
    },
    select: { id: true, studentId: true, score: true },
  });

  if (submittedMarks.length === 0) {
    return { error: "No submitted marks found to reject." };
  }

  await db.mark.updateMany({
    where: {
      subjectId,
      classArmId,
      assessmentTypeId,
      termId,
      status: "SUBMITTED",
    },
    data: {
      status: "DRAFT",
      approvedBy: null,
      approvedAt: null,
    },
  });

  // Rejecting pushes scores back out of APPROVED, which changes what a fresh
  // report card render would include; invalidate any cached rows.
  await db.reportCardPdfCache.updateMany({
    where: { studentId: { in: submittedMarks.map((m) => m.studentId) }, termId },
    data: { invalidatedAt: new Date() },
  });

  // Log audit trail for rejection
  for (const mark of submittedMarks) {
    await logMarkChange({
      schoolId: ctx.schoolId,
      markId: mark.id,
      studentId: mark.studentId,
      subjectId,
      assessmentTypeId,
      termId,
      previousScore: mark.score,
      newScore: mark.score,
      previousStatus: "SUBMITTED",
      newStatus: "DRAFT",
      changedBy: ctx.session.user.id!,
      changeReason: reason,
    });
  }

  await audit({
    userId: ctx.session.user.id!,
    action: "UPDATE",
    entity: "Mark",
    module: "academics",
    description: `Rejected ${submittedMarks.length} mark(s). Reason: ${reason}`,
    metadata: {
      subjectId,
      classArmId,
      assessmentTypeId,
      termId,
      markCount: submittedMarks.length,
      reason,
    },
  });

  return { data: { count: submittedMarks.length } };
}
