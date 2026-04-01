"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createTaxRecordAction,
  fileTaxReturnAction,
  recordTaxPaymentAction,
} from "@/modules/accounting/actions/tax-compliance.action";

interface TaxRecord {
  id: string;
  taxType: string;
  period: string;
  amount: number;
  dueDate: Date | string;
  paidAmount: number;
  paidDate: Date | string | null;
  referenceNumber: string | null;
  status: string;
  filedByName: string | null;
  isOverdue: boolean;
  outstanding: number;
}

interface Summary {
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueCount: number;
  complianceRate: number;
  byType: { type: string; due: number; paid: number; count: number }[];
}

type TaxType = "PAYE" | "VAT" | "WITHHOLDING" | "CORPORATE_TAX" | "SSNIT";

const TAX_TYPE_LABELS: Record<string, string> = {
  PAYE: "PAYE (Income Tax)", VAT: "VAT", WITHHOLDING: "Withholding Tax",
  CORPORATE_TAX: "Corporate Tax", SSNIT: "SSNIT Contributions",
};

const TAX_TYPE_STYLES: Record<string, string> = {
  PAYE: "bg-blue-100 text-blue-700", VAT: "bg-purple-100 text-purple-700",
  WITHHOLDING: "bg-orange-100 text-orange-700", CORPORATE_TAX: "bg-teal-100 text-teal-700",
  SSNIT: "bg-green-100 text-green-700",
};

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TaxComplianceClient({ records, summary }: { records: TaxRecord[]; summary: Summary | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TaxRecord | null>(null);

  const [formData, setFormData] = useState({
    taxType: "PAYE" as TaxType, period: "", amount: 0, dueDate: "", referenceNumber: "",
  });
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentRef, setPaymentRef] = useState("");

  function handleSubmitCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createTaxRecordAction({
        taxType: formData.taxType, period: formData.period,
        amount: formData.amount, dueDate: new Date(formData.dueDate),
        referenceNumber: formData.referenceNumber || undefined,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Tax record created");
      setShowCreateModal(false);
      router.refresh();
    });
  }

  function handleFile(record: TaxRecord) {
    startTransition(async () => {
      const result = await fileTaxReturnAction(record.id);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Tax return filed");
      router.refresh();
    });
  }

  function handleOpenPayment(record: TaxRecord) {
    setSelectedRecord(record);
    setPaymentAmount(record.outstanding);
    setPaymentRef("");
    setShowPaymentModal(true);
  }

  function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRecord) return;
    startTransition(async () => {
      const result = await recordTaxPaymentAction(selectedRecord.id, paymentAmount, paymentRef || undefined);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Tax payment recorded");
      setShowPaymentModal(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tax Compliance" description="Track GRA tax obligations, filings, and payments"
        actions={<button onClick={() => setShowCreateModal(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Add Tax Record</button>}
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Due</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalDue)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPaid)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalOutstanding)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className="text-2xl font-bold text-red-600">{summary.overdueCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Compliance Rate</p>
            <p className="text-2xl font-bold">{summary.complianceRate.toFixed(0)}%</p>
          </div>
        </div>
      )}

      {/* Tax Records Table */}
      {records.length === 0 ? (
        <EmptyState title="No tax records" description="Add tax records to track your GRA obligations." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Tax Type</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Amount Due</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Outstanding</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((record) => (
                  <tr key={record.id} className={`hover:bg-muted/50 ${record.isOverdue ? "bg-red-50" : ""}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TAX_TYPE_STYLES[record.taxType] ?? ""}`}>
                        {TAX_TYPE_LABELS[record.taxType] ?? record.taxType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{record.period}</td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(record.amount)}</td>
                    <td className="px-4 py-3 text-sm text-green-600">{formatCurrency(record.paidAmount)}</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-medium">{formatCurrency(record.outstanding)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(record.dueDate).toLocaleDateString("en-GH")}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.isOverdue ? "OVERDUE" : record.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {record.status === "PENDING" && (
                          <ConfirmDialog title="File Tax Return" description={`Mark ${TAX_TYPE_LABELS[record.taxType]} for ${record.period} as filed with GRA?`} onConfirm={() => handleFile(record)}
                            trigger={<button className="text-xs text-primary hover:underline">File</button>}
                          />
                        )}
                        {record.outstanding > 0 && record.status !== "PENDING" && (
                          <button onClick={() => handleOpenPayment(record)} className="text-xs text-green-600 hover:underline">Record Payment</button>
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
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add Tax Record</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tax Type *</label>
                <select value={formData.taxType} onChange={(e) => setFormData({ ...formData, taxType: e.target.value as TaxType })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="PAYE">PAYE (Income Tax)</option>
                  <option value="SSNIT">SSNIT Contributions</option>
                  <option value="VAT">VAT</option>
                  <option value="WITHHOLDING">Withholding Tax</option>
                  <option value="CORPORATE_TAX">Corporate Tax</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Period *</label>
                <input type="text" value={formData.period} onChange={(e) => setFormData({ ...formData, period: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g., 2026-Q1, 2026-03" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount (GHS) *</label>
                <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} required min="0" step="0.01" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Due Date *</label>
                <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">GRA Reference</label>
                <input type="text" value={formData.referenceNumber} onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold mb-2">Record Tax Payment</h2>
            <p className="text-sm text-muted-foreground mb-4">{TAX_TYPE_LABELS[selectedRecord.taxType]} — {selectedRecord.period} (Outstanding: {formatCurrency(selectedRecord.outstanding)})</p>
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Amount (GHS) *</label>
                <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} required min="0.01" step="0.01" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">GRA Payment Reference</label>
                <input type="text" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  {isPending ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
