"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createDonorFundAction,
  updateDonorFundAction,
  deleteDonorFundAction,
  allocateDonorFundAction,
} from "@/modules/finance/actions/donor-fund.action";

import type { Monetary } from "@/lib/monetary";
interface Fund {
  id: string;
  donorName: string;
  donorType: string;
  contactEmail: string | null;
  contactPhone: string | null;
  totalPledged: Monetary;
  totalReceived: Monetary;
  totalDisbursed: Monetary;
  availableBalance: Monetary;
  pledgeUtilization: number;
  purpose: string | null;
  isActive: boolean;
  allocationCount: number;
  startDate: Date | string | null;
  endDate: Date | string | null;
}

interface Term { id: string; name: string; isCurrent: boolean; academicYearId: string; }

type DonorType = "INDIVIDUAL" | "ORGANIZATION" | "FOUNDATION" | "ALUMNI" | "CORPORATE";

const TYPE_STYLES: Record<string, { label: string; className: string }> = {
  INDIVIDUAL: { label: "Individual", className: "bg-blue-100 text-blue-700" },
  ORGANIZATION: { label: "Organization", className: "bg-green-100 text-green-700" },
  FOUNDATION: { label: "Foundation", className: "bg-purple-100 text-purple-700" },
  ALUMNI: { label: "Alumni", className: "bg-orange-100 text-orange-700" },
  CORPORATE: { label: "Corporate", className: "bg-teal-100 text-teal-700" },
};

