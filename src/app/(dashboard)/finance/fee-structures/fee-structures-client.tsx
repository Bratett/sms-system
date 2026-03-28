"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createFeeStructureAction,
  activateFeeStructureAction,
  deleteFeeStructureAction,
} from "@/modules/finance/actions/fee-structure.action";

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface Term {
  id: string;
  academicYearId: string;
  name: string;
  isCurrent: boolean;
  academicYear: { id: string; name: string };
}

interface FeeStructure {
  id: string;
  name: string;
  academicYearId: string;
  termId: string;
  programmeId: string | null;
  boardingStatus: string | null;
  status: string;
  termName: string;
  academicYearName: string;
  programmeName: string | null;
  totalAmount: number;
  itemCount: number;
  billCount: number;
}

interface FormData {
  name: string;
  academicYearId: string;
  termId: string;
  programmeId: string;
  boardingStatus: string;
  feeItems: Array<{
    name: string;
    code: string;
    amount: string;
    isOptional: boolean;
    description: string;
  }>;
}

const emptyItem = { name: "", code: "", amount: "", isOptional: false, description: "" };

function formatCurrency(amount: number): string {
  return `GHS ${amount.toFixed(2)}`;
}

export function FeeStructuresClient({
  feeStructures,
  academicYears,
  terms,
}: {
  feeStructures: FeeStructure[];
  academicYears: AcademicYear[];
  terms: Term[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);

  const defaultYearId =
    academicYears.find((ay) => ay.isCurrent)?.id ?? academicYears[0]?.id ?? "";
  const [filterYearId, setFilterYearId] = useState<string>(defaultYearId);
  const [filterTermId, setFilterTermId] = useState<string>("all");

  const [formData, setFormData] = useState<FormData>({
    name: "",
    academicYearId: defaultYearId,
    termId: "",
    programmeId: "",
    boardingStatus: "",
    feeItems: [{ ...emptyItem }],
  });

  const filteredTerms = useMemo(() => {
    if (!filterYearId || filterYearId === "all") return terms;
    return terms.filter((t) => t.academicYearId === filterYearId);
  }, [terms, filterYearId]);

  const formTerms = useMemo(() => {
    return terms.filter((t) => t.academicYearId === formData.academicYearId);
  }, [terms, formData.academicYearId]);

  const filtered = useMemo(() => {
    let result = feeStructures;
    if (filterYearId && filterYearId !== "all") {
      result = result.filter((fs) => fs.academicYearId === filterYearId);
    }
    if (filterTermId && filterTermId !== "all") {
      result = result.filter((fs) => fs.termId === filterTermId);
    }
    return result;
  }, [feeStructures, filterYearId, filterTermId]);

  function handleCreate() {
    setFormData({
      name: "",
      academicYearId: defaultYearId,
      termId: "",
      programmeId: "",
      boardingStatus: "",
      feeItems: [{ ...emptyItem }],
    });
    setShowModal(true);
  }

  function addFeeItem() {
    setFormData((prev) => ({
      ...prev,
      feeItems: [...prev.feeItems, { ...emptyItem }],
    }));
  }

  function removeFeeItem(index: number) {
    setFormData((prev) => ({
      ...prev,
      feeItems: prev.feeItems.filter((_, i) => i !== index),
    }));
  }

  function updateFeeItem(index: number, field: string, value: string | boolean) {
    setFormData((prev) => ({
      ...prev,
      feeItems: prev.feeItems.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validItems = formData.feeItems.filter(
      (item) => item.name.trim() && parseFloat(item.amount) > 0
    );

    if (validItems.length === 0) {
      toast.error("At least one valid fee item is required");
      return;
    }

    startTransition(async () => {
      const result = await createFeeStructureAction({
        name: formData.name,
        academicYearId: formData.academicYearId,
        termId: formData.termId,
        programmeId: formData.programmeId || undefined,
        boardingStatus: formData.boardingStatus as "DAY" | "BOARDING" | undefined || undefined,
        feeItems: validItems.map((item) => ({
          name: item.name,
          code: item.code || undefined,
          amount: parseFloat(item.amount),
          isOptional: item.isOptional,
          description: item.description || undefined,
        })),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Fee structure created successfully");
      setShowModal(false);
      router.refresh();
    });
  }

  function handleActivate(fs: FeeStructure) {
    startTransition(async () => {
      const result = await activateFeeStructureAction(fs.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`"${fs.name}" activated successfully`);
      router.refresh();
    });
  }

  function handleDelete(fs: FeeStructure) {
    startTransition(async () => {
      const result = await deleteFeeStructureAction(fs.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Fee structure deleted successfully");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Structures"
        description="Define and manage fee structures for billing students."
        actions={
          <button
            onClick={handleCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Fee Structure
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Academic Year:</label>
          <select
            value={filterYearId}
            onChange={(e) => {
              setFilterYearId(e.target.value);
              setFilterTermId("all");
            }}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All</option>
            {academicYears.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.name} {ay.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Term:</label>
          <select
            value={filterTermId}
            onChange={(e) => setFilterTermId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Terms</option>
            {filteredTerms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No fee structures found"
          description="Create a fee structure to start defining fees for students."
          action={
            <button
              onClick={handleCreate}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add Fee Structure
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
                  <th className="px-4 py-3 text-left font-medium">Term</th>
                  <th className="px-4 py-3 text-left font-medium">Programme</th>
                  <th className="px-4 py-3 text-center font-medium">Boarding</th>
                  <th className="px-4 py-3 text-right font-medium">Total Amount</th>
                  <th className="px-4 py-3 text-center font-medium">Items</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((fs) => (
                  <tr
                    key={fs.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      <a
                        href={`/finance/fee-structures/${fs.id}`}
                        className="text-primary hover:underline"
                      >
                        {fs.name}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fs.termName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fs.programmeName ?? "All Programmes"}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {fs.boardingStatus ?? "All"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(fs.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-800 px-2 py-0.5 text-xs font-medium">
                        {fs.itemCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={fs.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/finance/fee-structures/${fs.id}`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </a>
                        {fs.status === "DRAFT" && (
                          <>
                            <ConfirmDialog
                              title="Activate Fee Structure"
                              description={`Are you sure you want to activate "${fs.name}"? Once activated, fee items cannot be modified and billing can begin.`}
                              onConfirm={() => handleActivate(fs)}
                              trigger={
                                <button className="text-xs text-green-600 hover:text-green-800 font-medium">
                                  Activate
                                </button>
                              }
                            />
                            <ConfirmDialog
                              title="Delete Fee Structure"
                              description={`Are you sure you want to delete "${fs.name}"? This action cannot be undone.`}
                              onConfirm={() => handleDelete(fs)}
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
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Create Fee Structure</h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">Name</label>
                <input
                  type="text"
                  placeholder="e.g. SHS 1 Term 1 Fees"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                        termId: "",
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
                <div>
                  <label className="block text-sm font-medium text-foreground">Term</label>
                  <select
                    value={formData.termId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, termId: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    <option value="">Select term</option>
                    {formTerms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Programme (optional)
                  </label>
                  <select
                    value={formData.programmeId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, programmeId: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All Programmes</option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Leave blank to apply to all programmes
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Boarding Status (optional)
                  </label>
                  <select
                    value={formData.boardingStatus}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, boardingStatus: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All (Day & Boarding)</option>
                    <option value="DAY">Day Students Only</option>
                    <option value="BOARDING">Boarding Students Only</option>
                  </select>
                </div>
              </div>

              {/* Fee Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">Fee Items</label>
                  <button
                    type="button"
                    onClick={addFeeItem}
                    className="text-xs text-primary hover:text-primary/80 font-medium"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.feeItems.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-md border border-border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Item {index + 1}
                        </span>
                        {formData.feeItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFeeItem(index)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Item name (e.g. Tuition)"
                          value={item.name}
                          onChange={(e) => updateFeeItem(index, "name", e.target.value)}
                          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Code (optional)"
                          value={item.code}
                          onChange={(e) => updateFeeItem(index, "code", e.target.value)}
                          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <input
                          type="number"
                          placeholder="Amount (GHS)"
                          step="0.01"
                          min="0.01"
                          value={item.amount}
                          onChange={(e) => updateFeeItem(index, "amount", e.target.value)}
                          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          required
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.isOptional}
                            onChange={(e) =>
                              updateFeeItem(index, "isOptional", e.target.checked)
                            }
                            className="h-4 w-4 rounded text-primary focus:ring-primary"
                          />
                          Optional
                        </label>
                        <input
                          type="text"
                          placeholder="Description (optional)"
                          value={item.description}
                          onChange={(e) =>
                            updateFeeItem(index, "description", e.target.value)
                          }
                          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
