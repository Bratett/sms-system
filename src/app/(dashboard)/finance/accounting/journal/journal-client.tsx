"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  createJournalTransactionAction,
  postJournalTransactionAction,
  reverseJournalTransactionAction,
} from "@/modules/accounting/actions/journal.action";

import type { Monetary } from "@/lib/monetary";
interface JournalEntry {
  id: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: Monetary;
  narration: string | null;
  debitAccount: { code: string; name: string };
  creditAccount: { code: string; name: string };
}

interface JournalTransaction {
  id: string;
  transactionNumber: string;
  date: Date | string;
  description: string;
  status: string;
  createdByName: string;
  approvedByName: string | null;
  totalAmount: Monetary;
  entries: JournalEntry[];
}

interface Account {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  category: { name: string; type: string };
}

interface Pagination { page: number; pageSize: number; total: number; totalPages: number; }

interface EntryLine {
  debitAccountId: string;
  creditAccountId: string;
  amount: string;
  narration: string;
}

function formatCurrency(amount: Monetary): string {
  return `GHS ${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  POSTED: { label: "Posted", className: "bg-green-100 text-green-700" },
  REVERSED: { label: "Reversed", className: "bg-red-100 text-red-700" },
};

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "POSTED", label: "Posted" },
  { key: "REVERSED", label: "Reversed" },
];

const EMPTY_LINE: EntryLine = { debitAccountId: "", creditAccountId: "", amount: "", narration: "" };

export function JournalClient({
  transactions,
  pagination,
  accounts,
}: {
  transactions: JournalTransaction[];
  pagination: Pagination;
  accounts: Account[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [entryLines, setEntryLines] = useState<EntryLine[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);

  const filteredTransactions = activeTab === "ALL"
    ? transactions
    : transactions.filter((t) => t.status === activeTab);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function resetAndOpenModal() {
    setFormData({ date: new Date().toISOString().split("T")[0], description: "" });
    setEntryLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
    setShowCreateModal(true);
  }

  function addEntryLine() {
    setEntryLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeEntryLine(index: number) {
    if (entryLines.length <= 1) return;
    setEntryLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateEntryLine(index: number, field: keyof EntryLine, value: string) {
    setEntryLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const entries = entryLines
      .filter((l) => l.debitAccountId && l.creditAccountId && parseFloat(l.amount) > 0)
      .map((l) => ({
        debitAccountId: l.debitAccountId,
        creditAccountId: l.creditAccountId,
        amount: parseFloat(l.amount),
        narration: l.narration || undefined,
      }));

    if (entries.length === 0) {
      toast.error("At least one valid entry line is required");
      return;
    }

    startTransition(async () => {
      const result = await createJournalTransactionAction({
        date: new Date(formData.date),
        description: formData.description,
        entries,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Journal entry created successfully");
      setShowCreateModal(false);
      router.refresh();
    });
  }

  function handlePost(transactionId: string) {
    startTransition(async () => {
      const result = await postJournalTransactionAction(transactionId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Journal entry posted successfully");
      router.refresh();
    });
  }

  function handleReverse(transactionId: string) {
    startTransition(async () => {
      const result = await reverseJournalTransactionAction(transactionId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Journal entry reversed successfully");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal Entries"
        description="Record and manage double-entry journal transactions"
        actions={
          <button
            onClick={resetAndOpenModal}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Entry
          </button>
        }
      />

      {/* Status Filter Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Transactions Table */}
      {filteredTransactions.length === 0 ? (
        <EmptyState
          title="No journal entries"
          description={activeTab === "ALL" ? "Create your first journal entry to get started." : `No ${activeTab.toLowerCase()} journal entries found.`}
        />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Transaction #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Entries</th>
                  <th className="px-4 py-3">Total Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTransactions.map((txn) => (
                  <>
                    <tr key={txn.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-mono font-medium">{txn.transactionNumber}</td>
                      <td className="px-4 py-3 text-sm">{new Date(txn.date).toLocaleDateString("en-GH")}</td>
                      <td className="px-4 py-3 text-sm max-w-xs truncate">{txn.description}</td>
                      <td className="px-4 py-3 text-sm">{txn.entries.length}</td>
                      <td className="px-4 py-3 text-sm font-medium">{formatCurrency(txn.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[txn.status]?.className ?? ""}`}>
                          {STATUS_STYLES[txn.status]?.label ?? txn.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleExpand(txn.id)}
                            className="text-xs text-primary hover:underline"
                          >
                            {expandedId === txn.id ? "Hide" : "View"}
                          </button>
                          {txn.status === "DRAFT" && (
                            <ConfirmDialog
                              title="Post Journal Entry"
                              description={`Are you sure you want to post ${txn.transactionNumber}? This will update account balances and cannot be easily undone.`}
                              onConfirm={() => handlePost(txn.id)}
                              trigger={
                                <button disabled={isPending} className="text-xs text-green-600 hover:underline">
                                  Post
                                </button>
                              }
                            />
                          )}
                          {txn.status === "POSTED" && (
                            <ConfirmDialog
                              title="Reverse Journal Entry"
                              description={`Are you sure you want to reverse ${txn.transactionNumber}? A reversal entry will be created to undo the account balance changes.`}
                              onConfirm={() => handleReverse(txn.id)}
                              variant="destructive"
                              trigger={
                                <button disabled={isPending} className="text-xs text-red-600 hover:underline">
                                  Reverse
                                </button>
                              }
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Entry Lines */}
                    {expandedId === txn.id && (
                      <tr key={`${txn.id}-details`}>
                        <td colSpan={7} className="bg-muted/30 px-4 py-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-medium">Entry Lines</p>
                            <p className="text-xs text-muted-foreground">Created by {txn.createdByName}{txn.approvedByName ? ` | Approved by ${txn.approvedByName}` : ""}</p>
                          </div>
                          <table className="min-w-full divide-y divide-border">
                            <thead>
                              <tr className="text-left text-xs uppercase text-muted-foreground">
                                <th className="px-3 py-2">Debit Account</th>
                                <th className="px-3 py-2">Credit Account</th>
                                <th className="px-3 py-2">Amount</th>
                                <th className="px-3 py-2">Narration</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {txn.entries.map((entry) => (
                                <tr key={entry.id}>
                                  <td className="px-3 py-2 text-sm">
                                    <span className="font-mono text-xs">{entry.debitAccount.code}</span>{" "}
                                    {entry.debitAccount.name}
                                  </td>
                                  <td className="px-3 py-2 text-sm">
                                    <span className="font-mono text-xs">{entry.creditAccount.code}</span>{" "}
                                    {entry.creditAccount.name}
                                  </td>
                                  <td className="px-3 py-2 text-sm font-medium">{formatCurrency(entry.amount)}</td>
                                  <td className="px-3 py-2 text-sm text-muted-foreground">{entry.narration ?? "\u2014"}</td>
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

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{" "}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} entries
          </p>
        </div>
      )}

      {/* Create Entry Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-3xl rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create Journal Entry</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm font-medium mb-1">Description *</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="e.g., Salary payment for March 2026"
                  />
                </div>
              </div>

              {/* Entry Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Entry Lines</label>
                  <button
                    type="button"
                    onClick={addEntryLine}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add Line
                  </button>
                </div>
                <div className="space-y-3">
                  {entryLines.map((line, index) => (
                    <div key={index} className="rounded-lg border border-border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Line {index + 1}</span>
                        {entryLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEntryLine(index)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1 text-muted-foreground">Debit Account *</label>
                          <select
                            value={line.debitAccountId}
                            onChange={(e) => updateEntryLine(index, "debitAccountId", e.target.value)}
                            required
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          >
                            <option value="">Select account</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-muted-foreground">Credit Account *</label>
                          <select
                            value={line.creditAccountId}
                            onChange={(e) => updateEntryLine(index, "creditAccountId", e.target.value)}
                            required
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          >
                            <option value="">Select account</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1 text-muted-foreground">Amount (GHS) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={line.amount}
                            onChange={(e) => updateEntryLine(index, "amount", e.target.value)}
                            required
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-muted-foreground">Narration</label>
                          <input
                            type="text"
                            value={line.narration}
                            onChange={(e) => updateEntryLine(index, "narration", e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            placeholder="Optional note"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium">Total Amount</span>
                <span className="text-sm font-bold">
                  {formatCurrency(entryLines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0))}
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {isPending ? "Creating..." : "Create Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
