"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

export async function createAssignmentAction(data: {
  courseId: string;
  title: string;
  description?: string;
  type?: string;
  dueDate?: string;
  maxScore?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LMS_ASSIGNMENT_CREATE);
  if (denied) return denied;

  const course = await db.course.findUnique({ where: { id: data.courseId } });
  if (!course) return { error: "Course not found" };
  if (!data.title?.trim()) return { error: "Assignment title is required" };

  const assignment = await db.lmsAssignment.create({
    data: {
      schoolId: ctx.schoolId,
      courseId: data.courseId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      type: (data.type as "WRITTEN" | "QUIZ" | "FILE_UPLOAD" | "PROJECT") || "WRITTEN",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      maxScore: data.maxScore ?? 100,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "LmsAssignment",
    entityId: assignment.id,
    module: "lms",
    description: `Created assignment "${assignment.title}"`,
  });

  return { data: assignment };
}

export async function getAssignmentAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LMS_ASSIGNMENT_READ);
  if (denied) return denied;

  const assignment = await db.lmsAssignment.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { orderIndex: "asc" } },
      _count: { select: { submissions: true } },
    },
  });

  if (!assignment) return { error: "Assignment not found" };
  return { data: assignment };
}

export async function addQuizQuestionAction(data: {
  assignmentId: string;
  question: string;
  type?: string;
  options?: string[];
  correctAnswer?: string;
  points?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LMS_ASSIGNMENT_CREATE);
  if (denied) return denied;

  const assignment = await db.lmsAssignment.findUnique({ where: { id: data.assignmentId } });
  if (!assignment) return { error: "Assignment not found" };
  if (assignment.type !== "QUIZ") return { error: "Can only add questions to quiz assignments" };

  const lastQuestion = await db.quizQuestion.findFirst({
    where: { assignmentId: data.assignmentId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });

  const question = await db.quizQuestion.create({
    data: {
      schoolId: ctx.schoolId,
      assignmentId: data.assignmentId,
      question: data.question,
      type: (data.type as "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER") || "MULTIPLE_CHOICE",
      options: data.options ?? [],
      correctAnswer: data.correctAnswer || null,
      points: data.points ?? 1,
      orderIndex: (lastQuestion?.orderIndex ?? 0) + 1,
    },
  });

  return { data: question };
}

export async function submitAssignmentAction(data: {
  assignmentId: string;
  content?: string;
  answers?: Record<string, string>;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LMS_ASSIGNMENT_READ);
  if (denied) return denied;

  const assignment = await db.lmsAssignment.findUnique({
    where: { id: data.assignmentId },
    include: { questions: true },
  });

  if (!assignment) return { error: "Assignment not found" };

  // Check if already submitted
  const existing = await db.assignmentSubmission.findUnique({
    where: {
      assignmentId_studentId: {
        assignmentId: data.assignmentId,
        studentId: ctx.session.user.id,
      },
    },
  });

  if (existing) return { error: "You have already submitted this assignment" };

  // Auto-grade quiz if applicable
  let score: number | null = null;
  if (assignment.type === "QUIZ" && data.answers) {
    let totalPoints = 0;
    let earnedPoints = 0;

    for (const question of assignment.questions) {
      totalPoints += question.points;
      const studentAnswer = data.answers[question.id];
      if (studentAnswer && question.correctAnswer && studentAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim()) {
        earnedPoints += question.points;
      }
    }

    score = totalPoints > 0 ? (earnedPoints / totalPoints) * assignment.maxScore : 0;
  }

  const submission = await db.assignmentSubmission.create({
    data: {
      schoolId: ctx.schoolId,
      assignmentId: data.assignmentId,
      studentId: ctx.session.user.id,
      content: data.content || null,
      answers: data.answers ?? undefined,
      score,
      status: score != null ? "GRADED" : "SUBMITTED",
      ...(score != null ? { gradedAt: new Date(), gradedBy: "auto" } : {}),
    },
  });

  return { data: submission };
}

export async function gradeSubmissionAction(
  submissionId: string,
  data: { score: number; feedback?: string },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LMS_ASSIGNMENT_GRADE);
  if (denied) return denied;

  const submission = await db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: { assignment: { select: { maxScore: true } } },
  });

  if (!submission) return { error: "Submission not found" };

  if (data.score < 0 || data.score > submission.assignment.maxScore) {
    return { error: `Score must be between 0 and ${submission.assignment.maxScore}` };
  }

  const updated = await db.assignmentSubmission.update({
    where: { id: submissionId },
    data: {
      score: data.score,
      feedback: data.feedback || null,
      status: "GRADED",
      gradedAt: new Date(),
      gradedBy: ctx.session.user.id,
    },
  });

  return { data: updated };
}

export async function getSubmissionsAction(assignmentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.LMS_ASSIGNMENT_READ);
  if (denied) return denied;

  const submissions = await db.assignmentSubmission.findMany({
    where: { assignmentId },
    orderBy: { submittedAt: "desc" },
  });

  // Enrich with student names
  const studentIds = submissions.map((s) => s.studentId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const enriched = submissions.map((s) => ({
    ...s,
    student: studentMap.get(s.studentId) ?? null,
  }));

  return { data: enriched };
}
