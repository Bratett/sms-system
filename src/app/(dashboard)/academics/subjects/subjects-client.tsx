"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  createSubjectAction,
  updateSubjectAction,
  deleteSubjectAction,
} from "@/modules/academics/actions/subject.action";

// ─── Types ──────────────────────────────────────────────────────────

interface SubjectItem {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  type: string;
  status: string;
  programmesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SubjectFormData {
  name: string;
  code: string;
  description: string;
  type: "CORE" | "ELECTIVE";
}

// ─── Component ──────────────────────────────────────────────────────

export function SubjectsClient({
  initialSubjects,
}: {
  initialSubjects: SubjectItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [subjects] = useState<SubjectItem[]>(initialSubjects);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
  const [formData, setFormData] = useState<SubjectFormData>({
    name: "",
    code: "",
    description: "",
    type: "CORE",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // ─── CRUD Handlers ──────────────────────────────────────────────

  function handleCreate() {
    setEditingSubject(null);
    setFormData({ name: "", code: "", description: "", type: "CORE" });
    setFormError(null);
    setShowModal(true);
  }

  function handleEdit(subject: SubjectItem) {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      code: subject.code ?? "",
      description: subject.description ?? "",
      type: subject.type as "CORE" | "ELECTIVE",
    });
    setFormError(null);
    setShowModal(true);
  }

  function handleDelete(subject: SubjectItem) {
    if (!confirm(`Are you sure you want to delete subject "${subject.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteSubjectAction(subject.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Subject "${subject.name}" deleted successfully.`);
        router.refresh();
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Subject name is required.");
      return;
    }
    setFormError(null);

    startTransition(async () => {
      if (editingSubject) {
        const result = await updateSubjectAction(editingSubject.id, {
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          description: formData.description.trim() || undefined,
          type: formData.type,
        });
        if (result.error) {
          setFormError(result.error);
        } else {
          toast.success(`Subject "${formData.name}" updated successfully.`);
          setShowModal(false);
          router.refresh();
        }
      } else {
        const result = await createSubjectAction({
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          description: formData.description.trim() || undefined,
          type: formData.type,
        });
        if (result.error) {
          setFormError(result.error);
        } else {
          toast.success(`Subject "${formData.name}" created successfully.`);
          setShowModal(false);
          router.refresh();
        }
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {subjects.length} subject{subjects.length !== 1 ? "s" : ""} total
        </p>
        <button
          onClick={handleCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Subject
        </button>
      </div>

      {/* Subjects Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-center font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-center font-medium">Programmes</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No subjects found. Click &quot;Add Subject&quot; to create one.
                  </td>
                </tr>
              ) : (
                subjects.map((subject) => (
                  <tr
                    key={subject.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{subject.name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {subject.code || "---"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          subject.type === "CORE"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {subject.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {subject.description || "---"}
                    </td>
                    <td className="px-4 py-3 text-center">{subject.programmesCount}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={subject.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => handleEdit(subject)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                          onClick={() => handleDelete(subject)}
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

      {/* Subject Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingSubject ? `Edit Subject: ${editingSubject.name}` : "Add Subject"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Subject Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Mathematics"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. MATH"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <div className="flex items-center gap-6 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="subjectType"
                      value="CORE"
                      checked={formData.type === "CORE"}
                      onChange={() => setFormData({ ...formData, type: "CORE" })}
                      className="text-primary"
                    />
                    <span className="text-sm">Core</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="subjectType"
                      value="ELECTIVE"
                      checked={formData.type === "ELECTIVE"}
                      onChange={() => setFormData({ ...formData, type: "ELECTIVE" })}
                      className="text-primary"
                    />
                    <span className="text-sm">Elective</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Optional description of this subject"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                    : editingSubject
                      ? "Update Subject"
                      : "Create Subject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
