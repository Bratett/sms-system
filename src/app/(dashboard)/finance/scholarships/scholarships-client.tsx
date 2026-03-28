"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createScholarshipAction,
  updateScholarshipAction,
  deleteScholarshipAction,
  applyScholarshipAction,
} from "@/modules/finance/actions/scholarship.action";

interface Scholarship {
  id: string;
  name: string;
  type: string;
  value: number;
  criteria: string | null;
  academicYearId: string | null;
  status: string;
  studentsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface Term {
  id: string;
  name: string;
  academicYearId: string;
  isCurrent: boolean;
  academicYear: { id: string; name: string };
}

interface ScholarshipFormData {
  name: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  criteria: string;
  academicYearId: string;
}

interface ApplyFormData {
  studentSearch: string;
  studentId: string;
  termId: string;
}

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ScholarshipsClient({
  scholarships,
  academicYears,
  terms,
}: {
  scholarships: Scholarship[];
  academicYears: AcademicYear[];
  terms: Term[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [editingScholarship, setEditingScholarship] = useState<Scholarship | null>(null);
  const [selectedScholarship, setSelectedScholarship] = useState<Scholarship | null>(null);

  const [formData, setFormData] = useState<ScholarshipFormData>({
    name: "",
    type: "PERCENTAGE",
    value: 0,
    criteria: "",
    academicYearId: "",
  });

  const [applyData, setApplyData] = useState<ApplyFormData>({
    studentSearch: "",
    studentId: "",
    termId: terms.find((t) => t.isCurrent)?.id ?? "",
  });

  function handleCreate() {
    setEditingScholarship(null);
    setFormData({
      name: "",
      type: "PERCENTAGE",
      value: 0,
      criteria: "",
      academicYearId: "",
    });
    setShowModal(true);
  }

  function handleEdit(scholarship: Scholarship) {
    setEditingScholarship(scholarship);
    setFormData({
      name: scholarship.name,
      type: scholarship.type as "PERCENTAGE" | "FIXED_AMOUNT",
      value: scholarship.value,
      criteria: scholarship.criteria ?? "",
      academicYearId: scholarship.academicYearId ?? "",
    });
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingScholarship(null);
  }

  function handleApplyOpen(scholarship: Scholarship) {
    setSelectedScholarship(scholarship);
    setApplyData({
      studentSearch: "",
      studentId: "",
      termId: terms.find((t) => t.isCurrent)?.id ?? "",
    });
    setShowApplyModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (editingScholarship) {
        const result = await updateScholarshipAction(editingScholarship.id, {
          name: formData.name,
          type: formData.type,
          value: formData.value,
          criteria: formData.criteria,
          academicYearId: formData.academicYearId,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Scholarship updated successfully");
      } else {
        const result = await createScholarshipAction({
          name: formData.name,
          type: formData.type,
          value: formData.value,
          criteria: formData.criteria || undefined,
          academicYearId: formData.academicYearId || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Scholarship created successfully");
      }
      setShowModal(false);
      setEditingScholarship(null);
      router.refresh();
    });
  }

  function handleApplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedScholarship || !applyData.studentId || !applyData.termId) {
      toast.error("Please provide student ID and term");
      return;
    }
    startTransition(async () => {
      const result = await applyScholarshipAction(
        applyData.studentId,
        selectedScholarship!.id,
        applyData.termId
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Scholarship applied to student successfully");
      setShowApplyModal(false);
      setSelectedScholarship(null);
      router.refresh();
    });
  }

  function handleDelete(scholarship: Scholarship) {
    startTransition(async () => {
      const result = await deleteScholarshipAction(scholarship.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Scholarship deleted successfully");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scholarships & Discounts"
        description="Manage scholarships, bursaries, and fee discounts for students."
        actions={
          <button
            onClick={handleCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Scholarship
          </button>
        }
      />

      {scholarships.length === 0 ? (
        <EmptyState
          title="No scholarships found"
          description="Create your first scholarship or discount to get started."
          action={
            <button
              onClick={handleCreate}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add Scholarship
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
                  <th className="px-4 py-3 text-center font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 text-left font-medium">Criteria</th>
                  <th className="px-4 py-3 text-center font-medium">Students</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {scholarships.map((scholarship) => (
                  <tr
                    key={scholarship.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{scholarship.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          scholarship.type === "PERCENTAGE"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {scholarship.type === "PERCENTAGE" ? "Percentage" : "Fixed Amount"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {scholarship.type === "PERCENTAGE"
                        ? `${scholarship.value}%`
                        : formatCurrency(scholarship.value)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {scholarship.criteria || "---"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-800 px-2 py-0.5 text-xs font-medium">
                        {scholarship.studentsCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={scholarship.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                          onClick={() => handleApplyOpen(scholarship)}
                        >
                          Apply to Student
                        </button>
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => handleEdit(scholarship)}
                        >
                          Edit
                        </button>
                        <ConfirmDialog
                          title="Delete Scholarship"
                          description={`Are you sure you want to delete "${scholarship.name}"? This action cannot be undone.`}
                          onConfirm={() => handleDelete(scholarship)}
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

      {/* Create/Edit Scholarship Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">
              {editingScholarship ? "Edit Scholarship" : "Add Scholarship"}
            </h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Merit Scholarship"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">Type</label>
                <div className="mt-1 flex gap-4">
                  {(["PERCENTAGE", "FIXED_AMOUNT"] as const).map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scholarshipType"
                        value={type}
                        checked={formData.type === type}
                        onChange={() =>
                          setFormData((prev) => ({ ...prev, type }))
                        }
                        className="h-4 w-4 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">
                        {type === "PERCENTAGE" ? "Percentage" : "Fixed Amount"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">
                  Value <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={formData.type === "PERCENTAGE" ? 100 : undefined}
                    placeholder={formData.type === "PERCENTAGE" ? "e.g. 50" : "e.g. 500.00"}
                    value={formData.value || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, value: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {formData.type === "PERCENTAGE" ? "%" : "GHS"}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">Criteria</label>
                <textarea
                  placeholder="Describe the eligibility criteria..."
                  value={formData.criteria}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, criteria: e.target.value }))
                  }
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">
                  Academic Year
                </label>
                <select
                  value={formData.academicYearId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, academicYearId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Academic Years</option>
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>
                      {ay.name} {ay.isCurrent ? "(Current)" : ""}
                    </option>
                  ))}
                </select>
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
                    : editingScholarship
                      ? "Update"
                      : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Apply Scholarship to Student Modal */}
      {showApplyModal && selectedScholarship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">
              Apply Scholarship: {selectedScholarship.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedScholarship.type === "PERCENTAGE"
                ? `${selectedScholarship.value}% discount`
                : `${formatCurrency(selectedScholarship.value)} discount`}
            </p>
            <form onSubmit={handleApplySubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Student ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter student record ID"
                  value={applyData.studentId}
                  onChange={(e) =>
                    setApplyData((prev) => ({ ...prev, studentId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter the student database ID to apply the scholarship
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">
                  Term <span className="text-red-500">*</span>
                </label>
                <select
                  value={applyData.termId}
                  onChange={(e) =>
                    setApplyData((prev) => ({ ...prev, termId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">Select term</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} - {t.academicYear.name} {t.isCurrent ? "(Current)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowApplyModal(false);
                    setSelectedScholarship(null);
                  }}
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
                  {isPending ? "Applying..." : "Apply Scholarship"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
