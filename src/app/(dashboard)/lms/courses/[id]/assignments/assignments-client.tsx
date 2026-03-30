"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAssignmentAction } from "@/modules/lms/actions/assignment.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  dueDate: Date | string | null;
  maxScore: number | null;
  _count?: { submissions?: number };
}

interface AssignmentFormData {
  title: string;
  description: string;
  type: string;
  dueDate: string;
  maxScore: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function AssignmentsClient({
  courseId,
  initialAssignments,
}: {
  courseId: string;
  initialAssignments: Assignment[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [assignments] = useState<Assignment[]>(initialAssignments);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<AssignmentFormData>({
    title: "",
    description: "",
    type: "HOMEWORK",
    dueDate: "",
    maxScore: "100",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // ─── Handlers ─────────────────────────────────────────────────────

  function handleCreate() {
    setFormData({ title: "", description: "", type: "HOMEWORK", dueDate: "", maxScore: "100" });
    setFormError(null);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError("Assignment title is required.");
      return;
    }
    setFormError(null);

    startTransition(async () => {
      const result = await createAssignmentAction({
        courseId,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type || undefined,
        dueDate: formData.dueDate || undefined,
        maxScore: formData.maxScore ? Number(formData.maxScore) : undefined,
      });
      if (result.error) {
        setFormError(result.error);
      } else {
        toast.success("Assignment created successfully.");
        setShowForm(false);
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
          {assignments.length} assignment{assignments.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={handleCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Assignment
        </button>
      </div>

      {/* Assignments Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-center font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Due Date</th>
                <th className="px-4 py-3 text-center font-medium">Max Score</th>
                <th className="px-4 py-3 text-center font-medium">Submissions</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No assignments yet. Click &quot;Add Assignment&quot; to
                    create one.
                  </td>
                </tr>
              ) : (
                assignments.map((assignment) => (
                  <tr
                    key={assignment.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      <button
                        className="text-primary hover:underline"
                        onClick={() =>
                          router.push(
                            `/lms/courses/${courseId}/assignments/${assignment.id}`
                          )
                        }
                      >
                        {assignment.title}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {assignment.type && (
                        <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 px-2.5 py-0.5 text-xs font-medium">
                          {assignment.type}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {assignment.dueDate
                        ? new Date(assignment.dueDate).toLocaleDateString()
                        : "---"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {assignment.maxScore ?? "---"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {assignment._count?.submissions ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        onClick={() =>
                          router.push(
                            `/lms/courses/${courseId}/assignments/${assignment.id}`
                          )
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Assignment Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add Assignment</h2>
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
                  placeholder="Assignment title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="HOMEWORK">Homework</option>
                  <option value="QUIZ">Quiz</option>
                  <option value="EXAM">Exam</option>
                  <option value="PROJECT">Project</option>
                </select>
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
                  placeholder="Assignment description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
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
                    value={formData.maxScore}
                    onChange={(e) =>
                      setFormData({ ...formData, maxScore: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="100"
                    min="0"
                  />
                </div>
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
                  {isPending ? "Creating..." : "Create Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
