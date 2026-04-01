"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  uploadBankStatementAction,
  autoMatchEntriesAction,
  getReconciliationEntriesAction,
} from "@/modules/finance/actions/bank-reconciliation.action";

interface Reconciliation {
  id: string;
  bankName: string;
  accountNumber: string | null;
  statementDate: Date | string;
  uploadedByName: string;
  uploadedAt: Date | string;
  status: string;
  totalEntries: number;
  matchedEntries: number;
  unmatchedEntries: number;
  matchRate: number;
}

interface Entry {
  id: string;
  transactionDate: Date | string;
  description: string;
  reference: string | null;
  debitAmount: number | null;
  creditAmount: number | null;
  balance: number | null;
  matchStatus: string;
  matchedPaymentId: string | null;
}

interface Pagination { page: number; pageSize: number; total: number; totalPages: number; }

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MATCH_STYLES: Record<string, { label: string; className: string }> = {
  UNMATCHED: { label: "Unmatched", className: "bg-gray-100 text-gray-700" },
  AUTO_MATCHED: { label: "Auto-matched", className: "bg-green-100 text-green-700" },
  MANUALLY_MATCHED: { label: "Manual Match", className: "bg-blue-100 text-blue-700" },
  NO_MATCH: { label: "No Match", className: "bg-red-100 text-red-700" },
};

export function BankReconciliationClient({
  reconciliations,
  pagination,
}: {
  reconciliations: Reconciliation[];
  pagination: Pagination;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  const [formData, setFormData] = useState({
    bankName: "", accountNumber: "", statementDate: new Date().toISOString().split("T")[0],
  });

  function handleExpand(reconId: string) {
    if (expandedId === reconId) { setExpandedId(null); return; }
    startTransition(async () => {
      const result = await getReconciliationEntriesAction(reconId);
      if (result.data) setEntries(result.data);
      setExpandedId(reconId);
    });
  }

  function handleAutoMatch(reconId: string) {
    startTransition(async () => {
      const result = await autoMatchEntriesAction(reconId);
      if (result.error) { toast.error(result.error); return; }
      toast.success(`Auto-matched ${result.data!.matched} of ${result.data!.total} entries`);
      router.refresh();
      // Refresh entries if expanded
      if (expandedId === reconId) {
        const entriesResult = await getReconciliationEntriesAction(reconId);
        if (entriesResult.data) setEntries(entriesResult.data);
      }
    });
  }

  function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    toast.info("Upload bank statement CSV/Excel file processing is not yet connected. Use the API to upload entries.");
    setShowUploadModal(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Bank Reconciliation" description="Upload bank statements and match transactions with recorded payments"
        actions={<button onClick={() => setShowUploadModal(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Upload Statement</button>}
      />

      {reconciliations.length === 0 ? (
        <EmptyState title="No reconciliations" description="Upload a bank statement to start matching transactions." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Bank</th>
                  <th className="px-4 py-3">Statement Date</th>
                  <th className="px-4 py-3">Entries</th>
                  <th className="px-4 py-3">Matched</th>
                  <th className="px-4 py-3">Match Rate</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Uploaded By</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reconciliations.map((recon) => (
                  <>
                    <tr key={recon.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{recon.bankName}</div>
                        {recon.accountNumber && <div className="text-xs text-muted-foreground">{recon.accountNumber}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm">{new Date(recon.statementDate).toLocaleDateString("en-GH")}</td>
                      <td className="px-4 py-3 text-sm">{recon.totalEntries}</td>
                      <td className="px-4 py-3 text-sm text-green-600">{recon.matchedEntries} / {recon.totalEntries}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 rounded-full bg-gray-200">
                            <div className="h-2 rounded-full bg-green-500" style={{ width: `${recon.matchRate}%` }} />
                          </div>
                          <span className="text-xs">{recon.matchRate.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={recon.status} /></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{recon.uploadedByName}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleExpand(recon.id)} className="text-xs text-primary hover:underline">
                            {expandedId === recon.id ? "Hide" : "View"}
                          </button>
                          {recon.status !== "COMPLETED" && (
                            <button onClick={() => handleAutoMatch(recon.id)} disabled={isPending} className="text-xs text-green-600 hover:underline">
                              Auto-Match
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === recon.id && (
                      <tr key={`${recon.id}-entries`}>
                        <td colSpan={8} className="bg-muted/30 px-4 py-3">
                          <p className="text-sm font-medium mb-2">Statement Entries</p>
                          <table className="min-w-full divide-y divide-border">
                            <thead>
                              <tr className="text-left text-xs uppercase text-muted-foreground">
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Description</th>
                                <th className="px-3 py-2">Reference</th>
                                <th className="px-3 py-2">Debit</th>
                                <th className="px-3 py-2">Credit</th>
                                <th className="px-3 py-2">Match Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {entries.map((entry) => (
                                <tr key={entry.id}>
                                  <td className="px-3 py-2 text-sm">{new Date(entry.transactionDate).toLocaleDateString("en-GH")}</td>
                                  <td className="px-3 py-2 text-sm">{entry.description}</td>
                                  <td className="px-3 py-2 text-sm text-muted-foreground">{entry.reference ?? "—"}</td>
                                  <td className="px-3 py-2 text-sm text-red-600">{entry.debitAmount ? formatCurrency(entry.debitAmount) : "—"}</td>
                                  <td className="px-3 py-2 text-sm text-green-600">{entry.creditAmount ? formatCurrency(entry.creditAmount) : "—"}</td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${MATCH_STYLES[entry.matchStatus]?.className ?? ""}`}>
                                      {MATCH_STYLES[entry.matchStatus]?.label ?? entry.matchStatus}
                                    </span>
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

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Upload Bank Statement</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Bank Name *</label>
                <input type="text" value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g., GCB Bank, Ecobank" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Account Number</label>
                <input type="text" value={formData.accountNumber} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Statement Date *</label>
                <input type="date" value={formData.statementDate} onChange={(e) => setFormData({ ...formData, statementDate: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">CSV/Excel upload coming soon</p>
                <p className="text-xs text-muted-foreground mt-1">Use the API endpoint to upload statement entries programmatically</p>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowUploadModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
