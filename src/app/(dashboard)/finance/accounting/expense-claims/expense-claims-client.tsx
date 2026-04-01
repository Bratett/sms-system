"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  submitExpenseClaimAction,
  approveExpenseClaimAction,
  rejectExpenseClaimAction,
  markClaimPaidAction,
} from "@/modules/accounting/actions/expense-claim.action";

import type { Monetary } from "@/lib/monetary";
interface ClaimItem { id: string; description: string; amount: Monetary; date: Date | string; receiptUrl: string | null; }
interface Claim {
  id: string;
  claimantId: string;
  claimantName: string;
  description: string;
  totalAmount: Monetary;
  status: string;
  submittedAt: Date | string;
  approvedByName: string | null;
  approvedAt: Date | string | null;
  paidAt: Date | string | null;
  itemCount: number;
  items: ClaimItem[];
}

interface Pagination { page: number; pageSize: number; total: number; totalPages: number; }
interface ExpenseCategory { id: string; name: string; children?: { id: string; name: string }[]; }

type StatusFilter = "ALL" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";

interface ClaimItemForm { description: string; amount: number; date: string; expenseCategoryId: string; }

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: "Submitted", className: "bg-gray-100 text-gray-700" },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700" },
  PAID: { label: "Paid", className: "bg-blue-100 text-blue-700" },
};

function formatCurrency(amount: Monetary): string {
  return `GHS ${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ExpenseClaimsClient({
  claims, pagination, expenseCategories,
}: {
  claims: Claim[];
  pagination: Pagination;
  expenseCategories: ExpenseCategory[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [description, setDescription] = useState("");
  const [claimItems, setClaimItems] = useState<ClaimItemForm[]>([
    { description: "", amount: 0, date: new Date().toISOString().split("T")[0], expenseCategoryId: "" },
  ]);

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return claims;
    return claims.filter((c) => c.status === statusFilter);
  }, [claims, statusFilter]);

  const totalClaimed = claims.reduce((sum, c) => sum + Number(c.totalAmount), 0);
  const pendingCount = claims.filter((c) => c.status === "SUBMITTED").length;

  function addItem() {
    setClaimItems([...claimItems, { description: "", amount: 0, date: new Date().toISOString().split("T")[0], expenseCategoryId: "" }]);
  }
  function removeItem(i: number) {
    if (claimItems.length <= 1) return;
    setClaimItems(claimItems.filter((_, idx) => idx !== i));
  }
  function updateItem(i: number, field: keyof ClaimItemForm, value: string | number) {
    const updated = [...claimItems];
    updated[i] = { ...updated[i], [field]: value };
    setClaimItems(updated);
  }

  const claimTotal = claimItems.reduce((sum, item) => sum + Number(item.amount), 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = claimItems.filter((i) => i.description && i.amount > 0);
    if (validItems.length === 0) { toast.error("Add at least one valid item"); return; }

    startTransition(async () => {
      const result = await submitExpenseClaimAction({
        description,
        items: validItems.map((i) => ({
          description: i.description, amount: i.amount, date: new Date(i.date),
          expenseCategoryId: i.expenseCategoryId || undefined,
        })),
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Expense claim submitted");
      setShowCreateModal(false);
      router.refresh();
    });
  }

  function handleApprove(claim: Claim) {
    startTransition(async () => {
      const result = await approveExpenseClaimAction(claim.id);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Claim approved");
      router.refresh();
    });
  }

  function handleReject(claim: Claim) {
    startTransition(async () => {
      const result = await rejectExpenseClaimAction(claim.id);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Claim rejected");
      router.refresh();
    });
  }

  function handleMarkPaid(claim: Claim) {
    startTransition(async () => {
      const result = await markClaimPaidAction(claim.id);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Claim marked as paid");
      router.refresh();
    });
  }

  const filters: StatusFilter[] = ["ALL", "SUBMITTED", "APPROVED", "REJECTED", "PAID"];

  return (
    <div className="space-y-6">
      <PageHeader title="Expense Claims" description="Submit and manage staff expense reimbursement claims"
        actions={<button onClick={() => setShowCreateModal(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Submit Claim</button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Claims</p>
          <p className="text-2xl font-bold">{claims.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pending Review</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Claimed</p>
          <p className="text-2xl font-bold">{formatCurrency(totalClaimed)}</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {filters.map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${statusFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {f === "ALL" ? "All" : f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No claims" description="No expense claims match the current filter." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Claimant</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((claim) => (
                  <tr key={claim.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-medium">{claim.claimantName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{claim.description}</td>
                    <td className="px-4 py-3 text-sm">{claim.itemCount}</td>
                    <td className="px-4 py-3 text-sm font-medium">{formatCurrency(claim.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[claim.status]?.className ?? ""}`}>
                        {STATUS_STYLES[claim.status]?.label ?? claim.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(claim.submittedAt).toLocaleDateString("en-GH")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {claim.status === "SUBMITTED" && (
                          <>
                            <ConfirmDialog title="Approve Claim" description={`Approve ${claim.claimantName}'s claim for ${formatCurrency(claim.totalAmount)}?`} onConfirm={() => handleApprove(claim)}
                              trigger={<button className="text-xs text-green-600 hover:underline">Approve</button>}
                            />
                            <ConfirmDialog title="Reject Claim" description={`Reject this claim?`} onConfirm={() => handleReject(claim)} variant="destructive"
                              trigger={<button className="text-xs text-red-500 hover:underline">Reject</button>}
                            />
                          </>
                        )}
                        {claim.status === "APPROVED" && (
                          <ConfirmDialog title="Mark as Paid" description={`Mark this claim as paid (${formatCurrency(claim.totalAmount)})?`} onConfirm={() => handleMarkPaid(claim)}
                            trigger={<button className="text-xs text-blue-600 hover:underline">Mark Paid</button>}
                          />
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

      {/* Submit Claim Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Submit Expense Claim</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Claim Description *</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g., Staff meeting refreshments, Workshop transport" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Claim Items</label>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Total: {formatCurrency(claimTotal)}</span>
                    <button type="button" onClick={addItem} className="text-xs text-primary hover:underline">+ Add Item</button>
                  </div>
                </div>
                <div className="space-y-2">
                  {claimItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end rounded-lg border border-border p-3">
                      <div className="col-span-4">
                        <label className="block text-xs text-muted-foreground mb-1">Description</label>
                        <input type="text" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-muted-foreground mb-1">Amount</label>
                        <input type="number" value={item.amount} onChange={(e) => updateItem(i, "amount", parseFloat(e.target.value) || 0)} min="0.01" step="0.01" className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs text-muted-foreground mb-1">Date</label>
                        <input type="date" value={item.date} onChange={(e) => updateItem(i, "date", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-muted-foreground mb-1">Category</label>
                        <select value={item.expenseCategoryId} onChange={(e) => updateItem(i, "expenseCategoryId", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
                          <option value="">None</option>
                          {expenseCategories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                        </select>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {claimItems.length > 1 && (
                          <button type="button" onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-sm">&times;</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {isPending ? "Submitting..." : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
