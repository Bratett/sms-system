"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  createStockTakeAction,
  startStockTakeAction,
  recordCountAction,
  completeStockTakeAction,
  approveStockTakeAction,
  getStockTakeAction,
  getVarianceSummaryAction,
} from "@/modules/inventory/actions/stock-take.action";

// ─── Types ──────────────────────────────────────────────────────────

interface StockTakeRow {
  id: string;
  reference: string;
  storeId: string;
  storeName: string;
  status: string;
  scheduledDate: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  conductedBy: string | null;
  conductedByName: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  itemCount: number;
  notes: string | null;
  createdAt: Date;
}

interface StoreOption {
  id: string;
  name: string;
}

interface StockTakeItemDetail {
  id: string;
  storeItemId: string;
  itemName: string;
  itemUnit: string;
  systemQuantity: number;
  physicalQuantity: number | null;
  variance: number | null;
  varianceReason: string | null;
  currentSystemQty: number;
  unitPrice: number;
  varianceValue: number;
}

interface VarianceSummary {
  totalItems: number;
  countedItems: number;
  uncountedItems: number;
  matchedItems: number;
  overItems: number;
  shortItems: number;
  overValue: number;
  shortValue: number;
  netVarianceValue: number;
  accuracyRate: number;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Component ──────────────────────────────────────────────────────

export function StockTakesClient({
  stockTakes: initialStockTakes,
  stores,
}: {
  stockTakes: StockTakeRow[];
  stores: StoreOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ─── Filters ─────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStore, setFilterStore] = useState("");

  const filtered = initialStockTakes.filter((st) => {
    if (filterStatus && st.status !== filterStatus) return false;
    if (filterStore && st.storeId !== filterStore) return false;
    return true;
  });

  // ─── Create Stock Take Form ──────────────────────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createStoreId, setCreateStoreId] = useState("");
  const [createScheduledDate, setCreateScheduledDate] = useState("");
  const [createNotes, setCreateNotes] = useState("");

  // ─── Record Counts Form ──────────────────────────────────────────
  const [showCountForm, setShowCountForm] = useState(false);
  const [countStockTake, setCountStockTake] = useState<{
    id: string;
    reference: string;
    items: StockTakeItemDetail[];
  } | null>(null);
  const [physicalCounts, setPhysicalCounts] = useState<
    Record<string, { quantity: number; reason: string }>
  >({});

  // ─── Variance Summary ────────────────────────────────────────────
  const [showVariance, setShowVariance] = useState(false);
  const [varianceSummary, setVarianceSummary] = useState<VarianceSummary | null>(null);
  const [varianceRef, setVarianceRef] = useState("");

  // ─── Create Stock Take Handlers ──────────────────────────────────

  function openCreateForm() {
    setCreateStoreId("");
    setCreateScheduledDate("");
    setCreateNotes("");
    setShowCreateForm(true);
  }

  function handleCreate() {
    if (!createStoreId) {
      toast.error("Please select a store.");
      return;
    }

    startTransition(async () => {
      const result = await createStockTakeAction({
        storeId: createStoreId,
        scheduledDate: createScheduledDate || undefined,
        notes: createNotes || undefined,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock take created.");
      setShowCreateForm(false);
      router.refresh();
    });
  }

  // ─── Action Handlers ─────────────────────────────────────────────

  function handleStart(id: string) {
    startTransition(async () => {
      const result = await startStockTakeAction(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock take started.");
      router.refresh();
    });
  }

  async function openCountForm(stockTakeId: string) {
    const result = await getStockTakeAction(stockTakeId);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if (!result.data) {
      toast.error("Failed to load stock take details.");
      return;
    }
    const detail = result.data;
    setCountStockTake({
      id: detail.id,
      reference: detail.reference,
      items: detail.items.map((i: any) => ({
        id: i.id,
        storeItemId: i.storeItemId,
        itemName: i.itemName,
        itemUnit: i.itemUnit,
        systemQuantity: i.systemQuantity,
        physicalQuantity: i.physicalQuantity,
        variance: i.variance,
        varianceReason: i.varianceReason,
        currentSystemQty: i.currentSystemQty,
        unitPrice: i.unitPrice,
        varianceValue: i.varianceValue,
      })),
    });
    const counts: Record<string, { quantity: number; reason: string }> = {};
    for (const item of detail.items) {
      counts[item.id] = {
        quantity: item.physicalQuantity ?? item.systemQuantity,
        reason: item.varianceReason ?? "",
      };
    }
    setPhysicalCounts(counts);
    setShowCountForm(true);
  }

  function handleSaveCounts() {
    if (!countStockTake) return;

    const counts = countStockTake.items.map((item) => ({
      stockTakeItemId: item.id,
      physicalQuantity: physicalCounts[item.id]?.quantity ?? item.systemQuantity,
      varianceReason: physicalCounts[item.id]?.reason || undefined,
    }));

    startTransition(async () => {
      const result = await recordCountAction(countStockTake.id, counts);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Counts recorded successfully.");
      setShowCountForm(false);
      setCountStockTake(null);
      router.refresh();
    });
  }

  function handleComplete(id: string) {
    if (!confirm("Complete this stock take? Ensure all items have been counted.")) return;
    startTransition(async () => {
      const result = await completeStockTakeAction(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock take completed.");
      router.refresh();
    });
  }

  function handleApprove(id: string) {
    if (!confirm("Approve this stock take? This will apply inventory adjustments.")) return;
    startTransition(async () => {
      const result = await approveStockTakeAction(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock take approved. Adjustments applied.");
      router.refresh();
    });
  }

  async function viewVarianceSummary(stockTakeId: string, reference: string) {
    const result = await getVarianceSummaryAction(stockTakeId);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if (!result.data) {
      toast.error("Failed to load variance summary.");
      return;
    }
    setVarianceSummary(result.data);
    setVarianceRef(reference);
    setShowVariance(true);
  }

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="PLANNED">Planned</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="APPROVED">Approved</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={filterStore}
          onChange={(e) => setFilterStore(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All Stores</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div className="ml-auto">
          <button
            onClick={openCreateForm}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New Stock Take
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Reference</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Store</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Items</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Scheduled</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Started</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Completed</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {filtered.map((st) => (
              <tr key={st.id}>
                <td className="px-4 py-3 text-sm font-medium">{st.reference}</td>
                <td className="px-4 py-3 text-sm">{st.storeName}</td>
                <td className="px-4 py-3 text-sm">
                  <StatusBadge status={st.status} />
                </td>
                <td className="px-4 py-3 text-right text-sm">{st.itemCount}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(st.scheduledDate)}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(st.startedAt)}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(st.completedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {st.status === "PLANNED" && (
                      <button
                        onClick={() => handleStart(st.id)}
                        disabled={isPending}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Start
                      </button>
                    )}
                    {st.status === "IN_PROGRESS" && (
                      <>
                        <button
                          onClick={() => openCountForm(st.id)}
                          disabled={isPending}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Record Counts
                        </button>
                        <button
                          onClick={() => handleComplete(st.id)}
                          disabled={isPending}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Complete
                        </button>
                      </>
                    )}
                    {st.status === "COMPLETED" && (
                      <>
                        <button
                          onClick={() => viewVarianceSummary(st.id, st.reference)}
                          disabled={isPending}
                          className="text-xs text-purple-600 hover:underline"
                        >
                          Variance
                        </button>
                        <button
                          onClick={() => handleApprove(st.id)}
                          disabled={isPending}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Approve
                        </button>
                      </>
                    )}
                    {st.status === "APPROVED" && (
                      <button
                        onClick={() => viewVarianceSummary(st.id, st.reference)}
                        disabled={isPending}
                        className="text-xs text-purple-600 hover:underline"
                      >
                        Variance
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No stock takes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Create Stock Take Modal ────────────────────────────────── */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New Stock Take</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Store *</label>
                <select
                  value={createStoreId}
                  onChange={(e) => setCreateStoreId(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select store</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Scheduled Date</label>
                <input
                  type="date"
                  value={createScheduledDate}
                  onChange={(e) => setCreateScheduledDate(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <textarea
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Additional notes"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create Stock Take"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Record Counts Modal ────────────────────────────────────── */}
      {showCountForm && countStockTake && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">Record Physical Counts</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Stock Take: {countStockTake.reference}
            </p>
            <div className="max-h-[60vh] overflow-y-auto">
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full divide-y">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Item</th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase text-muted-foreground">System Qty</th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase text-muted-foreground">Physical Qty</th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase text-muted-foreground">Variance</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-card">
                    {countStockTake.items.map((item) => {
                      const count = physicalCounts[item.id];
                      const physQty = count?.quantity ?? item.systemQuantity;
                      const variance = physQty - item.systemQuantity;
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm">
                            {item.itemName} ({item.itemUnit})
                          </td>
                          <td className="px-4 py-2 text-right text-sm">{item.systemQuantity}</td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="number"
                              value={physQty}
                              onChange={(e) =>
                                setPhysicalCounts({
                                  ...physicalCounts,
                                  [item.id]: {
                                    quantity: parseInt(e.target.value) || 0,
                                    reason: count?.reason ?? "",
                                  },
                                })
                              }
                              className="w-24 rounded-md border px-2 py-1 text-right text-sm"
                              min="0"
                            />
                          </td>
                          <td className={`px-4 py-2 text-right text-sm font-medium ${
                            variance > 0
                              ? "text-green-600"
                              : variance < 0
                                ? "text-red-600"
                                : "text-muted-foreground"
                          }`}>
                            {variance > 0 ? `+${variance}` : variance}
                          </td>
                          <td className="px-4 py-2">
                            {variance !== 0 && (
                              <input
                                type="text"
                                value={count?.reason ?? ""}
                                onChange={(e) =>
                                  setPhysicalCounts({
                                    ...physicalCounts,
                                    [item.id]: {
                                      quantity: physQty,
                                      reason: e.target.value,
                                    },
                                  })
                                }
                                className="w-full rounded-md border px-2 py-1 text-sm"
                                placeholder="Variance reason"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCountForm(false);
                  setCountStockTake(null);
                }}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCounts}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Counts"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Variance Summary Modal ─────────────────────────────────── */}
      {showVariance && varianceSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">Variance Summary</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Stock Take: {varianceRef}
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total Items</p>
                  <p className="text-lg font-semibold">{varianceSummary.totalItems}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Accuracy Rate</p>
                  <p className="text-lg font-semibold">{varianceSummary.accuracyRate}%</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Counted</p>
                  <p className="text-lg font-semibold">{varianceSummary.countedItems}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Uncounted</p>
                  <p className="text-lg font-semibold">{varianceSummary.uncountedItems}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Matched</p>
                  <p className="text-lg font-semibold text-green-600">{varianceSummary.matchedItems}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Over / Short</p>
                  <p className="text-lg font-semibold">
                    <span className="text-green-600">{varianceSummary.overItems}</span>
                    {" / "}
                    <span className="text-red-600">{varianceSummary.shortItems}</span>
                  </p>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Over Value</p>
                    <p className="text-sm font-semibold text-green-600">{formatCurrency(varianceSummary.overValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Short Value</p>
                    <p className="text-sm font-semibold text-red-600">{formatCurrency(varianceSummary.shortValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net Variance</p>
                    <p className={`text-sm font-semibold ${
                      varianceSummary.netVarianceValue >= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {formatCurrency(varianceSummary.netVarianceValue)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowVariance(false);
                  setVarianceSummary(null);
                }}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
