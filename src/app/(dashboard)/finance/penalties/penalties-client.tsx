"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  getLatePenaltyRulesAction,
  createLatePenaltyRuleAction,
  updateLatePenaltyRuleAction,
  deleteLatePenaltyRuleAction,
  applyPenaltiesAction,
} from "@/modules/finance/actions/penalty.action";

interface PenaltyRule {
  id: string;
  name: string;
  type: string;
  value: number;
  gracePeriodDays: number;
  maxPenalty: number | null;
  feeStructureId: string | null;
  feeStructureName: string | null;
  appliedCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface FeeStructure {
  id: string;
  name: string;
  status: string;
}

type PenaltyType = "PERCENTAGE" | "FIXED_AMOUNT" | "DAILY_PERCENTAGE" | "DAILY_FIXED";

interface PenaltyFormData {
  name: string;
  type: PenaltyType;
  value: number;
  gracePeriodDays: number;
  maxPenalty: string;
  feeStructureId: string;
}

const TYPE_BADGES: Record<PenaltyType, { label: string; className: string }> = {
  PERCENTAGE: { label: "Percentage", className: "bg-blue-100 text-blue-700" },
  FIXED_AMOUNT: { label: "Fixed Amount", className: "bg-green-100 text-green-700" },
  DAILY_PERCENTAGE: { label: "Daily Percentage", className: "bg-purple-100 text-purple-700" },
  DAILY_FIXED: { label: "Daily Fixed", className: "bg-orange-100 text-orange-700" },
};

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getValueLabel(type: PenaltyType): string {
  return type === "PERCENTAGE" || type === "DAILY_PERCENTAGE" ? "%" : "GHS";
}

const DEFAULT_FORM: PenaltyFormData = {
  name: "",
  type: "PERCENTAGE",
  value: 0,
  gracePeriodDays: 0,
  maxPenalty: "",
  feeStructureId: "",
};

export function PenaltiesClient({
  penaltyRules,
  feeStructures,
}: {
  penaltyRules: PenaltyRule[];
  feeStructures: FeeStructure[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PenaltyRule | null>(null);
  const [showApplyResults, setShowApplyResults] = useState(false);
  const [applyResults, setApplyResults] = useState<{ applied: number; skipped: number } | null>(null);

  const [formData, setFormData] = useState<PenaltyFormData>(DEFAULT_FORM);

  function handleCreate() {
    setEditingRule(null);
    setFormData(DEFAULT_FORM);
    setShowModal(true);
  }

  function handleEdit(rule: PenaltyRule) {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      type: rule.type as PenaltyType,
      value: rule.value,
      gracePeriodDays: rule.gracePeriodDays,
      maxPenalty: rule.maxPenalty != null ? String(rule.maxPenalty) : "",
      feeStructureId: rule.feeStructureId ?? "",
    });
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingRule(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        name: formData.name,
        type: formData.type,
        value: formData.value,
        gracePeriodDays: formData.gracePeriodDays,
        maxPenalty: formData.maxPenalty ? parseFloat(formData.maxPenalty) : undefined,
        feeStructureId: formData.feeStructureId || undefined,
      };

      if (editingRule) {
        const result = await updateLatePenaltyRuleAction(editingRule.id, payload);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Penalty rule updated successfully");
      } else {
        const result = await createLatePenaltyRuleAction(payload);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Penalty rule created successfully");
      }
      setShowModal(false);
      setEditingRule(null);
      router.refresh();
    });
  }

  function handleDelete(rule: PenaltyRule) {
    startTransition(async () => {
      const result = await deleteLatePenaltyRuleAction(rule.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Penalty rule deleted successfully");
      router.refresh();
    });
  }

  function handleToggleStatus(rule: PenaltyRule) {
    startTransition(async () => {
      const result = await updateLatePenaltyRuleAction(rule.id, { isActive: !rule.isActive });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Rule ${rule.isActive ? "deactivated" : "activated"} successfully`);
      router.refresh();
    });
  }

  function handleApplyPenalties() {
    startTransition(async () => {
      const result = await applyPenaltiesAction();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const data = result.data as { applied: number; skipped: number };
      setApplyResults(data);
      setShowApplyResults(true);
      toast.success(`Penalties applied: ${data.applied} applied, ${data.skipped} skipped`);
      router.refresh();
    });
  }

  function formatValue(rule: PenaltyRule): string {
    if (rule.type === "PERCENTAGE" || rule.type === "DAILY_PERCENTAGE") {
      return `${rule.value}%`;
    }
    return formatCurrency(rule.value);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Late Penalties"
        description="Configure penalty rules for late fee payments and apply them to outstanding balances."
        actions={
          <div className="flex items-center gap-3">
            <ConfirmDialog
              title="Apply Penalties Now"
              description="This will apply all active penalty rules to outstanding balances that have exceeded their grace period. This action cannot be undone."
              onConfirm={handleApplyPenalties}
              variant="destructive"
              trigger={
                <button
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                  disabled={isPending}
                >
                  Apply Penalties Now
                </button>
              }
            />
            <button
              onClick={handleCreate}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Create Rule
            </button>
          </div>
        }
      />

      {penaltyRules.length === 0 ? (
        <EmptyState
          title="No penalty rules found"
          description="Create your first late penalty rule to get started."
          action={
            <button
              onClick={handleCreate}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Create Rule
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
                  <th className="px-4 py-3 text-center text-sm font-medium">Type</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Value</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Grace Period</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Max Penalty</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Fee Structure</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Applied</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {penaltyRules.map((rule) => {
                  const badge = TYPE_BADGES[rule.type as PenaltyType] ?? {
                    label: rule.type,
                    className: "bg-gray-100 text-gray-700",
                  };
                  return (
                    <tr
                      key={rule.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-sm font-medium">{rule.name}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatValue(rule)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                        {rule.gracePeriodDays} {rule.gracePeriodDays === 1 ? "day" : "days"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {rule.maxPenalty != null ? formatCurrency(rule.maxPenalty) : "---"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {rule.feeStructureName ?? "All Structures"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-800 px-2 py-0.5 text-xs font-medium">
                          {rule.appliedCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={rule.isActive ? "ACTIVE" : "INACTIVE"} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                            onClick={() => handleToggleStatus(rule)}
                            disabled={isPending}
                          >
                            {rule.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            onClick={() => handleEdit(rule)}
                          >
                            Edit
                          </button>
                          {rule.appliedCount === 0 && (
                            <ConfirmDialog
                              title="Delete Penalty Rule"
                              description={`Are you sure you want to delete "${rule.name}"? This action cannot be undone.`}
                              onConfirm={() => handleDelete(rule)}
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
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Penalty Rule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">
              {editingRule ? "Edit Penalty Rule" : "Create Penalty Rule"}
            </h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Standard Late Fee"
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
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, type: e.target.value as PenaltyType }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED_AMOUNT">Fixed Amount</option>
                  <option value="DAILY_PERCENTAGE">Daily Percentage</option>
                  <option value="DAILY_FIXED">Daily Fixed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">
                  Value ({getValueLabel(formData.type)}) <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={
                      formData.type === "PERCENTAGE" || formData.type === "DAILY_PERCENTAGE"
                        ? 100
                        : undefined
                    }
                    placeholder={
                      formData.type === "PERCENTAGE" || formData.type === "DAILY_PERCENTAGE"
                        ? "e.g. 5"
                        : "e.g. 50.00"
                    }
                    value={formData.value || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        value: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {getValueLabel(formData.type)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">
                  Grace Period Days
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={formData.gracePeriodDays}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      gracePeriodDays: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Number of days after the due date before penalties start
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">
                  Max Penalty Cap (GHS)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                  value={formData.maxPenalty}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, maxPenalty: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Maximum penalty amount that can be charged (leave empty for no cap)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">
                  Fee Structure
                </label>
                <select
                  value={formData.feeStructureId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, feeStructureId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Structures</option>
                  {feeStructures.map((fs) => (
                    <option key={fs.id} value={fs.id}>
                      {fs.name}
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
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending
                    ? "Saving..."
                    : editingRule
                      ? "Update Rule"
                      : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Apply Results Modal */}
      {showApplyResults && applyResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Penalties Applied</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-md bg-green-50 px-4 py-3">
                <span className="text-sm font-medium text-green-800">Applied</span>
                <span className="text-lg font-bold text-green-700">{applyResults.applied}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-gray-50 px-4 py-3">
                <span className="text-sm font-medium text-gray-600">Skipped</span>
                <span className="text-lg font-bold text-gray-700">{applyResults.skipped}</span>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowApplyResults(false);
                  setApplyResults(null);
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
