"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
} from "@/modules/school/actions/department.action";

interface Department {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  programmesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FormData {
  name: string;
  code: string;
  description: string;
}

export function DepartmentsClient({ departments }: { departments: Department[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState<FormData>({ name: "", code: "", description: "" });
  const [formError, setFormError] = useState<string | null>(null);

  function handleCreate() {
    setEditingDepartment(null);
    setFormData({ name: "", code: "", description: "" });
    setFormError(null);
    setShowModal(true);
  }

  function handleEdit(dept: Department) {
    setEditingDepartment(dept);
    setFormData({
      name: dept.name,
      code: dept.code ?? "",
      description: dept.description ?? "",
    });
    setFormError(null);
    setShowModal(true);
  }

  function handleClose() {
    setShowModal(false);
    setEditingDepartment(null);
    setFormError(null);
  }

  function handleDelete(dept: Department) {
    if (dept.programmesCount > 0) {
      toast.error(
        `Cannot delete "${dept.name}" because it has ${dept.programmesCount} programme(s) linked to it.`,
      );
      return;
    }
    if (!confirm(`Are you sure you want to delete department "${dept.name}"?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteDepartmentAction(dept.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Department "${dept.name}" deleted successfully.`);
        router.refresh();
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Department name is required.");
      return;
    }
    setFormError(null);

    startTransition(async () => {
      if (editingDepartment) {
        const result = await updateDepartmentAction(editingDepartment.id, {
          name: formData.name.trim(),
          code: formData.code.trim(),
          description: formData.description.trim(),
        });
        if ("error" in result) {
          setFormError(result.error);
        } else {
          toast.success(`Department "${formData.name}" updated successfully.`);
          handleClose();
          router.refresh();
        }
      } else {
        const result = await createDepartmentAction({
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          description: formData.description.trim() || undefined,
        });
        if ("error" in result) {
          setFormError(result.error);
        } else {
          toast.success(`Department "${formData.name}" created successfully.`);
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
          Add Department
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-center font-medium">Programmes</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No departments found. Click &quot;Add Department&quot; to create one.
                  </td>
                </tr>
              ) : (
                departments.map((dept) => (
                  <tr key={dept.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{dept.name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {dept.code || "---"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {dept.description || "---"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-medium">
                        {dept.programmesCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={dept.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => handleEdit(dept)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                          onClick={() => handleDelete(dept)}
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
                {editingDepartment ? `Edit Department: ${editingDepartment.name}` : "Add Department"}
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
                  Department Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Science Department"
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
                  placeholder="e.g. SCI"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Brief description of the department"
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
                    : editingDepartment
                      ? "Update Department"
                      : "Create Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
