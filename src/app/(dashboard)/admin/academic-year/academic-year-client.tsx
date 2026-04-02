"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createAcademicYearAction,
  updateAcademicYearAction,
  deleteAcademicYearAction,
  setCurrentAcademicYearAction,
} from "@/modules/school/actions/academic-year.action";

interface Term {
  id: string;
  name: string;
  termNumber: number;
  startDate: Date;
  endDate: Date;
  status: string;
  isCurrent: boolean;
}

interface AcademicYear {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  isCurrent: boolean;
  termCount: number;
  terms: Term[];
}

interface FormData {
  name: string;
  startDate: string;
  endDate: string;
}

export function AcademicYearClient({
  academicYears,
}: {
  academicYears: AcademicYear[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    startDate: "",
    endDate: "",
  });

  function handleCreate() {
    setEditingYear(null);
    setFormData({ name: "", startDate: "", endDate: "" });
    setShowModal(true);
  }

  function handleEdit(year: AcademicYear) {
    setEditingYear(year);
    setFormData({
      name: year.name,
      startDate: format(new Date(year.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(year.endDate), "yyyy-MM-dd"),
    });
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingYear(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (editingYear) {
        const result = await updateAcademicYearAction(editingYear.id, formData);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Academic year updated successfully");
      } else {
        const result = await createAcademicYearAction(formData);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Academic year created successfully");
      }
      setShowModal(false);
      setEditingYear(null);
      router.refresh();
    });
  }

  function handleDelete(year: AcademicYear) {
    startTransition(async () => {
      const result = await deleteAcademicYearAction(year.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Academic year deleted successfully");
      router.refresh();
    });
  }

  function handleSetCurrent(year: AcademicYear) {
    startTransition(async () => {
      const result = await setCurrentAcademicYearAction(year.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`"${year.name}" set as current academic year`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Years"
        description="Manage academic years and their terms."
        actions={
          <button
            onClick={handleCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Academic Year
          </button>
        }
      />

      {academicYears.length === 0 ? (
        <EmptyState
          title="No academic years"
          description="Create your first academic year to get started."
          action={
            <button
              onClick={handleCreate}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add Academic Year
            </button>
          }
        />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Start Date</th>
                  <th className="px-4 py-3 text-left font-medium">End Date</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Terms</th>
                  <th className="px-4 py-3 text-center font-medium">Current</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {academicYears.map((year) => (
                  <tr
                    key={year.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{year.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(year.startDate), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(year.endDate), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={year.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-medium">
                        {year.termCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {year.isCurrent ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-medium">
                          Current
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">---</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => handleEdit(year)}
                        >
                          Edit
                        </button>
                        {!year.isCurrent && (
                          <ConfirmDialog
                            title="Set as Current"
                            description={`Are you sure you want to set "${year.name}" as the current academic year? This will unset any other current academic year.`}
                            onConfirm={() => handleSetCurrent(year)}
                            trigger={
                              <button className="text-xs text-green-600 hover:text-green-800 font-medium">
                                Set Current
                              </button>
                            }
                          />
                        )}
                        <ConfirmDialog
                          title="Delete Academic Year"
                          description={`Are you sure you want to delete "${year.name}"? This action cannot be undone.`}
                          onConfirm={() => handleDelete(year)}
                          variant="destructive"
                          trigger={
                            <button
                              className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                              disabled={isPending}
                            >
                              Delete
                            </button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">
              {editingYear ? "Edit Academic Year" : "Add Academic Year"}
            </h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2025/2026"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                  disabled={isPending}
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
                    : editingYear
                      ? "Update"
                      : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
