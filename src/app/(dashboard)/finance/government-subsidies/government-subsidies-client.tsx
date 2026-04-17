"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createGovernmentSubsidyAction,
  updateGovernmentSubsidyAction,
  deleteGovernmentSubsidyAction,
  recordDisbursementAction,
} from "@/modules/finance/actions/government-subsidy.action";

import type { Monetary } from "@/lib/monetary";
interface Disbursement {
  id: string;
  amount: Monetary;
  receivedAt: Date | string;
  bankReference: string | null;
  notes: string | null;
  recordedBy: string;
}

interface Subsidy {
  id: string;
  name: string;
  subsidyType: string;
  academicYearId: string;
  academicYearName: string;
  termId: string | null;
  termName: string | null;
  expectedAmount: Monetary;
  receivedAmount: Monetary;
  variance: number;
  status: string;
  referenceNumber: string | null;
  notes: string | null;
  disbursementCount: number;
  disbursements: Disbursement[];
}

interface Summary {
  totalExpected: number;
  totalReceived: number;
  totalVariance: number;
  receiptRate: number;
  count: number;
}

interface AcademicYear { id: string; name: string; isCurrent: boolean; }
interface Term { id: string; name: string; academicYearId: string; isCurrent: boolean; }

type SubsidyType = "FREE_SHS" | "GOVERNMENT_PLACEMENT" | "CAPITATION_GRANT" | "OTHER_GOVERNMENT";

const TYPE_STYLES: Record<string, { label: string; className: string }> = {
  FREE_SHS: { label: "Free SHS", className: "bg-blue-100 text-blue-700" },
  GOVERNMENT_PLACEMENT: { label: "Gov. Placement", className: "bg-green-100 text-green-700" },
  CAPITATION_GRANT: { label: "Capitation Grant", className: "bg-purple-100 text-purple-700" },
  OTHER_GOVERNMENT: { label: "Other", className: "bg-orange-100 text-orange-700" },
};

