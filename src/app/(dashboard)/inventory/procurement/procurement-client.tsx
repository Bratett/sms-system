"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  createPurchaseRequestAction,
  approvePurchaseRequestAction,
  rejectPurchaseRequestAction,
  createPurchaseOrderAction,
  updatePurchaseOrderStatusAction,
  receiveGoodsAction,
} from "@/modules/inventory/actions/procurement.action";

// ─── Types ──────────────────────────────────────────────────────────

interface PurchaseRequestRow {
  id: string;
  storeId: string;
  storeName: string;
  requestedBy: string;
  requestedByName: string;
  reason: string | null;
  status: string;
  itemCount: number;
  estimatedTotal: number;
  requestedAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
}

interface PurchaseOrderRow {
  id: string;
  orderNumber: string;
  purchaseRequestId: string | null;
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  status: string;
  itemCount: number;
  orderedBy: string;
  orderedByName: string;
  orderedAt: Date;
}

interface ItemOption {
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

interface StoreOption {
  id: string;
  name: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Component ──────────────────────────────────────────────────────

export function ProcurementClient({
  requests,
  orders,
  allItems,
  stores,
  suppliers,
}: {
  requests: PurchaseRequestRow[];
  orders: PurchaseOrderRow[];
  allItems: ItemOption[];
  stores: StoreOption[];
  suppliers: SupplierOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"requests" | "orders">("requests");

  // ─── Purchase Request Form ──────────────────────────────────────
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestStoreId, setRequestStoreId] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [requestItems, setRequestItems] = useState<
    Array<{ storeItemId: string; quantityRequested: number; estimatedUnitPrice: number }>
  >([]);

  // ─── Purchase Order Form ────────────────────────────────────────
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderSupplierId, setOrderSupplierId] = useState("");
  const [orderItems, setOrderItems] = useState<
    Array<{ storeItemId: string; quantity: number; unitPrice: number }>
  >([]);

  // ─── Receive Goods Form ─────────────────────────────────────────
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [receivePO, setReceivePO] = useState<PurchaseOrderRow | null>(null);
  const [receiveItems, setReceiveItems] = useState<
    Array<{ storeItemId: string; itemName: string; quantityReceived: number; condition: string }>
  >([]);
  const [receiveNotes, setReceiveNotes] = useState("");

  // Filtered items for request
  const requestStoreItems = allItems.filter((i) => i.storeId === requestStoreId);

  // ─── Purchase Request Handlers ──────────────────────────────────

  function openRequestForm() {
    setRequestStoreId(stores[0]?.id ?? "");
    setRequestReason("");
    setRequestItems([]);
    setShowRequestForm(true);
  }

  function addRequestItem() {
    setRequestItems([
      ...requestItems,
      { storeItemId: "", quantityRequested: 1, estimatedUnitPrice: 0 },
    ]);
  }

  function removeRequestItem(idx: number) {
    setRequestItems(requestItems.filter((_, i) => i !== idx));
  }

  function updateRequestItem(idx: number, field: string, value: string | number) {
    const updated = [...requestItems];
    (updated[idx] as Record<string, string | number>)[field] = value;
    // Auto-fill estimated price when item is selected
    if (field === "storeItemId") {
      const item = allItems.find((i) => i.id === value);
      if (item) {
        updated[idx].estimatedUnitPrice = item.unitPrice;
      }
    }
    setRequestItems(updated);
  }

