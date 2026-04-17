"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  createTransferAction,
  approveTransferAction,
  receiveTransferAction,
  cancelTransferAction,
  getTransferAction,
} from "@/modules/inventory/actions/transfer.action";
import { getItemsAction } from "@/modules/inventory/actions/item.action";

// ─── Types ──────────────────────────────────────────────────────────

interface TransferRow {
  id: string;
  transferNumber: string;
  fromStoreId: string;
  fromStoreName: string;
  toStoreId: string;
  toStoreName: string;
  requestedBy: string;
  requestedByName: string;
  approvedBy: string | null;
  approvedByName: string | null;
  status: string;
  reason: string | null;
  itemCount: number;
  requestedAt: Date;
  approvedAt: Date | null;
  completedAt: Date | null;
}

interface StoreOption {
  id: string;
  name: string;
}

interface StoreItemOption {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Component ──────────────────────────────────────────────────────

export function TransfersClient({
  transfers: initialTransfers,
  stores,
}: {
  transfers: TransferRow[];
  stores: StoreOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ─── Filters ─────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStore, setFilterStore] = useState("");

  const filtered = initialTransfers.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterStore && t.fromStoreId !== filterStore && t.toStoreId !== filterStore) return false;
    return true;
  });

  // ─── Create Transfer Form ────────────────────────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [fromStoreId, setFromStoreId] = useState("");
  const [toStoreId, setToStoreId] = useState("");
  const [reason, setReason] = useState("");
  const [transferItems, setTransferItems] = useState<
    Array<{ storeItemId: string; quantity: number }>
  >([]);
  const [sourceItems, setSourceItems] = useState<StoreItemOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // ─── Receive Transfer Form ───────────────────────────────────────
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [receiveTransfer, setReceiveTransfer] = useState<{
    id: string;
    transferNumber: string;
    items: Array<{
      id: string;
      storeItemId: string;
      itemName: string;
      itemUnit: string;
      quantity: number;
      availableQty: number;
    }>;
  } | null>(null);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});

  // ─── Load Source Store Items ──────────────────────────────────────

  async function loadSourceItems(storeId: string) {
    if (!storeId) {
      setSourceItems([]);
      return;
    }
    setLoadingItems(true);
    const result = await getItemsAction({ storeId, pageSize: 500 });
    if ("data" in result && result.data) {
      setSourceItems(
        result.data.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
        })),
      );
    }
    setLoadingItems(false);
  }

  // ─── Create Transfer Handlers ────────────────────────────────────

  function openCreateForm() {
    setFromStoreId("");
    setToStoreId("");
    setReason("");
    setTransferItems([]);
    setSourceItems([]);
    setShowCreateForm(true);
  }

  function addTransferItem() {
    setTransferItems([...transferItems, { storeItemId: "", quantity: 1 }]);
  }

  function removeTransferItem(idx: number) {
    setTransferItems(transferItems.filter((_, i) => i !== idx));
  }

  function updateTransferItem(idx: number, field: string, value: string | number) {
    const updated = [...transferItems];
    (updated[idx] as Record<string, string | number>)[field] = value;
    setTransferItems(updated);
  }

  function handleCreate() {
    if (!fromStoreId) {
      toast.error("Please select a source store.");
      return;
    }
    if (!toStoreId) {
      toast.error("Please select a destination store.");
      return;
    }
    if (fromStoreId === toStoreId) {
      toast.error("Source and destination stores must be different.");
      return;
    }
    if (transferItems.length === 0) {
      toast.error("Add at least one item.");
      return;
    }
    for (const item of transferItems) {
      if (!item.storeItemId || item.quantity <= 0) {
        toast.error("All items must have a selected item and valid quantity.");
        return;
      }
    }

    startTransition(async () => {
      const result = await createTransferAction({
        fromStoreId,
        toStoreId,
        reason: reason || undefined,
        items: transferItems,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Transfer request created.");
      setShowCreateForm(false);
      router.refresh();
    });
  }

  // ─── Action Handlers ─────────────────────────────────────────────

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveTransferAction(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Transfer approved.");
      router.refresh();
    });
  }

  function handleCancel(id: string) {
    if (!confirm("Cancel this transfer?")) return;
    startTransition(async () => {
      const result = await cancelTransferAction(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Transfer cancelled.");
      router.refresh();
    });
  }

  async function openReceiveForm(transferId: string) {
    const result = await getTransferAction(transferId);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if (!result.data) {
      toast.error("Failed to load transfer details.");
      return;
    }
    const detail = result.data;
    setReceiveTransfer({
      id: detail.id,
      transferNumber: detail.transferNumber,
      items: detail.items.map((i: any) => ({
        id: i.id,
        storeItemId: i.storeItemId,
        itemName: i.itemName,
        itemUnit: i.itemUnit,
        quantity: i.quantity,
        availableQty: i.availableQty,
      })),
    });
    const qtys: Record<string, number> = {};
    for (const item of detail.items) {
      qtys[item.id] = item.quantity;
    }
    setReceivedQtys(qtys);
    setShowReceiveForm(true);
  }

  function handleReceive() {
    if (!receiveTransfer) return;

    const receivedItems = receiveTransfer.items.map((item) => ({
      storeTransferItemId: item.id,
      receivedQty: receivedQtys[item.id] ?? 0,
    }));

    startTransition(async () => {
      const result = await receiveTransferAction(receiveTransfer.id, receivedItems);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Transfer received successfully.");
      setShowReceiveForm(false);
      setReceiveTransfer(null);
      router.refresh();
    });
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
          <option value="PENDING">Pending</option>
          <option value="IN_TRANSIT">In Transit</option>
          <option value="RECEIVED">Received</option>
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
            New Transfer
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Transfer #</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">From Store</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">To Store</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Items</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Requested By</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {filtered.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 text-sm font-medium">{t.transferNumber}</td>
                <td className="px-4 py-3 text-sm">{t.fromStoreName}</td>
                <td className="px-4 py-3 text-sm">{t.toStoreName}</td>
                <td className="px-4 py-3 text-right text-sm">{t.itemCount}</td>
                <td className="px-4 py-3 text-sm">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-4 py-3 text-sm">{t.requestedByName}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(t.requestedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {t.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleApprove(t.id)}
                          disabled={isPending}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleCancel(t.id)}
                          disabled={isPending}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {(t.status === "IN_TRANSIT" || t.status === "APPROVED") && (
                      <>
                        <button
                          onClick={() => openReceiveForm(t.id)}
                          disabled={isPending}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Receive
                        </button>
                        <button
                          onClick={() => handleCancel(t.id)}
                          disabled={isPending}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No transfers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Create Transfer Modal ──────────────────────────────────── */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New Transfer</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">From Store *</label>
                  <select
                    value={fromStoreId}
                    onChange={(e) => {
                      setFromStoreId(e.target.value);
                      setTransferItems([]);
                      loadSourceItems(e.target.value);
                    }}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Select source store</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">To Store *</label>
                  <select
                    value={toStoreId}
                    onChange={(e) => setToStoreId(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Select destination store</option>
                    {stores
                      .filter((s) => s.id !== fromStoreId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Reason for transfer"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">Items *</label>
                  <button
                    type="button"
                    onClick={addTransferItem}
                    disabled={!fromStoreId}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    + Add Item
                  </button>
                </div>
                {loadingItems && (
                  <p className="text-sm text-muted-foreground">Loading items...</p>
                )}
                {!loadingItems && transferItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">No items added yet.</p>
                )}
                <div className="space-y-2">
                  {transferItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={item.storeItemId}
                        onChange={(e) => updateTransferItem(idx, "storeItemId", e.target.value)}
                        className="flex-1 rounded-md border px-2 py-1.5 text-sm"
                      >
                        <option value="">Select item</option>
                        {sourceItems.map((si) => (
                          <option key={si.id} value={si.id}>
                            {si.name} (Avail: {si.quantity} {si.unit})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateTransferItem(idx, "quantity", parseInt(e.target.value) || 0)}
                        className="w-24 rounded-md border px-2 py-1.5 text-sm"
                        min="1"
                        placeholder="Qty"
                      />
                      <button
                        onClick={() => removeTransferItem(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
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
                {isPending ? "Creating..." : "Create Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Receive Transfer Modal ─────────────────────────────────── */}
      {showReceiveForm && receiveTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">Receive Transfer</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Transfer: {receiveTransfer.transferNumber}
            </p>
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full divide-y">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Item</th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase text-muted-foreground">Sent Qty</th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase text-muted-foreground">Received Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-card">
                    {receiveTransfer.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-sm">
                          {item.itemName} ({item.itemUnit})
                        </td>
                        <td className="px-4 py-2 text-right text-sm">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            value={receivedQtys[item.id] ?? 0}
                            onChange={(e) =>
                              setReceivedQtys({
                                ...receivedQtys,
                                [item.id]: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-24 rounded-md border px-2 py-1 text-right text-sm"
                            min="0"
                            max={item.quantity}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowReceiveForm(false);
                  setReceiveTransfer(null);
                }}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleReceive}
                disabled={isPending}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? "Processing..." : "Confirm Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
