"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  createProgrammeAction,
  updateProgrammeAction,
  deleteProgrammeAction,
} from "@/modules/school/actions/programme.action";

interface Programme {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  duration: number;
  status: string;
  departmentId: string | null;
  departmentName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface FormData {
  name: string;
  code: string;
  description: string;
  departmentId: string;
  duration: number;
}

const SUGGESTED_PROGRAMMES = [
  "General Science",
  "General Arts",
  "Business",
  "Visual Arts",
  "Home Economics",
  "Technical",
];

export function ProgrammesClient({
  programmes,
  departments,
}: {
  programmes: Programme[];
  departments: DepartmentOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [editingProgramme, setEditingProgramme] = useState<Programme | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    code: "",
    description: "",
    departmentId: "",
    duration: 3,
  });
  const [formError, setFormError] = useState<string | null>(null);

  function handleCreate() {
    setEditingProgramme(null);
    setFormData({ name: "", code: "", description: "", departmentId: "", duration: 3 });
    setFormError(null);
    setShowModal(true);
  }

  function handleEdit(prog: Programme) {
    setEditingProgramme(prog);
    setFormData({
      name: prog.name,
      code: prog.code ?? "",
      description: prog.description ?? "",
      departmentId: prog.departmentId ?? "",
      duration: prog.duration,
    });
    setFormError(null);
    setShowModal(true);
  }

  function handleClose() {
    setShowModal(false);
    setEditingProgramme(null);
    setFormError(null);
  }

  function handleDelete(prog: Programme) {
    if (!confirm(`Are you sure you want to delete programme "${prog.name}"?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteProgrammeAction(prog.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Programme "${prog.name}" deleted successfully.`);
        router.refresh();
      }
    });
  }

  function handleSuggestionClick(name: string) {
    setFormData({ ...formData, name });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Programme name is required.");
      return;
    }
    setFormError(null);

    startTransition(async () => {
      if (editingProgramme) {
        const result = await updateProgrammeAction(editingProgramme.id, {
          name: formData.name.trim(),
          code: formData.code.trim(),
          description: formData.description.trim(),
          departmentId: formData.departmentId || null,
          duration: formData.duration,
        });
        if (result.error) {
          setFormError(result.error);
        } else {
          toast.success(`Programme "${formData.name}" updated successfully.`);
          handleClose();
          router.refresh();
        }
      } else {
        const result = await createProgrammeAction({
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          description: formData.description.trim() || undefined,
          departmentId: formData.departmentId || undefined,
          duration: formData.duration,
        });
        if (result.error) {
          setFormError(result.error);
        } else {
          toast.success(`Programme "${formData.name}" created successfully.`);
          handleClose();
          router.refresh();
        }
      }
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={handleCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Programme
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Department</th>
                <th className="px-4 py-3 text-center font-medium">Duration (yrs)</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {programmes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No programmes found. Click &quot;Add Programme&quot; to create one.
                  </td>
                </tr>
              ) : (
                programmes.map((prog) => (
                  <tr key={prog.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{prog.name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {prog.code || "---"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {prog.departmentName || "---"}
                    </td>
                    <td className="px-4 py-3 text-center">{prog.duration}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {prog.description || "---"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={prog.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => handleEdit(prog)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                          onClick={() => handleDelete(prog)}
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingProgramme ? `Edit Programme: ${editingProgramme.name}` : "Add Programme"}
              </h2>
              <button
                type="button"
                onClick={handleClose}
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
                  Programme Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. General Science"
                  required
                />
                {!editingProgramme && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Suggestions:</span>
                    {SUGGESTED_PROGRAMMES.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => handleSuggestionClick(name)}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="e.g. GSCI"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Duration (years)</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({ ...formData, duration: parseInt(e.target.value) || 3 })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Brief description of the programme"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={handleClose}
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
                    : editingProgramme
                      ? "Update Programme"
                      : "Create Programme"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
