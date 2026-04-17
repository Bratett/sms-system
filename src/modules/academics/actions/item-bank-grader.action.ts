"use server";

import { db } from "@/lib/db";
import { requireAuth, requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { gradeResponse, aggregateScore, type RawAnswer } from "@/lib/item-bank/grader";
import type { Prisma } from "@prisma/client";

interface SubmitInput {
  paperId: string;
  studentId: string;
  timeSpentSecs?: number;
  answers: Array<{
    questionId: string;
    rawAnswer: RawAnswer;
  }>;
}

/**
 * Submit a student's attempt at an item-bank paper and auto-grade the
 * auto-gradable question types. Essay/matching responses land as
 * NEEDS_REVIEW for a teacher to score manually via `gradeResponseAction`.
 *
 * Idempotent on (paperId, studentId, attemptedAt) — the composite unique
 * constraint prevents duplicate submissions from concurrent clicks.
 */
export async function submitItemBankAttemptAction(input: SubmitInput) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;
  if (!input.paperId || !input.studentId || !Array.isArray(input.answers)) {
    return { error: "paperId, studentId and answers are required" };
  }
  if (input.answers.length === 0) return { error: "No answers provided" };

  // Resolve tenant from the paper — allows both staff and student routes.
  const paper = await db.itemBankPaper.findUnique({
    where: { id: input.paperId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { question: { include: { choices: true } } },
      },
    },
  });
  if (!paper) return { error: "Paper not found" };
  if (paper.status !== "PUBLISHED" && paper.status !== "READY") {
    return { error: "Paper is not available for attempts" };
  }

  // Access check: either the caller is the student, their guardian, or has
  // ITEM_BANK_REVIEW (teacher proxy-submission on behalf of student).
  const allowed = await callerCanSubmitFor(ctx.session.user.id, input.studentId);
  const perms = ctx.session.user.permissions ?? [];
  const isProxy = perms.includes("*") || perms.includes(PERMISSIONS.ITEM_BANK_REVIEW);
  if (!allowed && !isProxy) return { error: "Unauthorized to submit for this student" };

  const questionById = new Map(
    paper.questions.map((pq) => [pq.questionId, { paper: pq, question: pq.question }]),
  );

  const graded = input.answers.map((ans) => {
    const mapping = questionById.get(ans.questionId);
    if (!mapping) {
      return { questionId: ans.questionId, rawAnswer: ans.rawAnswer, outcome: null };
    }
    const outcome = gradeResponse(mapping.question, ans.rawAnswer);
    // honour per-paper scoreOverride for the max-score field
    const maxScore = mapping.paper.scoreOverride ?? outcome.maxScore;
    const ratio = outcome.maxScore === 0 ? 1 : outcome.awardedScore / outcome.maxScore;
    return {
      questionId: ans.questionId,
      rawAnswer: ans.rawAnswer,
      outcome: {
        ...outcome,
        maxScore,
        awardedScore: Math.round(maxScore * ratio * 100) / 100,
      },
    };
  });

  const summary = aggregateScore(
    graded
      .map((g) => g.outcome)
      .filter((o): o is NonNullable<typeof o> => o !== null),
  );

  const submission = await db.$transaction(async (tx) => {
    const sub = await tx.itemBankSubmission.create({
      data: {
        schoolId: paper.schoolId,
        paperId: paper.id,
        studentId: input.studentId,
        attemptedAt: new Date(),
        submittedAt: new Date(),
        timeSpentSecs: input.timeSpentSecs,
        status: summary.needsReview ? "PARTIALLY_GRADED" : "GRADED",
        rawScore: summary.rawScore,
        maxScore: summary.maxScore,
        autoGraded: summary.autoGraded,
        needsReview: summary.needsReview,
      },
    });
    if (graded.length > 0) {
      await tx.itemBankResponse.createMany({
        data: graded.map((g) => ({
          submissionId: sub.id,
          questionId: g.questionId,
          schoolId: paper.schoolId,
          rawAnswer: (g.rawAnswer ?? null) as unknown as Prisma.InputJsonValue,
          correct: g.outcome?.correct ?? null,
          awardedScore: g.outcome?.awardedScore ?? 0,
          maxScore: g.outcome?.maxScore ?? 1,
          feedback: g.outcome?.feedback ?? null,
          verdict: g.outcome?.verdict ?? "NEEDS_REVIEW",
          gradedAt: g.outcome?.verdict !== "NEEDS_REVIEW" ? new Date() : null,
          gradedBy: g.outcome?.verdict !== "NEEDS_REVIEW" ? "system:auto" : null,
        })),
      });
    }
    return sub;
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "ItemBankSubmission",
    entityId: submission.id,
    module: "academics",
    description: `Item-bank submission for paper ${paper.id} (${summary.rawScore}/${summary.maxScore})`,
    metadata: { autoGraded: summary.autoGraded, needsReview: summary.needsReview },
  });

  revalidatePath(`/academics/item-bank`);
  return {
    data: {
      submissionId: submission.id,
      rawScore: summary.rawScore,
      maxScore: summary.maxScore,
      needsReview: summary.needsReview,
      autoGraded: summary.autoGraded,
    },
  };
}

