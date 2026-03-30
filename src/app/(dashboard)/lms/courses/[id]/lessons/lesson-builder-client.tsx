"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
  reorderLessonsAction,
} from "@/modules/lms/actions/lesson.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Lesson {
  id: string;
  title: string;
  content: string | null;
  contentType: string | null;
  resourceUrl: string | null;
  duration: number | null;
  orderIndex: number;
  isPublished: boolean;
  [key: string]: unknown;
}

interface LessonFormData {
  title: string;
  contentType: string;
  content: string;
  resourceUrl: string;
  duration: string;
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

export function LessonBuilderClient({
  courseId,
  initialLessons,
}: {
  courseId: string;
  initialLessons: Lesson[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [lessons, setLessons] = useState<Lesson[]>(
    [...initialLessons].sort((a, b) => a.orderIndex - b.orderIndex)
  );

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [formData, setFormData] = useState<LessonFormData>({
    title: "",
    contentType: "TEXT",
    content: "",
    resourceUrl: "",
    duration: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // ─── Handlers ─────────────────────────────────────────────────────

  function handleAdd() {
    setEditingLessonId(null);
    setFormData({ title: "", contentType: "TEXT", content: "", resourceUrl: "", duration: "" });
    setFormError(null);
    setShowForm(true);
  }

  function handleEdit(lesson: Lesson) {
    setEditingLessonId(lesson.id);
    setFormData({
      title: lesson.title,
      contentType: lesson.contentType ?? "TEXT",
      content: lesson.content ?? "",
      resourceUrl: lesson.resourceUrl ?? "",
      duration: lesson.duration?.toString() ?? "",
    });
    setFormError(null);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError("Lesson title is required.");
      return;
    }
    setFormError(null);

    startTransition(async () => {
      const payload = {
        title: formData.title.trim(),
        contentType: formData.contentType || undefined,
        content: formData.content.trim() || undefined,
        resourceUrl: formData.resourceUrl.trim() || undefined,
        duration: formData.duration ? Number(formData.duration) : undefined,
      };

      if (editingLessonId) {
        const result = await updateLessonAction(editingLessonId, payload);
        if (result.error) {
          setFormError(result.error);
        } else {
          toast.success("Lesson updated.");
          setShowForm(false);
          router.refresh();
        }
      } else {
        const result = await createLessonAction({ courseId, ...payload });
        if (result.error) {
          setFormError(result.error);
        } else {
          toast.success("Lesson created.");
          setShowForm(false);
          router.refresh();
        }
      }
    });
  }

  function handleDelete(lesson: Lesson) {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteLessonAction(lesson.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Lesson deleted.");
        router.refresh();
      }
    });
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const updated = [...lessons];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setLessons(updated);
    const lessonIds = updated.map((l) => l.id);
    startTransition(async () => {
      const result = await reorderLessonsAction(courseId, lessonIds);
      if (result.error) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  function handleMoveDown(index: number) {
    if (index >= lessons.length - 1) return;
    const updated = [...lessons];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setLessons(updated);
    const lessonIds = updated.map((l) => l.id);
    startTransition(async () => {
      const result = await reorderLessonsAction(courseId, lessonIds);
      if (result.error) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={handleAdd}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Lesson
        </button>
      </div>

      {/* Lessons List */}
      {lessons.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          No lessons yet. Click &quot;Add Lesson&quot; to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {lessons.map((lesson, index) => (
            <div
              key={lesson.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {index + 1}
                </span>
                <span className="font-medium text-sm">{lesson.title}</span>
                <ContentTypeBadge type={lesson.contentType} />
                {lesson.duration && (
                  <span className="text-xs text-muted-foreground">
                    {lesson.duration} min
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0 || isPending}
                  className="rounded p-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title="Move up"
                >
                  &#9650;
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index >= lessons.length - 1 || isPending}
                  className="rounded p-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title="Move down"
                >
                  &#9660;
                </button>
                <button
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-2"
                  onClick={() => handleEdit(lesson)}
                >
                  Edit
                </button>
                <button
                  className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                  onClick={() => handleDelete(lesson)}
                  disabled={isPending}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lesson Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingLessonId ? "Edit Lesson" : "Add Lesson"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Lesson title"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Content Type
                  </label>
                  <select
                    value={formData.contentType}
                    onChange={(e) =>
                      setFormData({ ...formData, contentType: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="TEXT">Text</option>
                    <option value="VIDEO">Video</option>
                    <option value="PDF">PDF</option>
                    <option value="LINK">Link</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({ ...formData, duration: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="e.g. 45"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
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
                  value={formData.resourceUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, resourceUrl: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
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
        </div>
      )}
    </>
  );
}