  function handleCreateRequest() {
    if (!requestStoreId) {
      toast.error("Please select a store.");
      return;
    }
    if (requestItems.length === 0) {
      toast.error("Add at least one item.");
      return;
    }
    for (const item of requestItems) {
      if (!item.storeItemId || item.quantityRequested <= 0) {
        toast.error("All items must have a selected item and valid quantity.");
        return;
      }
    }

    startTransition(async () => {
      const result = await createPurchaseRequestAction({
        storeId: requestStoreId,
        reason: requestReason || undefined,
        items: requestItems,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Purchase request created.");
      setShowRequestForm(false);
      router.refresh();
    });
  }

  function handleApproveRequest(id: string) {
    startTransition(async () => {
      const result = await approvePurchaseRequestAction(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Purchase request approved.");
      router.refresh();
    });
  }

  function handleRejectRequest(id: string) {
    if (!confirm("Reject this purchase request?")) return;

    startTransition(async () => {
      const result = await rejectPurchaseRequestAction(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Purchase request rejected.");
      router.refresh();
    });
  }

  // ─── Purchase Order Handlers ────────────────────────────────────

  function openOrderForm() {
    setOrderSupplierId(suppliers[0]?.id ?? "");
    setOrderItems([]);
    setShowOrderForm(true);
  }

  function addOrderItem() {
    setOrderItems([
      ...orderItems,
      { storeItemId: "", quantity: 1, unitPrice: 0 },
    ]);
  }

  function removeOrderItem(idx: number) {
    setOrderItems(orderItems.filter((_, i) => i !== idx));
  }

  function updateOrderItem(idx: number, field: string, value: string | number) {
    const updated = [...orderItems];
    (updated[idx] as Record<string, string | number>)[field] = value;
    if (field === "storeItemId") {
      const item = allItems.find((i) => i.id === value);
      if (item) {
        updated[idx].unitPrice = item.unitPrice;
      }
    }
    setOrderItems(updated);
  }

  const orderTotal = orderItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  function handleCreateOrder() {
    if (!orderSupplierId) {
      toast.error("Please select a supplier.");
      return;
    }
    if (orderItems.length === 0) {
      toast.error("Add at least one item.");
      return;
    }
    for (const item of orderItems) {
      if (!item.storeItemId || item.quantity <= 0) {
        toast.error("All items must have a selected item and valid quantity.");
        return;
      }
    }

    startTransition(async () => {
      const result = await createPurchaseOrderAction({
        supplierId: orderSupplierId,
        items: orderItems,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Purchase order created.");
      setShowOrderForm(false);
      router.refresh();
    });
  }

  function handleSendOrder(id: string) {
    startTransition(async () => {
      const result = await updatePurchaseOrderStatusAction(id, "SENT");
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Purchase order marked as sent.");
      router.refresh();
    });
  }

  // ─── Receive Goods Handlers ─────────────────────────────────────

  function openReceiveForm(po: PurchaseOrderRow) {
    setReceivePO(po);
    // Pre-populate items from order items by looking at what items belong to this order
    // We'll use a simple approach: let user add items to receive
    setReceiveItems([]);
    setReceiveNotes("");
    setShowReceiveForm(true);
  }

  function addReceiveItem() {
    setReceiveItems([
      ...receiveItems,
      { storeItemId: "", itemName: "", quantityReceived: 1, condition: "Good" },
    ]);
  }

  function removeReceiveItem(idx: number) {
    setReceiveItems(receiveItems.filter((_, i) => i !== idx));
  }

  function updateReceiveItem(idx: number, field: string, value: string | number) {
    const updated = [...receiveItems];
    (updated[idx] as Record<string, string | number>)[field] = value;
    if (field === "storeItemId") {
      const item = allItems.find((i) => i.id === value);
      if (item) {
        updated[idx].itemName = item.name;
      }
    }
    setReceiveItems(updated);
  }

  function handleReceiveGoods() {
    if (!receivePO) return;
    if (receiveItems.length === 0) {
      toast.error("Add at least one item to receive.");
      return;
    }
    for (const item of receiveItems) {
      if (!item.storeItemId || item.quantityReceived <= 0) {
        toast.error("All items must have a selected item and valid quantity.");
        return;
      }
    }

    startTransition(async () => {
      const result = await receiveGoodsAction({
        purchaseOrderId: receivePO!.id,
        items: receiveItems.map((i) => ({
          storeItemId: i.storeItemId,
          quantityReceived: i.quantityReceived,
          condition: i.condition,
        })),
        notes: receiveNotes || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Goods received and stock updated.");
      setShowReceiveForm(false);
      router.refresh();
    });
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        <button
          onClick={() => setActiveTab("requests")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "requests"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Purchase Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "orders"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Purchase Orders ({orders.length})
        </button>
      </div>

      {/* ─── Purchase Requests Tab ─────────────────────────────────── */}
      {activeTab === "requests" && (
        <>
          <div className="flex justify-end">
            <button
              onClick={openRequestForm}
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              New Request
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Store</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Requested By</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Est. Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-card">
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-sm">{r.storeName}</td>
                    <td className="px-4 py-3 text-sm">{r.requestedByName}</td>
                    <td className="px-4 py-3 text-right text-sm">{r.itemCount}</td>
                    <td className="px-4 py-3 text-right text-sm">{formatCurrency(r.estimatedTotal)}</td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(r.requestedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "PENDING" && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleApproveRequest(r.id)}
                            disabled={isPending}
                            className="text-xs text-green-600 hover:underline"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectRequest(r.id)}
                            disabled={isPending}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No purchase requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── Purchase Orders Tab ───────────────────────────────────── */}
      {activeTab === "orders" && (
        <>
          <div className="flex justify-end">
            <button
              onClick={openOrderForm}
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              New PO
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">PO #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Supplier</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-card">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 text-sm font-medium">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-sm">{o.supplierName}</td>
                    <td className="px-4 py-3 text-right text-sm">{o.itemCount}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(o.orderedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {o.status === "DRAFT" && (
                          <button
                            onClick={() => handleSendOrder(o.id)}
                            disabled={isPending}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Mark Sent
                          </button>
                        )}
                        {(o.status === "SENT" || o.status === "PARTIALLY_RECEIVED") && (
                          <button
                            onClick={() => openReceiveForm(o)}
                            disabled={isPending}
                            className="text-xs text-green-600 hover:underline"
                          >
                            Receive Goods
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No purchase orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── New Purchase Request Modal ────────────────────────────── */}
      {showRequestForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New Purchase Request</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Store *</label>
                <select
                  value={requestStoreId}
                  onChange={(e) => {
                    setRequestStoreId(e.target.value);
                    setRequestItems([]);
                  }}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select store</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Reason</label>
                <input
                  type="text"
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Reason for request"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">Items *</label>
                  <button
                    type="button"
                    onClick={addRequestItem}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add Item
                  </button>
                </div>
                {requestItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">No items added yet.</p>
                )}
                <div className="space-y-2">
                  {requestItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={item.storeItemId}
                        onChange={(e) => updateRequestItem(idx, "storeItemId", e.target.value)}
                        className="flex-1 rounded-md border px-2 py-1.5 text-sm"
                      >
                        <option value="">Select item</option>
                        {requestStoreItems.map((si) => (
                          <option key={si.id} value={si.id}>{si.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={item.quantityRequested}
                        onChange={(e) => updateRequestItem(idx, "quantityRequested", parseInt(e.target.value) || 0)}
                        className="w-20 rounded-md border px-2 py-1.5 text-sm"
                        min="1"
                        placeholder="Qty"
                      />
                      <input
                        type="number"
                        value={item.estimatedUnitPrice}
                        onChange={(e) => updateRequestItem(idx, "estimatedUnitPrice", parseFloat(e.target.value) || 0)}
                        className="w-24 rounded-md border px-2 py-1.5 text-sm"
                        min="0"
                        step="0.01"
                        placeholder="Price"
                      />
                      <button
                        onClick={() => removeRequestItem(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                {requestItems.length > 0 && (
                  <p className="mt-2 text-right text-sm font-medium">
                    Estimated Total: {formatCurrency(
                      requestItems.reduce((sum, i) => sum + i.quantityRequested * i.estimatedUnitPrice, 0),
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowRequestForm(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRequest}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── New Purchase Order Modal ──────────────────────────────── */}
      {showOrderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New Purchase Order</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Supplier *</label>
                <select
                  value={orderSupplierId}
                  onChange={(e) => setOrderSupplierId(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">Items *</label>
                  <button
                    type="button"
                    onClick={addOrderItem}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add Item
                  </button>
                </div>
                {orderItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">No items added yet.</p>
                )}
                <div className="space-y-2">
                  {orderItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={item.storeItemId}
                        onChange={(e) => updateOrderItem(idx, "storeItemId", e.target.value)}
                        className="flex-1 rounded-md border px-2 py-1.5 text-sm"
                      >
                        <option value="">Select item</option>
                        {stores.map((store) => (
                          <optgroup key={store.id} label={store.name}>
                            {allItems
                              .filter((i) => i.storeId === store.id)
                              .map((si) => (
                                <option key={si.id} value={si.id}>{si.name}</option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(idx, "quantity", parseInt(e.target.value) || 0)}
                        className="w-20 rounded-md border px-2 py-1.5 text-sm"
                        min="1"
                        placeholder="Qty"
                      />
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateOrderItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="w-24 rounded-md border px-2 py-1.5 text-sm"
                        min="0"
                        step="0.01"
                        placeholder="Price"
                      />
                      <span className="w-24 text-right text-sm text-muted-foreground">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </span>
                      <button
                        onClick={() => removeOrderItem(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                {orderItems.length > 0 && (
                  <p className="mt-2 text-right text-sm font-semibold">
                    Total: {formatCurrency(orderTotal)}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowOrderForm(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create PO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Receive Goods Modal ───────────────────────────────────── */}
      {showReceiveForm && receivePO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">Receive Goods</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              PO: {receivePO.orderNumber} | Supplier: {receivePO.supplierName}
            </p>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">Items Received *</label>
                  <button
                    type="button"
                    onClick={addReceiveItem}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add Item
                  </button>
                </div>
                {receiveItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">No items added yet.</p>
                )}
                <div className="space-y-2">
                  {receiveItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={item.storeItemId}
                        onChange={(e) => updateReceiveItem(idx, "storeItemId", e.target.value)}
                        className="flex-1 rounded-md border px-2 py-1.5 text-sm"
                      >
                        <option value="">Select item</option>
                        {stores.map((store) => (
                          <optgroup key={store.id} label={store.name}>
                            {allItems
                              .filter((i) => i.storeId === store.id)
                              .map((si) => (
                                <option key={si.id} value={si.id}>{si.name}</option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={item.quantityReceived}
                        onChange={(e) => updateReceiveItem(idx, "quantityReceived", parseInt(e.target.value) || 0)}
                        className="w-20 rounded-md border px-2 py-1.5 text-sm"
                        min="1"
                        placeholder="Qty"
                      />
                      <select
                        value={item.condition}
                        onChange={(e) => updateReceiveItem(idx, "condition", e.target.value)}
                        className="w-28 rounded-md border px-2 py-1.5 text-sm"
                      >
                        <option value="Good">Good</option>
                        <option value="Damaged">Damaged</option>
                        <option value="Expired">Expired</option>
                      </select>
                      <button
                        onClick={() => removeReceiveItem(idx)}
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
              <div>
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <textarea
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Any notes about the delivery"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowReceiveForm(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleReceiveGoods}
                disabled={isPending}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? "Processing..." : "Receive Goods"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
