"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createInstallmentPlanAction,
  updateInstallmentPlanAction,
  deleteInstallmentPlanAction,
} from "@/modules/finance/actions/installment.action";

import type { Monetary } from "@/lib/monetary";
interface Schedule {
  installmentNumber: number;
  percentageOfTotal: Monetary;
  dueDaysFromStart: number;
  label: string | null;
}

interface Plan {
  id: string;
  name: string;
  feeStructureId: string | null;
  feeStructureName: string | null;
  numberOfInstallments: number;
  isActive: boolean;
  schedules: Schedule[];
  studentCount: number;
}

interface FeeStructure {
  id: string;
  name: string;
  totalAmount: number;
}

interface ScheduleFormItem {
  installmentNumber: number;
  percentageOfTotal: number;
  dueDaysFromStart: number;
  label: string;
}

function formatCurrency(amount: Monetary): string {
  return `GHS ${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InstallmentsClient({
  plans,
  feeStructures,
}: {
  plans: Plan[];
  feeStructures: FeeStructure[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    feeStructureId: "",
    numberOfInstallments: 2,
  });
  const [schedules, setSchedules] = useState<ScheduleFormItem[]>([
    { installmentNumber: 1, percentageOfTotal: 50, dueDaysFromStart: 30, label: "1st Installment" },
    { installmentNumber: 2, percentageOfTotal: 50, dueDaysFromStart: 60, label: "2nd Installment" },
  ]);

  function generateDefaultSchedules(count: number) {
    const pct = Math.floor(100 / count);
    const remainder = 100 - pct * count;
    const ordinals = ["1st", "2nd", "3rd", "4th", "5th", "6th"];
    return Array.from({ length: count }, (_, i) => ({
      installmentNumber: i + 1,
      percentageOfTotal: i === count - 1 ? pct + remainder : pct,
      dueDaysFromStart: (i + 1) * 30,
      label: `${ordinals[i] ?? `${i + 1}th`} Installment`,
    }));
  }

  function handleNumberChange(count: number) {
    if (count < 2 || count > 6) return;
    setFormData({ ...formData, numberOfInstallments: count });
    setSchedules(generateDefaultSchedules(count));
  }

  function handleScheduleChange(index: number, field: keyof ScheduleFormItem, value: string | number) {
    const updated = [...schedules];
    updated[index] = { ...updated[index], [field]: value };
    setSchedules(updated);
  }

  const totalPercentage = schedules.reduce((sum, s) => sum + Number(s.percentageOfTotal), 0);

  function handleOpenCreate() {
    setFormData({ name: "", feeStructureId: "", numberOfInstallments: 2 });
    setSchedules(generateDefaultSchedules(2));
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast.error("Installment percentages must sum to 100%");
      return;
    }
    startTransition(async () => {
      const result = await createInstallmentPlanAction({
        name: formData.name,
        feeStructureId: formData.feeStructureId || undefined,
        numberOfInstallments: formData.numberOfInstallments,
        schedules: schedules.map((s) => ({
          installmentNumber: s.installmentNumber,
          percentageOfTotal: Number(s.percentageOfTotal),
          dueDaysFromStart: Number(s.dueDaysFromStart),
          label: s.label || undefined,
        })),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Installment plan created successfully");
      setShowModal(false);
      router.refresh();
    });
  }

  function handleToggleActive(plan: Plan) {
    startTransition(async () => {
      const result = await updateInstallmentPlanAction(plan.id, { isActive: !plan.isActive });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Plan ${plan.isActive ? "deactivated" : "activated"}`);
      router.refresh();
    });
  }

  function handleDelete(plan: Plan) {
    startTransition(async () => {
      const result = await deleteInstallmentPlanAction(plan.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Installment plan deleted");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Installment Plans"
        description="Configure payment installment schedules for student fees"
        actions={
          <button
            onClick={handleOpenCreate}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Plan
          </button>
        }
      />

      {plans.length === 0 ? (
        <EmptyState
          title="No installment plans"
          description="Create installment plans to allow students to pay fees in multiple installments."
        />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Fee Structure</th>
                  <th className="px-4 py-3">Installments</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Students</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans.map((plan) => (
                  <>
                    <tr key={plan.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium">{plan.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {plan.feeStructureName ?? "All Structures"}
                      </td>
                      <td className="px-4 py-3 text-sm">{plan.numberOfInstallments}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {plan.schedules.map((s) => `${s.percentageOfTotal}%`).join(" / ")}
                      </td>
                      <td className="px-4 py-3 text-sm">{plan.studentCount}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={plan.isActive ? "ACTIVE" : "INACTIVE"} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)
                            }
                            className="text-sm text-primary hover:underline"
                          >
                            {expandedPlanId === plan.id ? "Hide" : "Details"}
                          </button>
                          <button
                            onClick={() => handleToggleActive(plan)}
                            disabled={isPending}
                            className="text-sm text-muted-foreground hover:text-foreground"
                          >
                            {plan.isActive ? "Deactivate" : "Activate"}
                          </button>
                          {plan.studentCount === 0 && (
                            <ConfirmDialog
                              title="Delete Plan"
                              description={`Are you sure you want to delete "${plan.name}"?`}
                              onConfirm={() => handleDelete(plan)}
                              variant="destructive"
                              trigger={
                                <button className="text-sm text-red-500 hover:text-red-700">
                                  Delete
                                </button>
                              }
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedPlanId === plan.id && (
                      <tr key={`${plan.id}-detail`}>
                        <td colSpan={7} className="bg-muted/30 px-4 py-3">
                          <div className="text-sm font-medium mb-2">Payment Schedule</div>
                          <table className="min-w-full divide-y divide-border">
                            <thead>
                              <tr className="text-left text-xs font-medium uppercase text-muted-foreground">
                                <th className="px-3 py-2">#</th>
                                <th className="px-3 py-2">Label</th>
                                <th className="px-3 py-2">Percentage</th>
                                <th className="px-3 py-2">Due (days from term start)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {plan.schedules.map((s) => (
                                <tr key={s.installmentNumber}>
                                  <td className="px-3 py-2 text-sm">{s.installmentNumber}</td>
                                  <td className="px-3 py-2 text-sm">{s.label ?? `Installment ${s.installmentNumber}`}</td>
                                  <td className="px-3 py-2 text-sm">{Number(s.percentageOfTotal)}%</td>
                                  <td className="px-3 py-2 text-sm">{s.dueDaysFromStart} days</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create Installment Plan</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Plan Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="e.g., Three-Part Payment Plan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Fee Structure (Optional)</label>
                <select
                  value={formData.feeStructureId}
                  onChange={(e) => setFormData({ ...formData, feeStructureId: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">All Structures</option>
                  {feeStructures.map((fs) => (
                    <option key={fs.id} value={fs.id}>
                      {fs.name} ({formatCurrency(fs.totalAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Number of Installments *</label>
                <select
                  value={formData.numberOfInstallments}
                  onChange={(e) => handleNumberChange(parseInt(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} Installments
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Payment Schedule</label>
                  <span
                    className={`text-sm font-medium ${Math.abs(totalPercentage - 100) < 0.01 ? "text-green-600" : "text-red-600"}`}
                  >
                    Total: {totalPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-2">
                  {schedules.map((schedule, index) => (
                    <div
                      key={schedule.installmentNumber}
                      className="grid grid-cols-4 gap-2 items-end rounded-lg border border-border p-3"
                    >
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Label</label>
                        <input
                          type="text"
                          value={schedule.label}
                          onChange={(e) => handleScheduleChange(index, "label", e.target.value)}
                          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Percentage (%)</label>
                        <input
                          type="number"
                          value={schedule.percentageOfTotal}
                          onChange={(e) =>
                            handleScheduleChange(index, "percentageOfTotal", parseFloat(e.target.value) || 0)
                          }
                          min="1"
                          max="100"
                          step="0.1"
                          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Due (days)</label>
                        <input
                          type="number"
                          value={schedule.dueDaysFromStart}
                          onChange={(e) =>
                            handleScheduleChange(index, "dueDaysFromStart", parseInt(e.target.value) || 0)
                          }
                          min="0"
                          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground pt-5">
                        #{schedule.installmentNumber}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || Math.abs(totalPercentage - 100) > 0.01}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
