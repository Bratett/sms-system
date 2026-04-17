"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
} from "@/modules/lms/actions/lesson.action";
import {
  createAssignmentAction,
} from "@/modules/lms/actions/assignment.action";
import {
  publishCourseAction,
  archiveCourseAction,
} from "@/modules/lms/actions/course.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Lesson {
  id: string;
  title: string;
  content: string | null;
  contentType: string | null;
  resourceUrl: string | null;
  duration: number | null;
  orderIndex: number;
  [key: string]: unknown;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  dueDate: Date | string | null;
  maxScore: number | null;
  [key: string]: unknown;
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  status: string;
  lessons?: Lesson[];
  assignments?: Assignment[];
  [key: string]: unknown;
}

interface LessonFormData {
  title: string;
  contentType: string;
  content: string;
  resourceUrl: string;
}

interface AssignmentFormData {
  title: string;
  description: string;
  type: string;
  dueDate: string;
  maxScore: string;
}

// ─── Status Badge ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    PUBLISHED: "bg-green-100 text-green-700",
    ARCHIVED: "bg-yellow-100 text-yellow-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {status}
    </span>
  );
}

// ─── Content Type Badge ─────────────────────────────────────────────

function ContentTypeBadge({ type }: { type: string | null }) {
  const label = type ?? "TEXT";
  const styles: Record<string, string> = {
    TEXT: "bg-blue-100 text-blue-700",
    VIDEO: "bg-purple-100 text-purple-700",
    PDF: "bg-red-100 text-red-700",
    LINK: "bg-cyan-100 text-cyan-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[label] ?? "bg-gray-100 text-gray-700"}`}
    >
      {label}
    </span>
  );
}

// ─── Component ──────────────────────────────────────────────────────

