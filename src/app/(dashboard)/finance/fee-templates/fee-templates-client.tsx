"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createFeeTemplateAction,
  updateFeeTemplateAction,
  deleteFeeTemplateAction,
  createFeeStructureFromTemplateAction,
} from "@/modules/finance/actions/fee-template.action";

import type { Monetary } from "@/lib/monetary";
interface FeeTemplateItem {
  id: string;
  feeTemplateId: string;
  name: string;
  code: string | null;
  amount: Monetary;
  isOptional: boolean;
  description: string | null;
}

interface FeeTemplate {
  id: string;
  schoolId: string;
  name: string;
  description: string | null;
  boardingStatus: string | null;
  programmeId: string | null;
  programmeName: string | null;
  isActive: boolean;
  items: FeeTemplateItem[];
  itemCount: number;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Programme {
  id: string;
  name: string;
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

interface FeeItemFormData {
  name: string;
  code: string;
  amount: number;
  isOptional: boolean;
  description: string;
}

interface TemplateFormData {
  name: string;
  description: string;
  boardingStatus: string;
  programmeId: string;
  items: FeeItemFormData[];
}

interface CreateStructureFormData {
  name: string;
  academicYearId: string;
  termId: string;
  adjustments: { itemName: string; newAmount: number }[];
}

function formatCurrency(amount: Monetary): string {
  return `GHS ${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const emptyItem: FeeItemFormData = {
  name: "",
  code: "",
  amount: 0,
  isOptional: false,
  description: "",
};

export function FeeTemplatesClient({
  templates,
  programmes,
  academicYears,
  terms,
}: {
  templates: FeeTemplate[];
  programmes: Programme[];
  academicYears: AcademicYear[];
  terms: Term[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FeeTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<FeeTemplate | null>(null);

  const [formData, setFormData] = useState<TemplateFormData>({
    name: "",
    description: "",
    boardingStatus: "",
    programmeId: "",
    items: [{ ...emptyItem }],
  });

  const [structureData, setStructureData] = useState<CreateStructureFormData>({
    name: "",
    academicYearId: "",
    termId: "",
    adjustments: [],
  });

  function handleCreate() {
    setEditingTemplate(null);
    setFormData({
      name: "",
      description: "",
      boardingStatus: "",
      programmeId: "",
      items: [{ ...emptyItem }],
    });
    setShowModal(true);
  }

  function handleEdit(template: FeeTemplate) {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description ?? "",
      boardingStatus: template.boardingStatus ?? "",
      programmeId: template.programmeId ?? "",
      items: template.items.length > 0
        ? template.items.map((item) => ({
            name: item.name,
            code: item.code ?? "",
            amount: Number(item.amount),
            isOptional: item.isOptional,
            description: item.description ?? "",
          }))
        : [{ ...emptyItem }],
    });
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingTemplate(null);
  }

  function handleAddItem() {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { ...emptyItem }],
    }));
  }

  function handleRemoveItem(index: number) {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  function handleItemChange(index: number, field: keyof FeeItemFormData, value: string | number | boolean) {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (formData.items.length === 0) {
      toast.error("Please add at least one fee item");
      return;
    }
    for (const item of formData.items) {
      if (!item.name || !item.code || item.amount <= 0) {
        toast.error("Each fee item must have a name, code, and amount greater than 0");
        return;
      }
    }
    startTransition(async () => {
      if (editingTemplate) {
        const result = await updateFeeTemplateAction(editingTemplate.id, {
          name: formData.name,
          description: formData.description || undefined,
          boardingStatus: (formData.boardingStatus as "DAY" | "BOARDING") || undefined,
          programmeId: formData.programmeId || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Fee template updated successfully");
      } else {
        const result = await createFeeTemplateAction({
          name: formData.name,
          description: formData.description || undefined,
          boardingStatus: (formData.boardingStatus as "DAY" | "BOARDING") || undefined,
          programmeId: formData.programmeId || undefined,
          items: formData.items.map((item) => ({
            name: item.name,
            code: item.code,
            amount: item.amount,
            isOptional: item.isOptional,
            description: item.description || undefined,
          })),
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Fee template created successfully");
      }
      setShowModal(false);
      setEditingTemplate(null);
      router.refresh();
    });
  }

  function handleCreateStructureOpen(template: FeeTemplate) {
    setSelectedTemplate(template);
    setStructureData({
      name: `${template.name} - Fee Structure`,
      academicYearId: academicYears.find((ay) => ay.isCurrent)?.id ?? "",
      termId: terms.find((t) => t.isCurrent)?.id ?? "",
      adjustments: template.items.map((item) => ({
        itemName: item.name,
        newAmount: Number(item.amount),
      })),
    });
    setShowStructureModal(true);
  }

  function handleStructureSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate || !structureData.academicYearId || !structureData.termId) {
      toast.error("Please select an academic year and term");
      return;
    }
    startTransition(async () => {
      const result = await createFeeStructureFromTemplateAction({
        feeTemplateId: selectedTemplate!.id,
        name: structureData.name,
        academicYearId: structureData.academicYearId,
        termId: structureData.termId,
        adjustments: structureData.adjustments,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Fee structure created from template successfully");
      setShowStructureModal(false);
      setSelectedTemplate(null);
      router.refresh();
    });
  }

  function handleToggleActive(template: FeeTemplate) {
    startTransition(async () => {
      const result = await updateFeeTemplateAction(template.id, {
        isActive: !template.isActive,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        template.isActive
          ? "Fee template deactivated"
          : "Fee template activated"
      );
      router.refresh();
    });
  }

  function handleDelete(template: FeeTemplate) {
    startTransition(async () => {
      const result = await deleteFeeTemplateAction(template.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Fee template deleted successfully");
      router.refresh();
    });
  }

  const filteredTerms = structureData.academicYearId
    ? terms.filter((t) => t.academicYearId === structureData.academicYearId)
    : terms;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Templates"
        description="Create reusable fee templates to quickly generate fee structures each term."
        actions={
          <button
            onClick={handleCreate}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Template
          </button>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          title="No fee templates found"
          description="Create your first fee template to streamline fee structure creation."
          action={
            <button
              onClick={handleCreate}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create Template
            </button>
          }
        />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Boarding Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Programme</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Items</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Total</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr
                    key={template.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-sm font-medium">{template.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                      {template.description || "---"}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {template.boardingStatus ? (
                        <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-xs font-medium">
                          {template.boardingStatus}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">All</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {template.programmeName || <span className="text-muted-foreground">All</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-800 px-2 py-0.5 text-xs font-medium">
                        {template.itemCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono">
                      {formatCurrency(template.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={template.isActive ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-xs text-green-600 hover:text-green-800 font-medium"
                          onClick={() => handleCreateStructureOpen(template)}
                          disabled={isPending}
                        >
                          Create Structure
                        </button>
                        <button
                          className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                          onClick={() => handleToggleActive(template)}
                          disabled={isPending}
                        >
                          {template.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => handleEdit(template)}
                          disabled={isPending}
                        >
                          Edit
                        </button>
                        <ConfirmDialog
                          title="Delete Fee Template"
                          description={`Are you sure you want to delete "${template.name}"? This action cannot be undone.`}
                          onConfirm={() => handleDelete(template)}
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

      {/* Create/Edit Fee Template Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">
              {editingTemplate ? "Edit Fee Template" : "Create Fee Template"}
            </h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Day Student Fees - JHS"
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
                  Description
                </label>
                <textarea
                  placeholder="Describe this fee template..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={2}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Boarding Status
                  </label>
                  <select
                    value={formData.boardingStatus}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, boardingStatus: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All Students</option>
                    <option value="DAY">Day</option>
                    <option value="BOARDING">Boarding</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Programme
                  </label>
                  <select
                    value={formData.programmeId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, programmeId: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All Programmes</option>
                    {programmes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fee Items */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-foreground">
                    Fee Items <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-medium text-primary hover:text-primary/80"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="mt-2 space-y-3">
                  {formData.items.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-md border border-border bg-muted/30 p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Item {index + 1}
                        </span>
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Item name *"
                          value={item.name}
                          onChange={(e) => handleItemChange(index, "name", e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Code *"
                          value={item.code}
                          onChange={(e) => handleItemChange(index, "code", e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          required
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Amount (GHS) *"
                          value={item.amount || ""}
                          onChange={(e) =>
                            handleItemChange(index, "amount", parseFloat(e.target.value) || 0)
                          }
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          required
                        />
                        <div className="flex items-center gap-2 px-3">
                          <input
                            type="checkbox"
                            id={`optional-${index}`}
                            checked={item.isOptional}
                            onChange={(e) =>
                              handleItemChange(index, "isOptional", e.target.checked)
                            }
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <label
                            htmlFor={`optional-${index}`}
                            className="text-sm text-muted-foreground cursor-pointer"
                          >
                            Optional
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {formData.items.length > 0 && (
                  <div className="mt-2 text-right text-sm font-medium">
                    Total:{" "}
                    {formatCurrency(
                      formData.items.reduce((sum, item) => sum + (item.amount || 0), 0)
                    )}
                  </div>
                )}
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
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending
                    ? "Saving..."
                    : editingTemplate
                      ? "Update Template"
                      : "Create Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Fee Structure from Template Modal */}
      {showStructureModal && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">
              Create Fee Structure from Template
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Using template: {selectedTemplate.name}
            </p>
            <form onSubmit={handleStructureSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Structure Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Term 1 - Day Student Fees"
                  value={structureData.name}
                  onChange={(e) =>
                    setStructureData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Academic Year <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={structureData.academicYearId}
                    onChange={(e) =>
                      setStructureData((prev) => ({
                        ...prev,
                        academicYearId: e.target.value,
                        termId: "",
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    <option value="">Select academic year</option>
                    {academicYears.map((ay) => (
                      <option key={ay.id} value={ay.id}>
                        {ay.name} {ay.isCurrent ? "(Current)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Term <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={structureData.termId}
                    onChange={(e) =>
                      setStructureData((prev) => ({ ...prev, termId: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    <option value="">Select term</option>
                    {filteredTerms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} - {t.academicYear.name} {t.isCurrent ? "(Current)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Adjust Amounts */}
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Fee Items (adjust amounts if needed)
                </label>
                <div className="mt-2 space-y-2">
                  {structureData.adjustments.map((adj, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
                    >
                      <span className="flex-1 text-sm">{adj.itemName}</span>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          GHS
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={adj.newAmount || ""}
                          onChange={(e) => {
                            const newAdj = [...structureData.adjustments];
                            newAdj[index] = {
                              ...newAdj[index],
                              newAmount: parseFloat(e.target.value) || 0,
                            };
                            setStructureData((prev) => ({
                              ...prev,
                              adjustments: newAdj,
                            }));
                          }}
                          className="w-36 rounded-md border border-border bg-background pl-10 pr-3 py-1.5 text-sm text-right focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {structureData.adjustments.length > 0 && (
                  <div className="mt-2 text-right text-sm font-medium">
                    Total:{" "}
                    {formatCurrency(
                      structureData.adjustments.reduce(
                        (sum, adj) => sum + (adj.newAmount || 0),
                        0
                      )
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowStructureModal(false);
                    setSelectedTemplate(null);
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Create Fee Structure"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
