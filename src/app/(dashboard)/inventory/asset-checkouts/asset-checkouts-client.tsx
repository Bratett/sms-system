"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import {
  checkoutAssetAction,
  returnAssetAction,
} from "@/modules/inventory/actions/asset-checkout.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ActiveCheckout {
  id: string;
  assetNumber: string;
  assetName: string;
  categoryName: string;
  checkedOutTo: string;
  checkedOutByName: string;
  purpose: string | null;
  checkoutDate: Date | string;
  expectedReturn: Date | string | null;
  isOverdue: boolean;
  daysOut: number;
}

interface OverdueCheckout {
  id: string;
  assetNumber: string;
  assetName: string;
  checkedOutTo: string;
  checkoutDate: Date | string;
  expectedReturn: Date | string | null;
  daysOverdue: number;
}

interface AvailableAsset {
  id: string;
  assetNumber: string;
  name: string;
  categoryName: string;
}

type AssetCondition = "NEW" | "GOOD" | "FAIR" | "POOR" | "UNSERVICEABLE";

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Component ──────────────────────────────────────────────────────

export function AssetCheckoutsClient({
  activeCheckouts,
  overdueCheckouts,
  availableAssets,
}: {
  activeCheckouts: ActiveCheckout[];
  overdueCheckouts: OverdueCheckout[];
  availableAssets: AvailableAsset[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedCheckout, setSelectedCheckout] = useState<ActiveCheckout | null>(null);

  const [checkoutForm, setCheckoutForm] = useState({
    fixedAssetId: "",
    checkedOutTo: "",
    purpose: "",
    expectedReturn: "",
  });

  const [returnForm, setReturnForm] = useState({
    condition: "GOOD" as AssetCondition,
    returnNotes: "",
  });

  function handleSubmitCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!checkoutForm.fixedAssetId || !checkoutForm.checkedOutTo) {
      toast.error("Please select an asset and enter who it is checked out to.");
      return;
    }
    startTransition(async () => {
      const result = await checkoutAssetAction({
        fixedAssetId: checkoutForm.fixedAssetId,
        checkedOutTo: checkoutForm.checkedOutTo,
        purpose: checkoutForm.purpose || undefined,
        expectedReturn: checkoutForm.expectedReturn || undefined,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Asset checked out successfully");
      setShowCheckoutModal(false);
      setCheckoutForm({ fixedAssetId: "", checkedOutTo: "", purpose: "", expectedReturn: "" });
      router.refresh();
    });
  }

  function handleOpenReturn(checkout: ActiveCheckout) {
    setSelectedCheckout(checkout);
    setReturnForm({ condition: "GOOD", returnNotes: "" });
    setShowReturnModal(true);
  }

  function handleSubmitReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCheckout) return;
    startTransition(async () => {
      const result = await returnAssetAction(selectedCheckout.id, {
        condition: returnForm.condition,
        returnNotes: returnForm.returnNotes || undefined,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Asset returned successfully");
      setShowReturnModal(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Active Checkouts</p>
          <p className="text-2xl font-bold">{activeCheckouts.length}</p>
        </div>
        <div className={`rounded-lg border p-4 ${overdueCheckouts.length > 0 ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950" : "border-border bg-card"}`}>
          <p className="text-sm text-muted-foreground">Overdue Returns</p>
          <p className={`text-2xl font-bold ${overdueCheckouts.length > 0 ? "text-red-600" : ""}`}>{overdueCheckouts.length}</p>
        </div>
      </div>

      {/* Check Out Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCheckoutModal(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Check Out Asset
        </button>
      </div>

      {/* Overdue Section */}
      {overdueCheckouts.length > 0 && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <h3 className="mb-3 text-lg font-semibold text-red-700 dark:text-red-400">Overdue Returns</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-red-200 dark:divide-red-800">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-red-600 dark:text-red-400">
                  <th className="px-4 py-2">Asset #</th>
                  <th className="px-4 py-2">Asset Name</th>
                  <th className="px-4 py-2">Checked Out To</th>
                  <th className="px-4 py-2">Expected Return</th>
                  <th className="px-4 py-2">Days Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-200 dark:divide-red-800">
                {overdueCheckouts.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-sm font-mono">{c.assetNumber}</td>
                    <td className="px-4 py-2 text-sm font-medium">{c.assetName}</td>
                    <td className="px-4 py-2 text-sm">{c.checkedOutTo}</td>
                    <td className="px-4 py-2 text-sm">{fmtDate(c.expectedReturn)}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
                        {c.daysOverdue} day{c.daysOverdue !== 1 ? "s" : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Checkouts Table */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">Active Checkouts</h3>
        {activeCheckouts.length === 0 ? (
          <EmptyState title="No active checkouts" description="No assets are currently checked out." />
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Asset #</th>
                    <th className="px-4 py-3">Asset Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Checked Out To</th>
                    <th className="px-4 py-3">Purpose</th>
                    <th className="px-4 py-3">Checkout Date</th>
                    <th className="px-4 py-3">Expected Return</th>
                    <th className="px-4 py-3">Days Out</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeCheckouts.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-mono">{c.assetNumber}</td>
                      <td className="px-4 py-3 text-sm font-medium">{c.assetName}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{c.categoryName}</td>
                      <td className="px-4 py-3 text-sm">{c.checkedOutTo}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{c.purpose ?? "—"}</td>
                      <td className="px-4 py-3 text-sm">{fmtDate(c.checkoutDate)}</td>
                      <td className="px-4 py-3 text-sm">{fmtDate(c.expectedReturn)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          c.isOverdue
                            ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        }`}>
                          {c.daysOut} day{c.daysOut !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleOpenReturn(c)}
                          disabled={isPending}
                          className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50"
                        >
                          Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Check Out Asset</h2>
            <form onSubmit={handleSubmitCheckout} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Asset *</label>
                <select
                  value={checkoutForm.fixedAssetId}
                  onChange={(e) => setCheckoutForm((p) => ({ ...p, fixedAssetId: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select an asset...</option>
                  {availableAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetNumber} — {a.name} ({a.categoryName})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Checked Out To *</label>
                <input
                  type="text"
                  value={checkoutForm.checkedOutTo}
                  onChange={(e) => setCheckoutForm((p) => ({ ...p, checkedOutTo: e.target.value }))}
                  placeholder="Staff name or department"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Purpose</label>
                <textarea
                  value={checkoutForm.purpose}
                  onChange={(e) => setCheckoutForm((p) => ({ ...p, purpose: e.target.value }))}
                  placeholder="Reason for checking out this asset"
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Expected Return Date</label>
                <input
                  type="date"
                  value={checkoutForm.expectedReturn}
                  onChange={(e) => setCheckoutForm((p) => ({ ...p, expectedReturn: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Processing..." : "Check Out"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && selectedCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Return Asset</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Returning <span className="font-medium text-foreground">{selectedCheckout.assetName}</span> ({selectedCheckout.assetNumber}) from {selectedCheckout.checkedOutTo}
            </p>
            <form onSubmit={handleSubmitReturn} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Condition on Return *</label>
                <select
                  value={returnForm.condition}
                  onChange={(e) => setReturnForm((p) => ({ ...p, condition: e.target.value as AssetCondition }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="NEW">New</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                  <option value="UNSERVICEABLE">Unserviceable</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Return Notes</label>
                <textarea
                  value={returnForm.returnNotes}
                  onChange={(e) => setReturnForm((p) => ({ ...p, returnNotes: e.target.value }))}
                  placeholder="Any notes about the return or asset condition"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Processing..." : "Confirm Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
