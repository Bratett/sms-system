"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  updateFeeStructureAction,
  addFeeItemAction,
  removeFeeItemAction,
  activateFeeStructureAction,
} from "@/modules/finance/actions/fee-structure.action";

interface FeeItem {
  id: string;
  feeStructureId: string;
  name: string;
  code: string | null;
  amount: number;
  isOptional: boolean;
  description: string | null;
}

interface FeeStructureData {
  id: string;
  name: string;
  status: string;
  academicYearId: string;
  termId: string;
  programmeId: string | null;
  boardingStatus: string | null;
  termName: string;
  termNumber: number;
  academicYearName: string;
  programmeName: string | null;
  totalAmount: number;
  optionalTotal: number;
  billCount: number;
  feeItems: FeeItem[];
}

function formatCurrency(amount: number): string {
  return `GHS ${amount.toFixed(2)}`;
}

export function FeeStructureDetail({
  feeStructure,
}: {
  feeStructure: FeeStructureData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(feeStructure.name);

  // Add fee item form state
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    code: "",
    amount: "",
    isOptional: false,
    description: "",
  });

  const isDraft = feeStructure.status === "DRAFT";
  const requiredTotal = feeStructure.totalAmount - feeStructure.optionalTotal;

  function handleUpdateName() {
    if (name.trim() === feeStructure.name) {
      setEditingName(false);
      return;
    }
    startTransition(async () => {
      const result = await updateFeeStructureAction(feeStructure.id, { name: name.trim() });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Name updated");
      setEditingName(false);
      router.refresh();
    });
  }

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await addFeeItemAction(feeStructure.id, {
        name: newItem.name,
        code: newItem.code || undefined,
        amount: parseFloat(newItem.amount),
        isOptional: newItem.isOptional,
        description: newItem.description || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Fee item added");
      setNewItem({ name: "", code: "", amount: "", isOptional: false, description: "" });
      setShowAddItem(false);
      router.refresh();
    });
  }

  function handleRemoveItem(item: FeeItem) {
    startTransition(async () => {
      const result = await removeFeeItemAction(item.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed "${item.name}"`);
      router.refresh();
    });
  }

  function handleActivate() {
    startTransition(async () => {
      const result = await activateFeeStructureAction(feeStructure.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Fee structure activated");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title=""
        actions={
          <div className="flex items-center gap-2">
            <a
              href="/finance/fee-structures"
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              Back to List
            </a>
            {isDraft && (
              <ConfirmDialog
                title="Activate Fee Structure"
                description={`Are you sure you want to activate "${feeStructure.name}"? Once activated, fee items cannot be modified and billing can begin.`}
                onConfirm={handleActivate}
                trigger={
                  <button className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                    Activate
                  </button>
                }
              />
            )}
          </div>
        }
      />

      {/* Header Card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div>
            {editingName && isDraft ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-lg font-semibold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
                <button
                  onClick={handleUpdateName}
                  className="text-xs text-primary hover:text-primary/80 font-medium"
                  disabled={isPending}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setName(feeStructure.name);
                    setEditingName(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{feeStructure.name}</h2>
                <StatusBadge status={feeStructure.status} />
                {isDraft && (
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              <span>{feeStructure.academicYearName}</span>
              <span>&middot;</span>
              <span>{feeStructure.termName}</span>
              <span>&middot;</span>
              <span>{feeStructure.programmeName ?? "All Programmes"}</span>
              <span>&middot;</span>
              <span>{feeStructure.boardingStatus ?? "All Students"}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(feeStructure.totalAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Required Fees</p>
          <p className="text-lg font-semibold">{formatCurrency(requiredTotal)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Optional Fees</p>
          <p className="text-lg font-semibold">{formatCurrency(feeStructure.optionalTotal)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Fee Items</p>
          <p className="text-lg font-semibold">{feeStructure.feeItems.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Bills Generated</p>
          <p className="text-lg font-semibold">{feeStructure.billCount}</p>
        </div>
      </div>

      {/* Fee Items Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <h3 className="font-medium">Fee Items</h3>
          {isDraft && (
            <button
              onClick={() => setShowAddItem(!showAddItem)}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              {showAddItem ? "Cancel" : "+ Add Item"}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-center font-medium">Optional</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                {isDraft && <th className="px-4 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {feeStructure.feeItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.code ?? "---"}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.isOptional ? (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 text-xs font-medium">
                        Optional
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">
                        Required
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.description ?? "---"}
                  </td>
                  {isDraft && (
                    <td className="px-4 py-3 text-right">
                      <ConfirmDialog
                        title="Remove Fee Item"
                        description={`Are you sure you want to remove "${item.name}" (${formatCurrency(item.amount)})? This cannot be undone.`}
                        onConfirm={() => handleRemoveItem(item)}
                        variant="destructive"
                        trigger={
                          <button
                            className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            disabled={isPending}
                          >
                            Remove
                          </button>
                        }
                      />
                    </td>
                  )}
                </tr>
              ))}
              {feeStructure.feeItems.length === 0 && (
                <tr>
                  <td
                    colSpan={isDraft ? 6 : 5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No fee items yet. Add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Fee Item Form */}
      {isDraft && showAddItem && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="font-medium mb-3">Add Fee Item</h4>
          <form onSubmit={handleAddItem} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Item name (e.g. Tuition)"
                value={newItem.name}
                onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
              <input
                type="text"
                placeholder="Code (optional)"
                value={newItem.code}
                onChange={(e) => setNewItem((prev) => ({ ...prev, code: e.target.value }))}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                type="number"
                placeholder="Amount (GHS)"
                step="0.01"
                min="0.01"
                value={newItem.amount}
                onChange={(e) => setNewItem((prev) => ({ ...prev, amount: e.target.value }))}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={newItem.isOptional}
                  onChange={(e) =>
                    setNewItem((prev) => ({ ...prev, isOptional: e.target.checked }))
                  }
                  className="h-4 w-4 rounded text-primary focus:ring-primary"
                />
                Optional
              </label>
              <input
                type="text"
                placeholder="Description (optional)"
                value={newItem.description}
                onChange={(e) =>
                  setNewItem((prev) => ({ ...prev, description: e.target.value }))
                }
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Adding..." : "Add Item"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
