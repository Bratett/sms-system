"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createCourseAction,
  publishCourseAction,
  archiveCourseAction,
  deleteCourseAction,
} from "@/modules/lms/actions/course.action";

// ─── Types ──────────────────────────────────────────────────────────

interface CourseItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: Date;
}

interface CourseFormData {
  title: string;
  description: string;
}

// ─── Status Badge ───────────────────────────────────────────────────

function CourseStatusBadge({ status }: { status: string }) {
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

// ─── Component ──────────────────────────────────────────────────────

export function LmsClient({
  initialCourses,
  total,
}: {
  initialCourses: CourseItem[];
  total: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [courses] = useState<CourseItem[]>(initialCourses);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CourseFormData>({
    title: "",
    description: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const filteredCourses =
    statusFilter === "ALL"
      ? courses
      : courses.filter((c) => c.status === statusFilter);

  // ─── Handlers ─────────────────────────────────────────────────────

  function handleCreate() {
    setFormData({ title: "", description: "" });
    setFormError(null);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError("Course title is required.");
      return;
    }
    setFormError(null);

    startTransition(async () => {
      const result = await createCourseAction({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
      });
      if ("error" in result) {
        setFormError(result.error);
      } else {
        toast.success(`Course "${formData.title}" created successfully.`);
        setShowForm(false);
        router.refresh();
      }
    });
  }

  function handlePublish(course: CourseItem) {
    startTransition(async () => {
      const result = await publishCourseAction(course.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Course "${course.title}" published.`);
        router.refresh();
      }
    });
  }

  function handleArchive(course: CourseItem) {
    startTransition(async () => {
      const result = await archiveCourseAction(course.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Course "${course.title}" archived.`);
        router.refresh();
      }
    });
  }

  function handleDelete(course: CourseItem) {
    if (!confirm(`Are you sure you want to delete course "${course.title}"?`))
      return;
    startTransition(async () => {
      const result = await deleteCourseAction(course.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Course "${course.title}" deleted.`);
        router.refresh();
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {total} course{total !== 1 ? "s" : ""} total
          </p>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create Course
        </button>
      </div>

      {/* Courses Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">
                  Description
                </th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Created At</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No courses found. Click &quot;Create Course&quot; to get
                    started.
                  </td>
                </tr>
              ) : (
                filteredCourses.map((course) => (
                  <tr
                    key={course.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      <button
                        className="text-primary hover:underline"
                        onClick={() =>
                          router.push(`/lms/courses/${course.id}`)
                        }
                      >
                        {course.title}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {course.description || "---"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <CourseStatusBadge status={course.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(course.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() =>
                            router.push(`/lms/courses/${course.id}`)
                          }
                        >
                          View
                        </button>
                        {course.status === "DRAFT" && (
                          <button
                            className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                            onClick={() => handlePublish(course)}
                            disabled={isPending}
                          >
                            Publish
                          </button>
                        )}
                        {course.status === "PUBLISHED" && (
                          <button
                            className="text-xs text-yellow-600 hover:text-yellow-800 font-medium disabled:opacity-50"
                            onClick={() => handleArchive(course)}
                            disabled={isPending}
                          >
                            Archive
                          </button>
                        )}
                        <button
                          className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                          onClick={() => handleDelete(course)}
                          disabled={isPending}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Course Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create Course</h2>
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
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Introduction to Biology"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Optional course description"
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
                  {isPending ? "Creating..." : "Create Course"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