function formatCurrency(amount: Monetary): string {
  return `GHS ${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function DonorFundsClient({ funds, terms }: { funds: Fund[]; terms: Term[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [editingFund, setEditingFund] = useState<Fund | null>(null);
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);

  const [formData, setFormData] = useState({
    donorName: "", donorType: "INDIVIDUAL" as DonorType, contactEmail: "", contactPhone: "",
    totalPledged: 0, purpose: "", startDate: "", endDate: "",
  });

  const [receiptAmount, setReceiptAmount] = useState(0);
  const [allocateData, setAllocateData] = useState({ studentId: "", termId: terms.find((t) => t.isCurrent)?.id ?? "", amount: 0, description: "" });

  const totalPledged = funds.reduce((sum, f) => sum + Number(f.totalPledged), 0);
  const totalReceived = funds.reduce((sum, f) => sum + Number(f.totalReceived), 0);
  const totalDisbursed = funds.reduce((sum, f) => sum + Number(f.totalDisbursed), 0);
  const totalAvailable = totalReceived - totalDisbursed;

  function handleCreate() {
    setEditingFund(null);
    setFormData({ donorName: "", donorType: "INDIVIDUAL", contactEmail: "", contactPhone: "", totalPledged: 0, purpose: "", startDate: "", endDate: "" });
    setShowCreateModal(true);
  }

  function handleEdit(fund: Fund) {
    setEditingFund(fund);
    setFormData({
      donorName: fund.donorName, donorType: fund.donorType as DonorType,
      contactEmail: fund.contactEmail ?? "", contactPhone: fund.contactPhone ?? "",
      totalPledged: Number(fund.totalPledged), purpose: fund.purpose ?? "",
      startDate: fund.startDate ? new Date(fund.startDate).toISOString().split("T")[0] : "",
      endDate: fund.endDate ? new Date(fund.endDate).toISOString().split("T")[0] : "",
    });
    setShowCreateModal(true);
  }

  function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (editingFund) {
        const result = await updateDonorFundAction(editingFund.id, {
          donorName: formData.donorName, donorType: formData.donorType,
          contactEmail: formData.contactEmail || null, contactPhone: formData.contactPhone || null,
          totalPledged: formData.totalPledged, purpose: formData.purpose || null,
        });
        if ("error" in result) { toast.error(result.error); return; }
        toast.success("Donor fund updated");
      } else {
        const result = await createDonorFundAction({
          donorName: formData.donorName, donorType: formData.donorType,
          contactEmail: formData.contactEmail || undefined, contactPhone: formData.contactPhone || undefined,
          totalPledged: formData.totalPledged, purpose: formData.purpose || undefined,
          startDate: formData.startDate ? new Date(formData.startDate) : undefined,
          endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        });
        if ("error" in result) { toast.error(result.error); return; }
        toast.success("Donor fund created");
      }
      setShowCreateModal(false);
      router.refresh();
    });
  }

  function handleRecordReceipt(fund: Fund) {
    setSelectedFund(fund);
    setReceiptAmount(0);
    setShowReceiptModal(true);
  }

  function handleSubmitReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFund) return;
    startTransition(async () => {
      const result = await updateDonorFundAction(selectedFund.id, {
        totalReceived: Number(selectedFund.totalReceived) + receiptAmount,
      });
      if ("error" in result) { toast.error(result.error); return; }
      toast.success(`Receipt of ${formatCurrency(receiptAmount)} recorded`);
      setShowReceiptModal(false);
      router.refresh();
    });
  }

  function handleAllocate(fund: Fund) {
    setSelectedFund(fund);
    setAllocateData({ studentId: "", termId: terms.find((t) => t.isCurrent)?.id ?? "", amount: 0, description: "" });
    setShowAllocateModal(true);
  }

  function handleSubmitAllocate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFund) return;
    startTransition(async () => {
      const result = await allocateDonorFundAction({
        donorFundId: selectedFund.id, studentId: allocateData.studentId,
        termId: allocateData.termId, amount: allocateData.amount,
        description: allocateData.description || undefined,
      });
      if ("error" in result) { toast.error(result.error); return; }
      toast.success("Fund allocated to student");
      setShowAllocateModal(false);
      router.refresh();
    });
  }

  function handleToggleActive(fund: Fund) {
    startTransition(async () => {
      const result = await updateDonorFundAction(fund.id, { isActive: !fund.isActive });
      if ("error" in result) { toast.error(result.error); return; }
      toast.success(`Fund ${fund.isActive ? "deactivated" : "activated"}`);
      router.refresh();
    });
  }

  function handleDelete(fund: Fund) {
    startTransition(async () => {
      const result = await deleteDonorFundAction(fund.id);
      if ("error" in result) { toast.error(result.error); return; }
      toast.success("Donor fund deleted");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Donor Funds" description="Manage private bursaries, donor contributions, and fund allocations"
        actions={<button onClick={handleCreate} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Add Fund</button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Pledged</p>
          <p className="text-2xl font-bold">{formatCurrency(totalPledged)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Received</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Disbursed</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalDisbursed)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Available Balance</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalAvailable)}</p>
        </div>
      </div>

      {funds.length === 0 ? (
        <EmptyState title="No donor funds" description="Add donor funds to track contributions and allocate to students." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Donor</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Pledged</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Available</th>
                  <th className="px-4 py-3">Utilization</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {funds.map((fund) => (
                  <tr key={fund.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{fund.donorName}</div>
                      {fund.purpose && <div className="text-xs text-muted-foreground">{fund.purpose}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[fund.donorType]?.className ?? ""}`}>
                        {TYPE_STYLES[fund.donorType]?.label ?? fund.donorType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(fund.totalPledged)}</td>
                    <td className="px-4 py-3 text-sm text-green-600">{formatCurrency(fund.totalReceived)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-green-600">{formatCurrency(fund.availableBalance)}</td>
                    <td className="px-4 py-3 text-sm">{fund.pledgeUtilization.toFixed(0)}%</td>
                    <td className="px-4 py-3"><StatusBadge status={fund.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleRecordReceipt(fund)} className="text-xs text-green-600 hover:underline">Receive</button>
                        {fund.isActive && Number(fund.availableBalance) > 0 && (
                          <button onClick={() => handleAllocate(fund)} className="text-xs text-blue-600 hover:underline">Allocate</button>
                        )}
                        <button onClick={() => handleEdit(fund)} className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                        <button onClick={() => handleToggleActive(fund)} disabled={isPending} className="text-xs text-muted-foreground hover:text-foreground">
                          {fund.isActive ? "Deactivate" : "Activate"}
                        </button>
                        {fund.allocationCount === 0 && (
                          <ConfirmDialog title="Delete Fund" description={`Delete "${fund.donorName}"?`} onConfirm={() => handleDelete(fund)} variant="destructive"
                            trigger={<button className="text-xs text-red-500 hover:text-red-700">Delete</button>}
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

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingFund ? "Edit Fund" : "Add Donor Fund"}</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Donor Name *</label>
                <input type="text" value={formData.donorName} onChange={(e) => setFormData({ ...formData, donorName: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Donor Type *</label>
                <select value={formData.donorType} onChange={(e) => setFormData({ ...formData, donorType: e.target.value as DonorType })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="ORGANIZATION">Organization</option>
                  <option value="FOUNDATION">Foundation</option>
                  <option value="ALUMNI">Alumni</option>
                  <option value="CORPORATE">Corporate</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input type="email" value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Total Pledged (GHS) *</label>
                <input type="number" value={formData.totalPledged} onChange={(e) => setFormData({ ...formData, totalPledged: parseFloat(e.target.value) || 0 })} required min="0.01" step="0.01" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Purpose / Restriction</label>
                <textarea value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g., Science students only" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {isPending ? "Saving..." : editingFund ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Receipt Modal */}
      {showReceiptModal && selectedFund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold mb-2">Record Receipt</h2>
            <p className="text-sm text-muted-foreground mb-4">{selectedFund.donorName} — Pledged: {formatCurrency(selectedFund.totalPledged)}, Received: {formatCurrency(selectedFund.totalReceived)}</p>
            <form onSubmit={handleSubmitReceipt} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Amount Received (GHS) *</label>
                <input type="number" value={receiptAmount} onChange={(e) => setReceiptAmount(parseFloat(e.target.value) || 0)} required min="0.01" step="0.01" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowReceiptModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  {isPending ? "Recording..." : "Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate Modal */}
      {showAllocateModal && selectedFund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold mb-2">Allocate Fund to Student</h2>
            <p className="text-sm text-muted-foreground mb-4">{selectedFund.donorName} — Available: <span className="font-medium text-green-600">{formatCurrency(selectedFund.availableBalance)}</span></p>
            <form onSubmit={handleSubmitAllocate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Student ID *</label>
                <input type="text" value={allocateData.studentId} onChange={(e) => setAllocateData({ ...allocateData, studentId: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Enter student database ID" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Term *</label>
                <select value={allocateData.termId} onChange={(e) => setAllocateData({ ...allocateData, termId: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {terms.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount (GHS) *</label>
                <input type="number" value={allocateData.amount} onChange={(e) => setAllocateData({ ...allocateData, amount: parseFloat(e.target.value) || 0 })} required min="0.01" step="0.01" max={Number(selectedFund.availableBalance)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input type="text" value={allocateData.description} onChange={(e) => setAllocateData({ ...allocateData, description: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g., Tuition support" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowAllocateModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {isPending ? "Allocating..." : "Allocate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
