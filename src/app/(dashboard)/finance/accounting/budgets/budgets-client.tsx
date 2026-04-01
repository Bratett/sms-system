"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createBudgetAction,
  approveBudgetAction,
  getBudgetVsActualAction,
} from "@/modules/accounting/actions/budget.action";

interface BudgetLine {
  id: string;
  expenseCategoryId: string;
  allocatedAmount: number;
  spentAmount: number;
  description: string | null;
  expenseCategory: { name: string };
}

interface Budget {
  id: string;
  name: string;
  academicYearId: string;
  academicYearName: string;
  termId: string | null;
  termName: string | null;
  totalAmount: number;
  totalAllocated: number;
  totalSpent: number;
  utilization: number;
  status: string;
  lines: BudgetLine[];
}

interface ExpenseCategory { id: string; name: string; children?: { id: string; name: string }[]; }
interface AcademicYear { id: string; name: string; isCurrent: boolean; }
interface Term { id: string; name: string; academicYearId: string; isCurrent: boolean; }

interface BudgetLineForm { expenseCategoryId: string; allocatedAmount: number; description: string; }

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BudgetsClient({
  budgets, expenseCategories, academicYears, terms,
}: {
  budgets: Budget[];
  expenseCategories: ExpenseCategory[];
  academicYears: AcademicYear[];
  terms: Term[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [budgetDetail, setBudgetDetail] = useState<{ lines: { category: string; allocated: number; spent: number; utilization: number; isOverBudget: boolean }[] } | null>(null);

  const [formData, setFormData] = useState({
    name: "", academicYearId: academicYears.find((ay) => ay.isCurrent)?.id ?? "",
    termId: "",
  });
  const [lineItems, setLineItems] = useState<BudgetLineForm[]>([
    { expenseCategoryId: "", allocatedAmount: 0, description: "" },
  ]);

  const allCategories = expenseCategories.flatMap((c) => [
    { id: c.id, name: c.name },
    ...(c.children ?? []).map((ch) => ({ id: ch.id, name: `  ${c.name} > ${ch.name}` })),
  ]);

  function addLine() {
    setLineItems([...lineItems, { expenseCategoryId: "", allocatedAmount: 0, description: "" }]);
  }

  function removeLine(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof BudgetLineForm, value: string | number) {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  }

  const totalAllocated = lineItems.reduce((sum, l) => sum + Number(l.allocatedAmount), 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validLines = lineItems.filter((l) => l.expenseCategoryId && l.allocatedAmount > 0);
    if (validLines.length === 0) { toast.error("Add at least one budget line"); return; }

    startTransition(async () => {
      const result = await createBudgetAction({
        name: formData.name,
        academicYearId: formData.academicYearId,
        termId: formData.termId || undefined,
        lines: validLines,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Budget created");
      setShowCreateModal(false);
      router.refresh();
    });
  }

  function handleApprove(budget: Budget) {
    startTransition(async () => {
      const result = await approveBudgetAction(budget.id);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Budget approved");
      router.refresh();
    });
  }

  function handleExpand(budgetId: string) {
    if (expandedId === budgetId) { setExpandedId(null); setBudgetDetail(null); return; }
    startTransition(async () => {
      const result = await getBudgetVsActualAction(budgetId);
      if (result.data) setBudgetDetail({ lines: result.data.lines });
      setExpandedId(budgetId);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Budgets" description="Create and track budgets against actual expenditure"
        actions={<button onClick={() => setShowCreateModal(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Create Budget</button>}
      />

      {budgets.length === 0 ? (
        <EmptyState title="No budgets" description="Create a budget to track spending against allocations." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Year / Term</th>
                  <th className="px-4 py-3">Allocated</th>
                  <th className="px-4 py-3">Spent</th>
                  <th className="px-4 py-3">Utilization</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {budgets.map((budget) => (
                  <>
                    <tr key={budget.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium">{budget.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {budget.academicYearName}{budget.termName ? ` / ${budget.termName}` : " (Annual)"}
                      </td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(budget.totalAllocated)}</td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(budget.totalSpent)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 rounded-full bg-gray-200">
                            <div className={`h-2 rounded-full ${budget.utilization > 100 ? "bg-red-500" : budget.utilization > 80 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${Math.min(budget.utilization, 100)}%` }} />
                          </div>
                          <span className="text-xs">{budget.utilization.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={budget.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleExpand(budget.id)} className="text-xs text-primary hover:underline">
                            {expandedId === budget.id ? "Hide" : "Details"}
                          </button>
                          {budget.status === "DRAFT" && (
                            <ConfirmDialog title="Approve Budget" description={`Approve "${budget.name}" (${formatCurrency(budget.totalAllocated)})?`} onConfirm={() => handleApprove(budget)}
                              trigger={<button className="text-xs text-green-600 hover:underline">Approve</button>}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === budget.id && budgetDetail && (
                      <tr key={`${budget.id}-detail`}>
                        <td colSpan={7} className="bg-muted/30 px-4 py-3">
                          <p className="text-sm font-medium mb-2">Budget vs Actual</p>
                          <table className="min-w-full divide-y divide-border">
                            <thead>
                              <tr className="text-left text-xs uppercase text-muted-foreground">
                                <th className="px-3 py-2">Category</th>
                                <th className="px-3 py-2">Allocated</th>
                                <th className="px-3 py-2">Spent</th>
                                <th className="px-3 py-2">Utilization</th>
                                <th className="px-3 py-2">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {budgetDetail.lines.map((line, i) => (
                                <tr key={i}>
                                  <td className="px-3 py-2 text-sm">{line.category}</td>
                                  <td className="px-3 py-2 text-sm">{formatCurrency(line.allocated)}</td>
                                  <td className="px-3 py-2 text-sm">{formatCurrency(line.spent)}</td>
                                  <td className="px-3 py-2 text-sm">{line.utilization.toFixed(0)}%</td>
                                  <td className="px-3 py-2">
                                    {line.isOverBudget ? (
                                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">Over Budget</span>
                                    ) : (
                                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">On Track</span>
                                    )}
                                  </td>
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

      {/* Create Budget Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create Budget</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Budget Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g., Term 1 Operating Budget" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Academic Year *</label>
                  <select value={formData.academicYearId} onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Select Year</option>
                    {academicYears.map((ay) => (<option key={ay.id} value={ay.id}>{ay.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Term</label>
                  <select value={formData.termId} onChange={(e) => setFormData({ ...formData, termId: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Annual Budget</option>
                    {terms.filter((t) => !formData.academicYearId || t.academicYearId === formData.academicYearId).map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Budget Lines</label>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Total: {formatCurrency(totalAllocated)}</span>
                    <button type="button" onClick={addLine} className="text-xs text-primary hover:underline">+ Add Line</button>
                  </div>
                </div>
                <div className="space-y-2">
                  {lineItems.map((line, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end rounded-lg border border-border p-3">
                      <div className="col-span-5">
                        <label className="block text-xs text-muted-foreground mb-1">Category</label>
                        <select value={line.expenseCategoryId} onChange={(e) => updateLine(index, "expenseCategoryId", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
                          <option value="">Select category</option>
                          {allCategories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs text-muted-foreground mb-1">Amount (GHS)</label>
                        <input type="number" value={line.allocatedAmount} onChange={(e) => updateLine(index, "allocatedAmount", parseFloat(e.target.value) || 0)} min="0" step="0.01" className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs text-muted-foreground mb-1">Description</label>
                        <input type="text" value={line.description} onChange={(e) => updateLine(index, "description", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {lineItems.length > 1 && (
                          <button type="button" onClick={() => removeLine(index)} className="text-red-500 hover:text-red-700 text-sm">&times;</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {isPending ? "Creating..." : "Create Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
