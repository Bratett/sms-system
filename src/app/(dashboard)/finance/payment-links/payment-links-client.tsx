"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createPaymentLinkAction,
  deactivatePaymentLinkAction,
} from "@/modules/finance/actions/payment-link.action";

interface PaymentLinkItem {
  id: string;
  code: string;
  studentBillId: string;
  studentName: string;
  studentIdNumber: string;
  amount: number | null;
  billBalance: number;
  description: string | null;
  expiresAt: Date | string | null;
  isOneTime: boolean;
  isActive: boolean;
  usedCount: number;
  isExpired: boolean;
  createdAt: Date | string;
}

interface Pagination { page: number; pageSize: number; total: number; totalPages: number; }

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PaymentLinksClient({
  links,
  pagination,
}: {
  links: PaymentLinkItem[];
  pagination: Pagination;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    studentBillId: "", amount: "", description: "", expiresInDays: 30, isOneTime: true,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createPaymentLinkAction({
        studentBillId: formData.studentBillId,
        amount: formData.amount ? parseFloat(formData.amount) : undefined,
        description: formData.description || undefined,
        expiresInDays: formData.expiresInDays,
        isOneTime: formData.isOneTime,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Payment link created");
      setShowCreateModal(false);
      router.refresh();
    });
  }

  function handleDeactivate(linkId: string) {
    startTransition(async () => {
      const result = await deactivatePaymentLinkAction(linkId);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Link deactivated");
      router.refresh();
    });
  }

  function copyLink(code: string, id: string) {
    const url = `${window.location.origin}/pay/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function getStatus(link: PaymentLinkItem): string {
    if (!link.isActive) return "INACTIVE";
    if (link.isExpired) return "EXPIRED";
    return "ACTIVE";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payment Links" description="Generate shareable payment links for parents to pay fees online"
        actions={<button onClick={() => setShowCreateModal(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Create Link</button>}
      />

      {links.length === 0 ? (
        <EmptyState title="No payment links" description="Create payment links to share with parents via SMS or WhatsApp." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Bill Balance</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Used</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {links.map((link) => (
                  <tr key={link.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{link.studentName}</div>
                      <div className="text-xs text-muted-foreground">{link.studentIdNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {link.amount ? formatCurrency(link.amount) : <span className="text-muted-foreground">Any amount</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600">{formatCurrency(link.billBalance)}</td>
                    <td className="px-4 py-3 text-sm">{link.isOneTime ? "One-time" : "Reusable"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {link.expiresAt ? new Date(link.expiresAt).toLocaleDateString("en-GH") : "Never"}
                    </td>
                    <td className="px-4 py-3 text-sm">{link.usedCount}x</td>
                    <td className="px-4 py-3"><StatusBadge status={getStatus(link)} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => copyLink(link.code, link.id)} className="text-xs text-primary hover:underline font-medium">
                          {copiedId === link.id ? "Copied!" : "Copy Link"}
                        </button>
                        {link.isActive && !link.isExpired && (
                          <button onClick={() => handleDeactivate(link.id)} disabled={isPending} className="text-xs text-red-500 hover:text-red-700">
                            Deactivate
                          </button>
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
              <h2 className="text-lg font-semibold">Create Payment Link</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Student Bill ID *</label>
                <input type="text" value={formData.studentBillId} onChange={(e) => setFormData({ ...formData, studentBillId: e.target.value })} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Enter bill ID" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount (GHS)</label>
                <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} min="0.01" step="0.01" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Leave empty for any amount" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g., Term 1 Fees" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Expires In (days)</label>
                  <input type="number" value={formData.expiresInDays} onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) || 30 })} min="1" max="90" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formData.isOneTime} onChange={(e) => setFormData({ ...formData, isOneTime: e.target.checked })} className="rounded border-border" />
                    One-time use
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {isPending ? "Creating..." : "Create Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
