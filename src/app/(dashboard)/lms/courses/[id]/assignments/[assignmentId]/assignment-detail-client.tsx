"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addQuizQuestionAction,
  gradeSubmissionAction,
} from "@/modules/lms/actions/assignment.action";

// ─── Types ──────────────────────────────────────────────────────────

interface QuizQuestion {
  id: string;
  question: string;
  type: string | null;
  options: unknown;
  correctAnswer: string | null;
  points: number | null;
}

interface Submission {
  id: string;
  studentId: string;
  studentName?: string;
  score: number | null;
  feedback: string | null;
  submittedAt: Date | string;
  status: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  dueDate: Date | string | null;
  maxScore: number | null;
  questions?: QuizQuestion[];
}

interface QuestionFormData {
  question: string;
  type: string;
  options: string;
  correctAnswer: string;
  points: string;
}

interface GradeFormData {
  score: string;
  feedback: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function AssignmentDetailClient({
  assignment,
  submissions,
}: {
  assignment: Assignment;
  submissions: Submission[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Question form state
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionFormData, setQuestionFormData] = useState<QuestionFormData>({
    question: "",
    type: "MULTIPLE_CHOICE",
    options: "",
    correctAnswer: "",
    points: "1",
  });
  const [questionFormError, setQuestionFormError] = useState<string | null>(null);

  // Grade form state
  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(null);
  const [gradeFormData, setGradeFormData] = useState<GradeFormData>({
    score: "",
    feedback: "",
  });
  const [gradeFormError, setGradeFormError] = useState<string | null>(null);

  const questions = assignment.questions ?? [];
  const isQuiz = assignment.type === "QUIZ";

  // ─── Question Handlers ────────────────────────────────────────────

  function handleAddQuestion() {
    setQuestionFormData({
      question: "",
      type: "MULTIPLE_CHOICE",
      options: "",
      correctAnswer: "",
      points: "1",
    });
    setQuestionFormError(null);
    setShowQuestionForm(true);
  }

  function handleSubmitQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!questionFormData.question.trim()) {
      setQuestionFormError("Question text is required.");
      return;
    }
    setQuestionFormError(null);

    const optionsArray = questionFormData.options
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    startTransition(async () => {
      const result = await addQuizQuestionAction({
        assignmentId: assignment.id,
        question: questionFormData.question.trim(),
        type: questionFormData.type || undefined,
        options: optionsArray.length > 0 ? optionsArray : undefined,
        correctAnswer: questionFormData.correctAnswer.trim() || undefined,
        points: questionFormData.points ? Number(questionFormData.points) : undefined,
      });
      if (result.error) {
        setQuestionFormError(result.error);
      } else {
        toast.success("Question added.");
        setShowQuestionForm(false);
        router.refresh();
      }
    });
  }

  // ─── Grading Handlers ─────────────────────────────────────────────

  function handleGrade(submission: Submission) {
    setGradingSubmissionId(submission.id);
    setGradeFormData({
      score: submission.score?.toString() ?? "",
      feedback: submission.feedback ?? "",
    });
    setGradeFormError(null);
  }

