"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createTermAction,
  updateTermAction,
  deleteTermAction,
  setCurrentTermAction,
} from "@/modules/school/actions/term.action";

interface AcademicYear {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  isCurrent: boolean;
  termCount: number;
}

interface Term {
  id: string;
  academicYearId: string;
  name: string;
  termNumber: number;
  startDate: Date;
  endDate: Date;
  status: string;
  isCurrent: boolean;
  academicYear: {
    id: string;
    name: string;
  };
}

interface FormData {
  academicYearId: string;
  name: string;
  termNumber: number;
  startDate: string;
  endDate: string;
}

export function TermsClient({
  academicYears,
  terms,
}: {
  academicYears: AcademicYear[];
  terms: Term[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);

  // Default to current academic year, or most recent
  const defaultYearId =
    academicYears.find((ay) => ay.isCurrent)?.id ?? academicYears[0]?.id ?? "";
  const [selectedYearId, setSelectedYearId] = useState<string>(defaultYearId);

  const [formData, setFormData] = useState<FormData>({
    academicYearId: defaultYearId,
    name: "",
    termNumber: 1,
    startDate: "",
    endDate: "",
  });

  const filteredTerms = useMemo(() => {
    if (!selectedYearId || selectedYearId === "all") return terms;
    return terms.filter((t) => t.academicYearId === selectedYearId);
  }, [terms, selectedYearId]);

  function handleCreate() {
    setEditingTerm(null);
    setFormData({
      academicYearId: selectedYearId || defaultYearId,
      name: "",
      termNumber: 1,
      startDate: "",
      endDate: "",
    });
    setShowModal(true);
  }

  function handleEdit(term: Term) {
    setEditingTerm(term);
    setFormData({
      academicYearId: term.academicYearId,
      name: term.name,
      termNumber: term.termNumber,
      startDate: format(new Date(term.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(term.endDate), "yyyy-MM-dd"),
    });
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingTerm(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (editingTerm) {
        const result = await updateTermAction(editingTerm.id, {
          name: formData.name,
          termNumber: formData.termNumber,
          startDate: formData.startDate,
          endDate: formData.endDate,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Term updated successfully");
      } else {
        const result = await createTermAction(formData);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Term created successfully");
      }
      setShowModal(false);
      setEditingTerm(null);
      router.refresh();
    });
  }

  function handleDelete(term: Term) {
    startTransition(async () => {
      const result = await deleteTermAction(term.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Term deleted successfully");
      router.refresh();
    });
  }

  function handleSetCurrent(term: Term) {
    startTransition(async () => {
      const result = await setCurrentTermAction(term.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`"${term.name}" set as current term`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terms"
        description="Manage terms for each academic year."
        actions={
          <button
            onClick={handleCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Term
          </button>
        }
      />

      {/* Academic Year Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground">Academic Year:</label>
        <select
          value={selectedYearId}
          onChange={(e) => setSelectedYearId(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Academic Years</option>
          {academicYears.map((ay) => (
            <option key={ay.id} value={ay.id}>
              {ay.name} {ay.isCurrent ? "(Current)" : ""}
            </option>
          ))}
        </select>
      </div>

      {filteredTerms.length === 0 ? (
        <EmptyState
          title="No terms found"
          description={
            selectedYearId && selectedYearId !== "all"
              ? "No terms exist for the selected academic year. Create one to get started."
              : "No terms have been created yet."
          }
          action={
            <button
              onClick={handleCreate}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add Term
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
                  <th className="px-4 py-3 text-center font-medium">Term #</th>
                  <th className="px-4 py-3 text-left font-medium">Start Date</th>
                  <th className="px-4 py-3 text-left font-medium">End Date</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Current</th>
                  <th className="px-4 py-3 text-left font-medium">Academic Year</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTerms.map((term) => (
                  <tr
                    key={term.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{term.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-800 px-2 py-0.5 text-xs font-medium">
                        {term.termNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(term.startDate), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(term.endDate), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={term.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {term.isCurrent ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-medium">
                          Current
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">---</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {term.academicYear.name}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => handleEdit(term)}
                        >
                          Edit
                        </button>
                        {!term.isCurrent && (
                          <ConfirmDialog
                            title="Set as Current"
                            description={`Are you sure you want to set "${term.name}" as the current term? This will also set its academic year as current.`}
                            onConfirm={() => handleSetCurrent(term)}
                            trigger={
                              <button className="text-xs text-green-600 hover:text-green-800 font-medium">
                                Set Current
                              </button>
                            }
                          />
                        )}
                        <ConfirmDialog
                          title="Delete Term"
                          description={`Are you sure you want to delete "${term.name}"? This action cannot be undone.`}
                          onConfirm={() => handleDelete(term)}
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
              {editingTerm ? "Edit Term" : "Add Term"}
            </h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {!editingTerm && (
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Academic Year
                  </label>
                  <select
                    value={formData.academicYearId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        academicYearId: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    <option value="">Select academic year</option>
                    {academicYears.map((ay) => (
                      <option key={ay.id} value={ay.id}>
                        {ay.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1st Term"
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
                  Term Number
                </label>
                <div className="mt-1 flex gap-4">
                  {[1, 2, 3].map((num) => (
                    <label key={num} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="termNumber"
                        value={num}
                        checked={formData.termNumber === num}
                        onChange={() =>
                          setFormData((prev) => ({ ...prev, termNumber: num }))
                        }
                        className="h-4 w-4 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">Term {num}</span>
                    </label>
                  ))}
                </div>
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
                    : editingTerm
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
