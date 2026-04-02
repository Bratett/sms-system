"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createPettyCashFundAction,
  recordPettyCashTransactionAction,
  requestReplenishmentAction,
  getPettyCashTransactionsAction,
} from "@/modules/accounting/actions/petty-cash.action";

import type { Monetary } from "@/lib/monetary";
interface PettyCashFund {
  id: string;
  name: string;
  custodianId: string;
  custodianName: string;
  authorizedLimit: Monetary;
  currentBalance: Monetary;
  isActive: boolean;
  transactionCount: number;
  utilizationRate: number;
  createdAt: Date | string;
}

interface Transaction {
  id: string;
  type: string;
  amount: Monetary;
  description: string;
  receiptNumber: string | null;
  date: Date | string;
  recordedByName: string;
}

function formatCurrency(amount: Monetary): string {
  return `GHS ${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TRANSACTION_TYPES = [
  { value: "DISBURSEMENT", label: "Disbursement" },
  { value: "REPLENISHMENT", label: "Replenishment" },
  { value: "ADJUSTMENT", label: "Adjustment" },
];

const TYPE_STYLES: Record<string, { label: string; className: string }> = {
  DISBURSEMENT: { label: "Disbursement", className: "bg-red-100 text-red-700" },
  REPLENISHMENT: { label: "Replenishment", className: "bg-green-100 text-green-700" },
  ADJUSTMENT: { label: "Adjustment", className: "bg-blue-100 text-blue-700" },
};

export function PettyCashClient({ funds }: { funds: PettyCashFund[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);
  const [expandedFundId, setExpandedFundId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [fundForm, setFundForm] = useState({ name: "", custodianId: "", authorizedLimit: "" });
  const [txForm, setTxForm] = useState({ type: "DISBURSEMENT", amount: "", description: "", receiptNumber: "", date: new Date().toISOString().split("T")[0] });

  function resetFundForm() {
    setFundForm({ name: "", custodianId: "", authorizedLimit: "" });
  }

  function resetTxForm() {
    setTxForm({ type: "DISBURSEMENT", amount: "", description: "", receiptNumber: "", date: new Date().toISOString().split("T")[0] });
  }

  function handleCreateFund(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createPettyCashFundAction({
        name: fundForm.name,
        custodianId: fundForm.custodianId,
        authorizedLimit: parseFloat(fundForm.authorizedLimit),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Petty cash fund created successfully");
      resetFundForm();
      setShowCreateModal(false);
      router.refresh();
    });
  }

  function openTransactionModal(fundId: string) {
    setSelectedFundId(fundId);
    resetTxForm();
    setShowTransactionModal(true);
  }

  function handleRecordTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFundId) return;
    startTransition(async () => {
      const result = await recordPettyCashTransactionAction({
        pettyCashFundId: selectedFundId,
        type: txForm.type as "DISBURSEMENT" | "REPLENISHMENT" | "ADJUSTMENT",
        amount: parseFloat(txForm.amount),
        description: txForm.description,
        receiptNumber: txForm.receiptNumber || undefined,
        date: new Date(txForm.date),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Transaction recorded. New balance: ${formatCurrency(result.data.newBalance)}`);
      resetTxForm();
      setShowTransactionModal(false);
      router.refresh();
      // Refresh transactions if expanded
      if (expandedFundId === selectedFundId) {
        const txResult = await getPettyCashTransactionsAction(selectedFundId);
        if ("data" in txResult) setTransactions(txResult.data);
      }
    });
  }

  function handleRequestReplenishment(fund: PettyCashFund) {
    const replenishAmount = Number(fund.authorizedLimit) - Number(fund.currentBalance);
    if (replenishAmount <= 0) {
      toast.info("Fund is already at its authorized limit.");
      return;
    }
    startTransition(async () => {
      const result = await requestReplenishmentAction({
        pettyCashFundId: fund.id,
        amount: replenishAmount,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Replenishment of ${formatCurrency(replenishAmount)} requested`);
      router.refresh();
    });
  }

  function handleToggleTransactions(fundId: string) {
    if (expandedFundId === fundId) {
      setExpandedFundId(null);
      return;
    }
    startTransition(async () => {
      const result = await getPettyCashTransactionsAction(fundId);
      if ("data" in result) setTransactions(result.data);
      setExpandedFundId(fundId);
    });
  }

  const totalAuthorized = funds.reduce((sum, f) => sum + Number(f.authorizedLimit), 0);
  const totalBalance = funds.reduce((sum, f) => sum + Number(f.currentBalance), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Petty Cash"
        description="Manage petty cash funds, disbursements, and replenishments."
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Fund
          </button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Funds</p>
          <p className="text-2xl font-bold">{funds.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{funds.filter((f) => f.isActive).length} active</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Authorized</p>
          <p className="text-2xl font-bold">{formatCurrency(totalAuthorized)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalBalance)}</p>
        </div>
      </div>

      {/* Fund Cards */}
      {funds.length === 0 ? (
        <EmptyState title="No petty cash funds" description="Create a petty cash fund to start tracking disbursements." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {funds.map((fund) => {
            const balancePct = Number(fund.authorizedLimit) > 0 ? (Number(fund.currentBalance) / Number(fund.authorizedLimit)) * 100 : 0;
            const barColor = balancePct > 50 ? "bg-green-500" : balancePct > 20 ? "bg-yellow-500" : "bg-red-500";

            return (
              <div key={fund.id} className="rounded-lg border border-border bg-card">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold">{fund.name}</h3>
                      <p className="text-xs text-muted-foreground">Custodian: {fund.custodianName}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${fund.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {fund.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Balance Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Balance</span>
                      <span className="font-medium">{formatCurrency(fund.currentBalance)} / {formatCurrency(fund.authorizedLimit)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(balancePct, 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-muted-foreground">{balancePct.toFixed(0)}% remaining</span>
                      <span className="text-muted-foreground">{fund.transactionCount} transactions</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-t border-border pt-3">
                    <button
                      onClick={() => openTransactionModal(fund.id)}
                      disabled={isPending || !fund.isActive}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Record Transaction
                    </button>
                    <button
                      onClick={() => handleRequestReplenishment(fund)}
                      disabled={isPending || !fund.isActive || fund.currentBalance >= fund.authorizedLimit}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                    >
                      Request Replenishment
                    </button>
                    <button
                      onClick={() => handleToggleTransactions(fund.id)}
                      className="ml-auto text-xs text-primary hover:underline"
                    >
                      {expandedFundId === fund.id ? "Hide History" : "View History"}
                    </button>
                  </div>
                </div>

                {/* Expandable Transaction History */}
                {expandedFundId === fund.id && (
                  <div className="border-t border-border bg-muted/30 px-4 py-3">
                    <p className="text-sm font-medium mb-2">Transaction History</p>
                    {transactions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No transactions recorded yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border">
                          <thead>
                            <tr className="text-left text-xs uppercase text-muted-foreground">
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2">Type</th>
                              <th className="px-3 py-2">Description</th>
                              <th className="px-3 py-2">Receipt #</th>
                              <th className="px-3 py-2">Amount</th>
                              <th className="px-3 py-2">Recorded By</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {transactions.map((tx) => (
                              <tr key={tx.id}>
                                <td className="px-3 py-2 text-sm">{new Date(tx.date).toLocaleDateString("en-GH")}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[tx.type]?.className ?? "bg-gray-100 text-gray-700"}`}>
                                    {TYPE_STYLES[tx.type]?.label ?? tx.type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-sm">{tx.description}</td>
                                <td className="px-3 py-2 text-sm text-muted-foreground">{tx.receiptNumber ?? "—"}</td>
                                <td className={`px-3 py-2 text-sm font-medium ${tx.type === "DISBURSEMENT" ? "text-red-600" : "text-green-600"}`}>
                                  {tx.type === "DISBURSEMENT" ? "-" : "+"}{formatCurrency(tx.amount)}
                                </td>
                                <td className="px-3 py-2 text-sm text-muted-foreground">{tx.recordedByName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Fund Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create Petty Cash Fund</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <form onSubmit={handleCreateFund} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Fund Name *</label>
                <input
                  type="text"
                  value={fundForm.name}
                  onChange={(e) => setFundForm({ ...fundForm, name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="e.g., Main Office Petty Cash"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Custodian ID *</label>
                <input
                  type="text"
                  value={fundForm.custodianId}
                  onChange={(e) => setFundForm({ ...fundForm, custodianId: e.target.value })}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="User ID of the custodian"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Authorized Limit (GHS) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fundForm.authorizedLimit}
                  onChange={(e) => setFundForm({ ...fundForm, authorizedLimit: e.target.value })}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Create Fund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Record Transaction</h2>
              <button onClick={() => setShowTransactionModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <form onSubmit={handleRecordTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Transaction Type *</label>
                <select
                  value={txForm.type}
                  onChange={(e) => setTxForm({ ...txForm, type: e.target.value })}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {TRANSACTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount (GHS) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={txForm.amount}
                  onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <input
                  type="text"
                  value={txForm.description}
                  onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="What is this transaction for?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Receipt Number</label>
                  <input
                    type="text"
                    value={txForm.receiptNumber}
                    onChange={(e) => setTxForm({ ...txForm, receiptNumber: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="e.g., RCP-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <input
                    type="date"
                    value={txForm.date}
                    onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowTransactionModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Recording..." : "Record Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