  function handleSubmitGrade(e: React.FormEvent) {
    e.preventDefault();
    if (!gradingSubmissionId) return;
    if (!gradeFormData.score) {
      setGradeFormError("Score is required.");
      return;
    }
    setGradeFormError(null);

    startTransition(async () => {
      const result = await gradeSubmissionAction(gradingSubmissionId!, {
        score: Number(gradeFormData.score),
        feedback: gradeFormData.feedback.trim() || undefined,
      });
      if (result.error) {
        setGradeFormError(result.error);
      } else {
        toast.success("Submission graded.");
        setGradingSubmissionId(null);
        router.refresh();
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Assignment Detail Card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Title</p>
            <p className="text-sm font-medium">{assignment.title}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="text-sm font-medium">{assignment.type ?? "---"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Due Date</p>
            <p className="text-sm font-medium">
              {assignment.dueDate
                ? new Date(assignment.dueDate).toLocaleDateString()
                : "---"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Max Score</p>
            <p className="text-sm font-medium">
              {assignment.maxScore ?? "---"}
            </p>
          </div>
          {assignment.description && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="text-sm">{assignment.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Quiz Questions Section ──────────────────────────────── */}
      {isQuiz && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Quiz Questions ({questions.length})
            </h3>
            <button
              onClick={handleAddQuestion}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add Question
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
              No questions yet. Click &quot;Add Question&quot; to create one.
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {idx + 1}. {q.question}
                      </p>
                      {Array.isArray(q.options) && q.options.length > 0 && (
                        <ul className="mt-2 space-y-1 pl-4">
                          {(q.options as string[]).map((opt, i) => (
                            <li
                              key={i}
                              className={`text-sm ${opt === q.correctAnswer ? "font-medium text-green-700" : "text-muted-foreground"}`}
                            >
                              {String.fromCharCode(65 + i)}. {opt}
                              {opt === q.correctAnswer && " (correct)"}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {q.points ?? 1} pt{(q.points ?? 1) !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Question Form */}
          {showQuestionForm && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h4 className="text-sm font-semibold mb-4">Add Question</h4>
              <form onSubmit={handleSubmitQuestion} className="space-y-4">
                {questionFormError && (
                  <div className="rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
                    {questionFormError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Question <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={questionFormData.question}
                    onChange={(e) =>
                      setQuestionFormData({
                        ...questionFormData,
                        question: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Enter the question"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select
                      value={questionFormData.type}
                      onChange={(e) =>
                        setQuestionFormData({
                          ...questionFormData,
                          type: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                      <option value="TRUE_FALSE">True/False</option>
                      <option value="SHORT_ANSWER">Short Answer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Points
                    </label>
                    <input
                      type="number"
                      value={questionFormData.points}
                      onChange={(e) =>
                        setQuestionFormData({
                          ...questionFormData,
                          points: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      min="1"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Options (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={questionFormData.options}
                    onChange={(e) =>
                      setQuestionFormData({
                        ...questionFormData,
                        options: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="e.g. Option A, Option B, Option C, Option D"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Correct Answer
                  </label>
                  <input
                    type="text"
                    value={questionFormData.correctAnswer}
                    onChange={(e) =>
                      setQuestionFormData({
                        ...questionFormData,
                        correctAnswer: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="The correct answer text"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuestionForm(false)}
                    className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending ? "Adding..." : "Add Question"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ─── Submissions Section ─────────────────────────────────── */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          Submissions ({submissions.length})
        </h3>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Student</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Submitted At
                  </th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Score</th>
                  <th className="px-4 py-3 text-left font-medium">Feedback</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No submissions yet.
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">
                        {sub.studentName ?? sub.studentId}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(sub.submittedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            sub.status === "GRADED"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sub.score != null ? sub.score : "---"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {sub.feedback || "---"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => handleGrade(sub)}
                        >
                          Grade
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Grade Modal ─────────────────────────────────────────── */}
      {gradingSubmissionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Grade Submission</h2>
              <button
                type="button"
                onClick={() => setGradingSubmissionId(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitGrade} className="space-y-4">
              {gradeFormError && (
                <div className="rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
                  {gradeFormError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Score <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={gradeFormData.score}
                  onChange={(e) =>
                    setGradeFormData({ ...gradeFormData, score: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder={`Max: ${assignment.maxScore ?? "---"}`}
                  min="0"
                  max={assignment.maxScore ?? undefined}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Feedback
                </label>
                <textarea
                  value={gradeFormData.feedback}
                  onChange={(e) =>
                    setGradeFormData({
                      ...gradeFormData,
                      feedback: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Optional feedback for the student"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setGradingSubmissionId(null)}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Submit Grade"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
