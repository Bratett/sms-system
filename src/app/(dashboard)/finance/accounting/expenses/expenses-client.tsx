"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createExpenseAction,
  approveExpenseAction,
  rejectExpenseAction,
} from "@/modules/accounting/actions/expense.action";

import type { Monetary } from "@/lib/monetary";
interface Expense {
  id: string;
  description: string;
  amount: Monetary;
  date: Date | string;
  payee: string | null;
  referenceNumber: string | null;
  paymentMethod: string | null;
  status: string;
  expenseCategoryId: string;
  categoryName: string;
  submittedByName: string;
  approvedByName: string | null;
}

interface ExpenseCategory {
  id: string;
  name: string;
  code: string | null;
  children?: { id: string; name: string; code: string | null }[];
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function formatCurrency(amount: Monetary): string {
  return `GHS ${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_TABS = ["All", "PENDING", "APPROVED", "REJECTED", "PAID"] as const;

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700" },
  PAID: { label: "Paid", className: "bg-blue-100 text-blue-700" },
};

const CATEGORY_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-green-100 text-green-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
  "bg-amber-100 text-amber-700",
];

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "CREDIT_CARD", label: "Credit Card" },
];

export function ExpensesClient({
  expenses,
  categories,
  pagination,
}: {
  expenses: Expense[];
  categories: ExpenseCategory[];
  pagination: Pagination;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<string>("All");
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    expenseCategoryId: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    payee: "",
    referenceNumber: "",
    paymentMethod: "",
  });

  const filteredExpenses = activeTab === "All" ? expenses : expenses.filter((e) => e.status === activeTab);

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const pendingTotal = expenses.filter((e) => e.status === "PENDING").reduce((sum, e) => sum + Number(e.amount), 0);
  const approvedTotal = expenses.filter((e) => e.status === "APPROVED" || e.status === "PAID").reduce((sum, e) => sum + Number(e.amount), 0);

  const categoryColorMap = new Map<string, string>();
  categories.forEach((cat, i) => categoryColorMap.set(cat.name, CATEGORY_COLORS[i % CATEGORY_COLORS.length]));

  function resetForm() {
    setFormData({ expenseCategoryId: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], payee: "", referenceNumber: "", paymentMethod: "" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createExpenseAction({
        expenseCategoryId: formData.expenseCategoryId,
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date),
        payee: formData.payee || undefined,
        referenceNumber: formData.referenceNumber || undefined,
        paymentMethod: (formData.paymentMethod as "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "CHEQUE" | "OTHER") || undefined,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Expense created successfully");
      resetForm();
      setShowAddModal(false);
      router.refresh();
    });
  }

  function handleApprove(expenseId: string) {
    startTransition(async () => {
      const result = await approveExpenseAction(expenseId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Expense approved");
      router.refresh();
    });
  }

  function handleReject(expenseId: string) {
    startTransition(async () => {
      const result = await rejectExpenseAction(expenseId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Expense rejected");
      router.refresh();
    });
  }

  // Flatten categories for select
  const flatCategories: { id: string; name: string }[] = [];
  for (const cat of categories) {
    flatCategories.push({ id: cat.id, name: cat.name });
    if (cat.children) {
      for (const child of cat.children) {
        flatCategories.push({ id: child.id, name: `  ${cat.name} > ${child.name}` });
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Track and manage school expenditures, approvals, and payments."
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Expense
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Expenses</p>
          <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
          <p className="text-xs text-muted-foreground mt-1">{expenses.length} records</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pending Approval</p>
          <p className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">{expenses.filter((e) => e.status === "PENDING").length} pending</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Approved Total</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(approvedTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">{expenses.filter((e) => e.status === "APPROVED" || e.status === "PAID").length} approved</p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "All" ? "All" : STATUS_STYLES[tab]?.label ?? tab}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({tab === "All" ? expenses.length : expenses.filter((e) => e.status === tab).length})
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredExpenses.length === 0 ? (
        <EmptyState title="No expenses found" description={activeTab === "All" ? "Create your first expense to get started." : `No expenses with status "${activeTab}".`} />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Payee</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted By</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm">{new Date(expense.date).toLocaleDateString("en-GH")}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{expense.description}</div>
                      {expense.referenceNumber && <div className="text-xs text-muted-foreground">Ref: {expense.referenceNumber}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${categoryColorMap.get(expense.categoryName) ?? "bg-gray-100 text-gray-700"}`}>
                        {expense.categoryName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{expense.payee ?? "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium">{formatCurrency(expense.amount)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {PAYMENT_METHODS.find((m) => m.value === expense.paymentMethod)?.label ?? expense.paymentMethod ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={expense.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{expense.submittedByName}</td>
                    <td className="px-4 py-3">
                      {expense.status === "PENDING" && (
                        <div className="flex items-center gap-2">
                          <ConfirmDialog
                            title="Approve Expense"
                            description={`Are you sure you want to approve "${expense.description}" for ${formatCurrency(expense.amount)}?`}
                            onConfirm={() => handleApprove(expense.id)}
                            trigger={
                              <button
                                className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                                disabled={isPending}
                              >
                                Approve
                              </button>
                            }
                          />
                          <ConfirmDialog
                            title="Reject Expense"
                            description={`Are you sure you want to reject "${expense.description}" for ${formatCurrency(expense.amount)}? This action cannot be undone.`}
                            onConfirm={() => handleReject(expense.id)}
                            variant="destructive"
                            trigger={
                              <button
                                className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                                disabled={isPending}
                              >
                                Reject
                              </button>
                            }
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} expenses
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add Expense</h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <select
                  value={formData.expenseCategoryId}
                  onChange={(e) => setFormData({ ...formData, expenseCategoryId: e.target.value })}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a category</option>
                  {flatCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Brief description of the expense"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount (GHS) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payee</label>
                <input
                  type="text"
                  value={formData.payee}
                  onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Name of payee"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Reference Number</label>
                  <input
                    type="text"
                    value={formData.referenceNumber}
                    onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="e.g., INV-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select method</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Create Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