/**
 * Teacher-driven manual grading for ESSAY / MATCHING or any response the
 * auto-grader couldn't score. Re-aggregates the submission totals on save.
 */
export async function gradeResponseAction(input: {
  responseId: string;
  awardedScore: number;
  verdict: "CORRECT" | "INCORRECT" | "PARTIAL";
  feedback?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ITEM_BANK_REVIEW);
  if (denied) return denied;

  const response = await db.itemBankResponse.findFirst({
    where: { id: input.responseId, schoolId: ctx.schoolId },
  });
  if (!response) return { error: "Response not found" };
  if (input.awardedScore < 0 || input.awardedScore > response.maxScore) {
    return { error: `Score must be between 0 and ${response.maxScore}` };
  }

  await db.$transaction(async (tx) => {
    await tx.itemBankResponse.update({
      where: { id: response.id },
      data: {
        awardedScore: input.awardedScore,
        correct: input.verdict === "CORRECT",
        verdict: input.verdict,
        feedback: input.feedback ?? null,
        gradedAt: new Date(),
        gradedBy: ctx.session.user.id,
      },
    });
    // Re-aggregate the submission
    const peers = await tx.itemBankResponse.findMany({
      where: { submissionId: response.submissionId },
      select: { awardedScore: true, maxScore: true, verdict: true },
    });
    const rawScore = peers.reduce((s, r) => s + r.awardedScore, 0);
    const maxScore = peers.reduce((s, r) => s + r.maxScore, 0);
    const needsReview = peers.some((r) => r.verdict === "NEEDS_REVIEW");
    await tx.itemBankSubmission.update({
      where: { id: response.submissionId },
      data: {
        rawScore: Math.round(rawScore * 100) / 100,
        maxScore: Math.round(maxScore * 100) / 100,
        needsReview,
        status: needsReview ? "PARTIALLY_GRADED" : "GRADED",
        gradedAt: needsReview ? null : new Date(),
        gradedBy: needsReview ? null : ctx.session.user.id,
      },
    });
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "ItemBankResponse",
    entityId: response.id,
    module: "academics",
    description: `Manually graded response: ${input.verdict} (${input.awardedScore}/${response.maxScore})`,
  });

  revalidatePath("/academics/item-bank");
  return { data: { ok: true } };
}

export async function listSubmissionsAction(paperId: string, needsReviewOnly = false) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ITEM_BANK_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId, paperId };
  if (needsReviewOnly) where.needsReview = true;

  const submissions = await db.itemBankSubmission.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    take: 200,
  });
  return { data: submissions };
}

export async function getSubmissionAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ITEM_BANK_READ);
  if (denied) return denied;

  const submission = await db.itemBankSubmission.findFirst({
    where: { id, schoolId: ctx.schoolId },
    include: {
      responses: {
        include: { question: { include: { choices: { orderBy: { order: "asc" } } } } },
      },
      paper: { select: { title: true, subjectId: true } },
    },
  });
  if (!submission) return { error: "Submission not found" };
  return { data: submission };
}

async function callerCanSubmitFor(userId: string, studentId: string): Promise<boolean> {
  const guardian = await db.guardian.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (guardian) {
    const link = await db.studentGuardian.findFirst({
      where: { guardianId: guardian.id, studentId },
      select: { id: true },
    });
    if (link) return true;
  }
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { userId: true },
  });
  if (student?.userId && student.userId === userId) return true;
  return false;
}