export function CourseDetailClient({ course }: { course: Course }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"lessons" | "assignments" | "info">("lessons");

  // Lesson form state
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [lessonFormData, setLessonFormData] = useState<LessonFormData>({
    title: "",
    contentType: "TEXT",
    content: "",
    resourceUrl: "",
  });
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonFormError, setLessonFormError] = useState<string | null>(null);

  // Assignment form state
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [assignmentFormData, setAssignmentFormData] = useState<AssignmentFormData>({
    title: "",
    description: "",
    type: "HOMEWORK",
    dueDate: "",
    maxScore: "100",
  });
  const [assignmentFormError, setAssignmentFormError] = useState<string | null>(null);

  const lessons = course.lessons ?? [];
  const assignments = course.assignments ?? [];

  // ─── Lesson Handlers ──────────────────────────────────────────────

  function handleAddLesson() {
    setEditingLessonId(null);
    setLessonFormData({ title: "", contentType: "TEXT", content: "", resourceUrl: "" });
    setLessonFormError(null);
    setShowLessonForm(true);
  }

  function handleEditLesson(lesson: Lesson) {
    setEditingLessonId(lesson.id);
    setLessonFormData({
      title: lesson.title,
      contentType: lesson.contentType ?? "TEXT",
      content: lesson.content ?? "",
      resourceUrl: lesson.resourceUrl ?? "",
    });
    setLessonFormError(null);
    setShowLessonForm(true);
  }

  function handleSubmitLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonFormData.title.trim()) {
      setLessonFormError("Lesson title is required.");
      return;
    }
    setLessonFormError(null);

    startTransition(async () => {
      if (editingLessonId) {
        const result = await updateLessonAction(editingLessonId, {
          title: lessonFormData.title.trim(),
          contentType: lessonFormData.contentType || undefined,
          content: lessonFormData.content.trim() || undefined,
          resourceUrl: lessonFormData.resourceUrl.trim() || undefined,
        });
        if ("error" in result) {
          setLessonFormError(result.error);
        } else {
          toast.success("Lesson updated successfully.");
          setShowLessonForm(false);
          router.refresh();
        }
      } else {
        const result = await createLessonAction({
          courseId: course.id,
          title: lessonFormData.title.trim(),
          contentType: lessonFormData.contentType || undefined,
          content: lessonFormData.content.trim() || undefined,
          resourceUrl: lessonFormData.resourceUrl.trim() || undefined,
        });
        if ("error" in result) {
          setLessonFormError(result.error);
        } else {
          toast.success("Lesson created successfully.");
          setShowLessonForm(false);
          router.refresh();
        }
      }
    });
  }

  function handleDeleteLesson(lesson: Lesson) {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteLessonAction(lesson.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Lesson deleted.");
        router.refresh();
      }
    });
  }

  // ─── Assignment Handlers ──────────────────────────────────────────

  function handleAddAssignment() {
    setAssignmentFormData({
      title: "",
      description: "",
      type: "HOMEWORK",
      dueDate: "",
      maxScore: "100",
    });
    setAssignmentFormError(null);
    setShowAssignmentForm(true);
  }

  function handleSubmitAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!assignmentFormData.title.trim()) {
      setAssignmentFormError("Assignment title is required.");
      return;
    }
    setAssignmentFormError(null);

    startTransition(async () => {
      const result = await createAssignmentAction({
        courseId: course.id,
        title: assignmentFormData.title.trim(),
        description: assignmentFormData.description.trim() || undefined,
        type: assignmentFormData.type || undefined,
        dueDate: assignmentFormData.dueDate || undefined,
        maxScore: assignmentFormData.maxScore
          ? Number(assignmentFormData.maxScore)
          : undefined,
      });
      if ("error" in result) {
        setAssignmentFormError(result.error);
      } else {
        toast.success("Assignment created successfully.");
        setShowAssignmentForm(false);
        router.refresh();
      }
    });
  }

  // ─── Course Actions ───────────────────────────────────────────────

  function handlePublish() {
    startTransition(async () => {
      const result = await publishCourseAction(course.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Course published.");
        router.refresh();
      }
    });
  }

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveCourseAction(course.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Course archived.");
        router.refresh();
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Course Header Card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-semibold">{course.title}</h2>
              <StatusBadge status={course.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {course.description || "No description provided."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {course.status === "DRAFT" && (
              <button
                onClick={handlePublish}
                disabled={isPending}
                className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Publish
              </button>
            )}
            {course.status === "PUBLISHED" && (
              <button
                onClick={handleArchive}
                disabled={isPending}
                className="rounded-md bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
              >
                Archive
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-1 border-b border-border">
        {(["lessons", "assignments", "info"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ─── Lessons Tab ─────────────────────────────────────────── */}
      {activeTab === "lessons" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={handleAddLesson}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add Lesson
            </button>
          </div>

          {lessons.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
              No lessons yet. Click &quot;Add Lesson&quot; to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {lessons
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {lesson.orderIndex}
                      </span>
                      <span className="font-medium text-sm">{lesson.title}</span>
                      <ContentTypeBadge type={lesson.contentType} />
                      {lesson.duration && (
                        <span className="text-xs text-muted-foreground">
                          {lesson.duration} min
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        onClick={() => handleEditLesson(lesson)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                        onClick={() => handleDeleteLesson(lesson)}
                        disabled={isPending}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Inline Lesson Form */}
          {showLessonForm && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-semibold mb-4">
                {editingLessonId ? "Edit Lesson" : "Add Lesson"}
              </h3>
              <form onSubmit={handleSubmitLesson} className="space-y-4">
                {lessonFormError && (
                  <div className="rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
                    {lessonFormError}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={lessonFormData.title}
                      onChange={(e) =>
                        setLessonFormData({ ...lessonFormData, title: e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Lesson title"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Content Type
                    </label>
                    <select
                      value={lessonFormData.contentType}
                      onChange={(e) =>
                        setLessonFormData({ ...lessonFormData, contentType: e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="TEXT">Text</option>
                      <option value="VIDEO">Video</option>
                      <option value="PDF">PDF</option>
                      <option value="LINK">Link</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Content</label>
                  <textarea
                    value={lessonFormData.content}
                    onChange={(e) =>
                      setLessonFormData({ ...lessonFormData, content: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={4}
                    placeholder="Lesson content or notes"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Resource URL
                  </label>
                  <input
                    type="url"
                    value={lessonFormData.resourceUrl}
                    onChange={(e) =>
                      setLessonFormData({ ...lessonFormData, resourceUrl: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="https://..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLessonForm(false)}
                    className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending
                      ? "Saving..."
                      : editingLessonId
                        ? "Update Lesson"
                        : "Create Lesson"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ─── Assignments Tab ─────────────────────────────────────── */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {assignments.length} assignment{assignments.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={handleAddAssignment}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add Assignment
            </button>
          </div>

          {assignments.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
              No assignments yet. Click &quot;Add Assignment&quot; to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{assignment.title}</span>
                    {assignment.type && (
                      <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs font-medium">
                        {assignment.type}
                      </span>
                    )}
                    {assignment.dueDate && (
                      <span className="text-xs text-muted-foreground">
                        Due: {new Date(assignment.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {assignment.maxScore != null && (
                      <span className="text-xs text-muted-foreground">
                        Max: {assignment.maxScore} pts
                      </span>
                    )}
                  </div>
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    onClick={() =>
                      router.push(
                        `/lms/courses/${course.id}/assignments/${assignment.id}`
                      )
                    }
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Inline Assignment Form */}
          {showAssignmentForm && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-semibold mb-4">Add Assignment</h3>
              <form onSubmit={handleSubmitAssignment} className="space-y-4">
                {assignmentFormError && (
                  <div className="rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
                    {assignmentFormError}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={assignmentFormData.title}
                      onChange={(e) =>
                        setAssignmentFormData({
                          ...assignmentFormData,
                          title: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Assignment title"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select
                      value={assignmentFormData.type}
                      onChange={(e) =>
                        setAssignmentFormData({
                          ...assignmentFormData,
                          type: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="HOMEWORK">Homework</option>
                      <option value="QUIZ">Quiz</option>
                      <option value="EXAM">Exam</option>
                      <option value="PROJECT">Project</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    value={assignmentFormData.description}
                    onChange={(e) =>
                      setAssignmentFormData({
                        ...assignmentFormData,
                        description: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={3}
                    placeholder="Assignment description"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={assignmentFormData.dueDate}
                      onChange={(e) =>
                        setAssignmentFormData({
                          ...assignmentFormData,
                          dueDate: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Max Score
                    </label>
                    <input
                      type="number"
                      value={assignmentFormData.maxScore}
                      onChange={(e) =>
                        setAssignmentFormData({
                          ...assignmentFormData,
                          maxScore: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="100"
                      min="0"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAssignmentForm(false)}
                    className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending ? "Creating..." : "Create Assignment"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ─── Info Tab ────────────────────────────────────────────── */}
      {activeTab === "info" && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold">Course Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Title</p>
              <p className="text-sm font-medium">{course.title}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <StatusBadge status={course.status} />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="text-sm">{course.description || "No description."}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lessons</p>
              <p className="text-sm font-medium">{lessons.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assignments</p>
              <p className="text-sm font-medium">{assignments.length}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
