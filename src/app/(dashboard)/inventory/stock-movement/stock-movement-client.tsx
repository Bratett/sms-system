"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  recordStockInAction,
  recordStockOutAction,
  adjustStockAction,
} from "@/modules/inventory/actions/stock.action";

// ─── Types ──────────────────────────────────────────────────────────

interface MovementRow {
  id: string;
  storeItemId: string;
  itemName: string;
  itemUnit: string;
  storeId: string;
  storeName: string;
  type: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  issuedTo: string | null;
  conductedBy: string;
  conductedByName: string;
  conductedAt: Date;
}

interface ItemOption {
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  quantity: number;
  unit: string;
}

interface StoreOption {
  id: string;
  name: string;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const movementTypeBadge: Record<string, string> = {
  IN: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  OUT: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  ADJUSTMENT: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  DAMAGED: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  EXPIRED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  RETURNED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
};

// ─── Component ──────────────────────────────────────────────────────

export function StockMovementClient({
  movements,
  total,
  page,
  pageSize,
  allItems,
  stores,
  filters,
}: {
  movements: MovementRow[];
  total: number;
  page: number;
  pageSize: number;
  allItems: ItemOption[];
  stores: StoreOption[];
  filters: { storeId?: string; type?: string; dateFrom?: string; dateTo?: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters
  const [storeId, setStoreId] = useState(filters.storeId ?? "");
  const [type, setType] = useState(filters.type ?? "");
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(filters.dateTo ?? "");

  // Modals
  const [showStockIn, setShowStockIn] = useState(false);
  const [showStockOut, setShowStockOut] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);

  // Stock In form
  const [stockInForm, setStockInForm] = useState({
    storeItemId: "",
    quantity: 1,
    reason: "",
  });

  // Stock Out form
  const [stockOutForm, setStockOutForm] = useState({
    storeItemId: "",
    quantity: 1,
    issuedTo: "",
    reason: "",
  });

  // Adjust form
  const [adjustForm, setAdjustForm] = useState({
    storeItemId: "",
    newQuantity: 0,
    reason: "",
  });

  const totalPages = Math.ceil(total / pageSize);

  // Group items by store for dropdowns
  const itemsByStore = stores.map((store) => ({
    ...store,
    items: allItems.filter((i) => i.storeId === store.id),
  }));

  // ─── Filter ─────────────────────────────────────────────────────

  function applyFilters() {
    const params = new URLSearchParams();
    if (storeId) params.set("storeId", storeId);
    if (type) params.set("type", type);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    router.push(`/inventory/stock-movement?${params.toString()}`);
  }

  function clearFilters() {
    setStoreId("");
    setType("");
    setDateFrom("");
    setDateTo("");
    router.push("/inventory/stock-movement");
  }

  function goToPage(p: number) {
    const params = new URLSearchParams();
    if (storeId) params.set("storeId", storeId);
    if (type) params.set("type", type);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("page", String(p));
    router.push(`/inventory/stock-movement?${params.toString()}`);
  }

  // ─── Stock In ───────────────────────────────────────────────────

  function handleStockIn() {
    if (!stockInForm.storeItemId) {
      toast.error("Please select an item.");
      return;
    }
    if (stockInForm.quantity <= 0) {
      toast.error("Quantity must be greater than zero.");
      return;
    }

    startTransition(async () => {
      const result = await recordStockInAction({
        storeItemId: stockInForm.storeItemId,
        quantity: stockInForm.quantity,
        reason: stockInForm.reason || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock in recorded successfully.");
      setShowStockIn(false);
      setStockInForm({ storeItemId: "", quantity: 1, reason: "" });
      router.refresh();
    });
  }

  // ─── Stock Out ──────────────────────────────────────────────────

  function handleStockOut() {
    if (!stockOutForm.storeItemId) {
      toast.error("Please select an item.");
      return;
    }
    if (stockOutForm.quantity <= 0) {
      toast.error("Quantity must be greater than zero.");
      return;
    }

    startTransition(async () => {
      const result = await recordStockOutAction({
        storeItemId: stockOutForm.storeItemId,
        quantity: stockOutForm.quantity,
        issuedTo: stockOutForm.issuedTo || undefined,
        reason: stockOutForm.reason || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock out recorded successfully.");
      setShowStockOut(false);
      setStockOutForm({ storeItemId: "", quantity: 1, issuedTo: "", reason: "" });
      router.refresh();
    });
  }

  // ─── Adjust ─────────────────────────────────────────────────────

  function handleAdjust() {
    if (!adjustForm.storeItemId) {
      toast.error("Please select an item.");
      return;
    }
    if (!adjustForm.reason.trim()) {
      toast.error("A reason is required for adjustments.");
      return;
    }

    startTransition(async () => {
      const result = await adjustStockAction({
        storeItemId: adjustForm.storeItemId,
        newQuantity: adjustForm.newQuantity,
        reason: adjustForm.reason,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock adjustment recorded successfully.");
      setShowAdjust(false);
      setAdjustForm({ storeItemId: "", newQuantity: 0, reason: "" });
      router.refresh();
    });
  }

  // Helper: get selected item info
  function getSelectedItem(id: string) {
    return allItems.find((i) => i.id === id);
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            setStockInForm({ storeItemId: "", quantity: 1, reason: "" });
            setShowStockIn(true);
          }}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Stock In
        </button>
        <button
          onClick={() => {
            setStockOutForm({ storeItemId: "", quantity: 1, issuedTo: "", reason: "" });
            setShowStockOut(true);
          }}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Stock Out
        </button>
        <button
          onClick={() => {
            setAdjustForm({ storeItemId: "", newQuantity: 0, reason: "" });
            setShowAdjust(true);
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Adjust Stock
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Store</label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
            <option value="ADJUSTMENT">ADJUSTMENT</option>
            <option value="DAMAGED">DAMAGED</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="RETURNED">RETURNED</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Date To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={applyFilters}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filter
        </button>
        <button
          onClick={clearFilters}
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          Clear
        </button>
      </div>

      {/* Movement History Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Item</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Store</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Qty</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Change</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Reason</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Conducted By</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {movements.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(m.conductedAt)}
                </td>
                <td className="px-4 py-3 text-sm font-medium">{m.itemName}</td>
                <td className="px-4 py-3 text-sm">{m.storeName}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${movementTypeBadge[m.type] ?? ""}`}>
                    {m.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium">
                  {m.type === "IN" || m.type === "RETURNED" ? "+" : m.type === "ADJUSTMENT" ? "" : "-"}
                  {m.quantity}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {m.previousQuantity} &rarr; {m.newQuantity}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {m.reason ?? "-"}
                  {m.issuedTo && <span className="block text-xs">Issued to: {m.issuedTo}</span>}
                </td>
                <td className="px-4 py-3 text-sm">{m.conductedByName}</td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No stock movements found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Stock In Modal */}
      {showStockIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-green-700">Stock In</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Item *</label>
                <select
                  value={stockInForm.storeItemId}
                  onChange={(e) => setStockInForm({ ...stockInForm, storeItemId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select item</option>
                  {itemsByStore.map((store) => (
                    <optgroup key={store.id} label={store.name}>
                      {store.items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} (current: {item.quantity} {item.unit})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Quantity *</label>
                <input
                  type="number"
                  value={stockInForm.quantity}
                  onChange={(e) => setStockInForm({ ...stockInForm, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  min="1"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Reason</label>
                <input
                  type="text"
                  value={stockInForm.reason}
                  onChange={(e) => setStockInForm({ ...stockInForm, reason: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. Purchase, Donation, Return"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowStockIn(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleStockIn}
                disabled={isPending}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? "Recording..." : "Record Stock In"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Out Modal */}
      {showStockOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-red-700">Stock Out</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Item *</label>
                <select
                  value={stockOutForm.storeItemId}
                  onChange={(e) => setStockOutForm({ ...stockOutForm, storeItemId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select item</option>
                  {itemsByStore.map((store) => (
                    <optgroup key={store.id} label={store.name}>
                      {store.items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} (available: {item.quantity} {item.unit})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {stockOutForm.storeItemId && (
                <p className="text-xs text-muted-foreground">
                  Available: {getSelectedItem(stockOutForm.storeItemId)?.quantity ?? 0}{" "}
                  {getSelectedItem(stockOutForm.storeItemId)?.unit ?? ""}
                </p>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Quantity *</label>
                <input
                  type="number"
                  value={stockOutForm.quantity}
                  onChange={(e) => setStockOutForm({ ...stockOutForm, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  min="1"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Issued To</label>
                <input
                  type="text"
                  value={stockOutForm.issuedTo}
                  onChange={(e) => setStockOutForm({ ...stockOutForm, issuedTo: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. Kitchen, Science Lab, Class 3A"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Reason</label>
                <input
                  type="text"
                  value={stockOutForm.reason}
                  onChange={(e) => setStockOutForm({ ...stockOutForm, reason: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. Classroom supplies, Maintenance"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowStockOut(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleStockOut}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Recording..." : "Record Stock Out"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-blue-700">Adjust Stock</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Item *</label>
                <select
                  value={adjustForm.storeItemId}
                  onChange={(e) => {
                    const item = getSelectedItem(e.target.value);
                    setAdjustForm({
                      ...adjustForm,
                      storeItemId: e.target.value,
                      newQuantity: item?.quantity ?? 0,
                    });
                  }}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select item</option>
                  {itemsByStore.map((store) => (
                    <optgroup key={store.id} label={store.name}>
                      {store.items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} (current: {item.quantity} {item.unit})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {adjustForm.storeItemId && (
                <p className="text-xs text-muted-foreground">
                  Current quantity: {getSelectedItem(adjustForm.storeItemId)?.quantity ?? 0}{" "}
                  {getSelectedItem(adjustForm.storeItemId)?.unit ?? ""}
                </p>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">New Quantity *</label>
                <input
                  type="number"
                  value={adjustForm.newQuantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, newQuantity: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  min="0"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Reason *</label>
                <input
                  type="text"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. Physical count correction, Damage writeoff"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowAdjust(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjust}
                disabled={isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? "Recording..." : "Record Adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