function formatCurrency(amount: Monetary): string {
  return `GHS ${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function GovernmentSubsidiesClient({
  subsidies,
  summary,
  academicYears,
  terms,
}: {
  subsidies: Subsidy[];
  summary: Summary | null;
  academicYears: AcademicYear[];
  terms: Term[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDisbursementModal, setShowDisbursementModal] = useState(false);
  const [selectedSubsidy, setSelectedSubsidy] = useState<Subsidy | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState("");

  const [formData, setFormData] = useState({
    name: "", subsidyType: "FREE_SHS" as SubsidyType, academicYearId: "",
    termId: "", expectedAmount: 0, referenceNumber: "", notes: "",
  });

  const [disbursementData, setDisbursementData] = useState({
    amount: 0, receivedAt: new Date().toISOString().split("T")[0], bankReference: "", notes: "",
  });

  const filtered = filterYear ? subsidies.filter((s) => s.academicYearId === filterYear) : subsidies;

  function handleCreate() {
    setSelectedSubsidy(null);
    setFormData({ name: "", subsidyType: "FREE_SHS", academicYearId: academicYears.find((ay) => ay.isCurrent)?.id ?? "", termId: "", expectedAmount: 0, referenceNumber: "", notes: "" });
    setShowCreateModal(true);
  }

  function handleEdit(subsidy: Subsidy) {
    setSelectedSubsidy(subsidy);
    setFormData({
      name: subsidy.name, subsidyType: subsidy.subsidyType as SubsidyType,
      academicYearId: subsidy.academicYearId, termId: subsidy.termId ?? "",
      expectedAmount: Number(subsidy.expectedAmount), referenceNumber: subsidy.referenceNumber ?? "", notes: subsidy.notes ?? "",
    });
    setShowCreateModal(true);
  }

  function handleRecordDisbursement(subsidy: Subsidy) {
    setSelectedSubsidy(subsidy);
    setDisbursementData({ amount: 0, receivedAt: new Date().toISOString().split("T")[0], bankReference: "", notes: "" });
    setShowDisbursementModal(true);
  }

  function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (selectedSubsidy) {
        const result = await updateGovernmentSubsidyAction(selectedSubsidy.id, {
          name: formData.name, expectedAmount: formData.expectedAmount,
          referenceNumber: formData.referenceNumber || null, notes: formData.notes || null,
        });
        if ("error" in result) { toast.error(result.error); return; }
        toast.success("Subsidy updated");
      } else {
        const result = await createGovernmentSubsidyAction({
          name: formData.name, subsidyType: formData.subsidyType,
          academicYearId: formData.academicYearId, termId: formData.termId || undefined,
          expectedAmount: formData.expectedAmount, referenceNumber: formData.referenceNumber || undefined,
          notes: formData.notes || undefined,
        });
        if ("error" in result) { toast.error(result.error); return; }
        toast.success("Subsidy created");
      }
      setShowCreateModal(false);
      router.refresh();
    });
  }

  function handleSubmitDisbursement(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSubsidy) return;
    startTransition(async () => {
      const result = await recordDisbursementAction({
        governmentSubsidyId: selectedSubsidy.id, amount: disbursementData.amount,
        receivedAt: new Date(disbursementData.receivedAt),
        bankReference: disbursementData.bankReference || undefined,
        notes: disbursementData.notes || undefined,
      });
      if ("error" in result) { toast.error(result.error); return; }
      toast.success(`Disbursement recorded. Remaining: ${formatCurrency(result.data.remainingAmount)}`);
      setShowDisbursementModal(false);
      router.refresh();
    });
  }

  function handleDelete(subsidy: Subsidy) {
    startTransition(async () => {
      const result = await deleteGovernmentSubsidyAction(subsidy.id);
      if ("error" in result) { toast.error(result.error); return; }
      toast.success("Subsidy deleted");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Government Subsidies"
        description="Track Free SHS subsidies, capitation grants, and government placements"
        actions={
          <button onClick={handleCreate} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Add Subsidy
          </button>
        }
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Expected</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalExpected)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Received</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalReceived)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Variance / Gap</p>
            <p className={`text-2xl font-bold ${summary.totalVariance > 0 ? "text-red-600" : "text-green-600"}`}>
              {formatCurrency(summary.totalVariance)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Receipt Rate</p>
            <p className="text-2xl font-bold">{summary.receiptRate.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <option value="">All Academic Years</option>
          {academicYears.map((ay) => (<option key={ay.id} value={ay.id}>{ay.name}</option>))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No subsidies found" description="Add government subsidies to track expected and received amounts." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Year / Term</th>
                  <th className="px-4 py-3">Expected</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Variance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((subsidy) => (
                  <>
                    <tr key={subsidy.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium">{subsidy.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[subsidy.subsidyType]?.className ?? ""}`}>
                          {TYPE_STYLES[subsidy.subsidyType]?.label ?? subsidy.subsidyType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {subsidy.academicYearName}{subsidy.termName ? ` / ${subsidy.termName}` : ""}
                      </td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(subsidy.expectedAmount)}</td>
                      <td className="px-4 py-3 text-sm text-green-600">{formatCurrency(subsidy.receivedAmount)}</td>
                      <td className={`px-4 py-3 text-sm ${subsidy.variance > 0 ? "text-red-600" : "text-green-600"}`}>
                        {formatCurrency(subsidy.variance)}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={subsidy.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setExpandedId(expandedId === subsidy.id ? null : subsidy.id)} className="text-xs text-primary hover:underline">
                            {expandedId === subsidy.id ? "Hide" : "History"}
                          </button>
                          <button onClick={() => handleRecordDisbursement(subsidy)} className="text-xs text-green-600 hover:underline">Receive</button>
                          <button onClick={() => handleEdit(subsidy)} className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                          {subsidy.disbursementCount === 0 && (
                            <ConfirmDialog
                              title="Delete Subsidy"
                              description={`Delete "${subsidy.name}"? This cannot be undone.`}
                              onConfirm={() => handleDelete(subsidy)}
                              variant="destructive"
                              trigger={<button className="text-xs text-red-500 hover:text-red-700">Delete</button>}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === subsidy.id && (
                      <tr key={`${subsidy.id}-history`}>
                        <td colSpan={8} className="bg-muted/30 px-4 py-3">
                          <p className="text-sm font-medium mb-2">Disbursement History ({subsidy.disbursementCount})</p>
                          {subsidy.disbursements.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No disbursements recorded yet.</p>
                          ) : (
                            <table className="min-w-full divide-y divide-border">
                              <thead>
                                <tr className="text-left text-xs uppercase text-muted-foreground">
                                  <th className="px-3 py-2">Date</th>
                                  <th className="px-3 py-2">Amount</th>
                                  <th className="px-3 py-2">Bank Reference</th>
                                  <th className="px-3 py-2">Notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {subsidy.disbursements.map((d) => (
                                  <tr key={d.id}>
                                    <td className="px-3 py-2 text-sm">{new Date(d.receivedAt).toLocaleDateString("en-GH")}</td>
                                    <td className="px-3 py-2 text-sm text-green-600">{formatCurrency(d.amount)}</td>
                                    <td className="px-3 py-2 text-sm text-muted-foreground">{d.bankReference ?? "—"}</td>
                                    <td className="px-3 py-2 text-sm text-muted-foreground">{d.notes ?? "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
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

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{selectedSubsidy ? "Edit Subsidy" : "Add Subsidy"}</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g., Free SHS Subsidy Term 1" />
              </div>
              {!selectedSubsidy && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Subsidy Type *</label>
                    <select value={formData.subsidyType} onChange={(e) => setFormData({ ...formData, subsidyType: e.target.value as SubsidyType })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      <option value="FREE_SHS">Free SHS</option>
                      <option value="GOVERNMENT_PLACEMENT">Government Placement</option>
                      <option value="CAPITATION_GRANT">Capitation Grant</option>
                      <option value="OTHER_GOVERNMENT">Other Government</option>
                    </select>
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
                        <option value="">All Terms</option>
                        {terms.filter((t) => !formData.academicYearId || t.academicYearId === formData.academicYearId).map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                      </select>
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Expected Amount (GHS) *</label>
                <input type="number" value={formData.expectedAmount} onChange={(e) => setFormData({ ...formData, expectedAmount: parseFloat(e.target.value) || 0 })} required min="0.01" step="0.01" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Government Reference</label>
                <input type="text" value={formData.referenceNumber} onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {isPending ? "Saving..." : selectedSubsidy ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Disbursement Modal */}
      {showDisbursementModal && selectedSubsidy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Record Disbursement</h2>
              <button onClick={() => setShowDisbursementModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {selectedSubsidy.name} — Outstanding: <span className="font-medium text-red-600">{formatCurrency(Number(selectedSubsidy.expectedAmount) - Number(selectedSubsidy.receivedAmount))}</span>
            </p>
            <form onSubmit={handleSubmitDisbursement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Amount Received (GHS) *</label>
                <input type="number" value={disbursementData.amount} onChange={(e) => setDisbursementData({ ...disbursementData, amount: parseFloat(e.target.value) || 0 })} required min="0.01" step="0.01" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date Received *</label>
                <input type="date" value={disbursementData.receivedAt} onChange={(e) => setDisbursementData({ ...disbursementData, receivedAt: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Bank Reference</label>
                <input type="text" value={disbursementData.bankReference} onChange={(e) => setDisbursementData({ ...disbursementData, bankReference: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea value={disbursementData.notes} onChange={(e) => setDisbursementData({ ...disbursementData, notes: e.target.value })} rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowDisbursementModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  {isPending ? "Recording..." : "Record Disbursement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
