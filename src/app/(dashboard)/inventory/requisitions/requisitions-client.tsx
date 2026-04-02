"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  createRequisitionAction,
  approveRequisitionAction,
  rejectRequisitionAction,
  issueRequisitionAction,
  getRequisitionAction,
} from "@/modules/inventory/actions/requisition.action";
import { getItemsAction } from "@/modules/inventory/actions/item.action";

// ─── Types ──────────────────────────────────────────────────────────

interface RequisitionRow {
  id: string;
  requisitionNumber: string;
  storeId: string;
  storeName: string;
  department: string;
  requestedBy: string;
  requestedByName: string;
  approvedBy: string | null;
  approvedByName: string | null;
  issuedBy: string | null;
  issuedByName: string | null;
  status: string;
  purpose: string | null;
  itemCount: number;
  requestedAt: Date;
  approvedAt: Date | null;
  issuedAt: Date | null;
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

export function RequisitionsClient({
  requisitions: initialRequisitions,
  stores,
}: {
  requisitions: RequisitionRow[];
  stores: StoreOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ─── Filters ─────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterStore, setFilterStore] = useState("");

  const departments = [...new Set(initialRequisitions.map((r) => r.department))].sort();

  const filtered = initialRequisitions.filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterDepartment && r.department !== filterDepartment) return false;
    if (filterStore && r.storeId !== filterStore) return false;
    return true;
  });

  // ─── Create Requisition Form ─────────────────────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [reqStoreId, setReqStoreId] = useState("");
  const [reqDepartment, setReqDepartment] = useState("");
  const [reqPurpose, setReqPurpose] = useState("");
  const [reqItems, setReqItems] = useState<
    Array<{ storeItemId: string; quantityRequested: number }>
  >([]);
  const [storeItems, setStoreItems] = useState<StoreItemOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // ─── Issue Items Form ────────────────────────────────────────────
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueRequisition, setIssueRequisition] = useState<{
    id: string;
    requisitionNumber: string;
    items: Array<{
      id: string;
      storeItemId: string;
      itemName: string;
      itemUnit: string;
      quantityRequested: number;
      quantityIssued: number | null;
      availableQty: number;
    }>;
  } | null>(null);
  const [issueQtys, setIssueQtys] = useState<Record<string, number>>({});

  // ─── Load Store Items ────────────────────────────────────────────

  async function loadStoreItems(storeId: string) {
    if (!storeId) {
      setStoreItems([]);
      return;
    }
    setLoadingItems(true);
    const result = await getItemsAction({ storeId, pageSize: 500 });
    if ("data" in result && result.data) {
      setStoreItems(
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

  // ─── Create Requisition Handlers ─────────────────────────────────

  function openCreateForm() {
    setReqStoreId("");
    setReqDepartment("");
    setReqPurpose("");
    setReqItems([]);
    setStoreItems([]);
    setShowCreateForm(true);
  }

  function addReqItem() {
    setReqItems([...reqItems, { storeItemId: "", quantityRequested: 1 }]);
  }

  function removeReqItem(idx: number) {
    setReqItems(reqItems.filter((_, i) => i !== idx));
  }

  function updateReqItem(idx: number, field: string, value: string | number) {
    const updated = [...reqItems];
    (updated[idx] as Record<string, string | number>)[field] = value;
    setReqItems(updated);
  }

  function handleCreate() {
    if (!reqStoreId) {
      toast.error("Please select a store.");
      return;
    }
    if (!reqDepartment.trim()) {
      toast.error("Department is required.");
      return;
    }
    if (reqItems.length === 0) {
      toast.error("Add at least one item.");
      return;
    }
    for (const item of reqItems) {
      if (!item.storeItemId || item.quantityRequested <= 0) {
        toast.error("All items must have a selected item and valid quantity.");
        return;
      }
    }

    startTransition(async () => {
      const result = await createRequisitionAction({
        storeId: reqStoreId,
        department: reqDepartment.trim(),
        purpose: reqPurpose || undefined,
        items: reqItems,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Requisition created.");
      setShowCreateForm(false);
      router.refresh();
    });
  }

  // ─── Action Handlers ─────────────────────────────────────────────

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveRequisitionAction(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Requisition approved.");
      router.refresh();
    });
  }

  function handleReject(id: string) {
    if (!confirm("Reject this requisition?")) return;
    startTransition(async () => {
      const result = await rejectRequisitionAction(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Requisition rejected.");
      router.refresh();
    });
  }

  async function openIssueForm(requisitionId: string) {
    const result = await getRequisitionAction(requisitionId);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if (!result.data) {
      toast.error("Failed to load requisition details.");
      return;
    }
    const detail = result.data;
    setIssueRequisition({
      id: detail.id,
      requisitionNumber: detail.requisitionNumber,
      items: detail.items.map((i: any) => ({
        id: i.id,
        storeItemId: i.storeItemId,
        itemName: i.itemName,
        itemUnit: i.itemUnit,
        quantityRequested: i.quantityRequested,
        quantityIssued: i.quantityIssued,
        availableQty: i.availableQty,
      })),
    });
    const qtys: Record<string, number> = {};
    for (const item of detail.items) {
      const remaining = item.quantityRequested - (item.quantityIssued ?? 0);
      qtys[item.id] = Math.min(remaining, item.availableQty);
    }
    setIssueQtys(qtys);
    setShowIssueForm(true);
  }

  function handleIssue() {
    if (!issueRequisition) return;

    const issuedItems = issueRequisition.items
      .filter((item) => (issueQtys[item.id] ?? 0) > 0)
      .map((item) => ({
        requisitionItemId: item.id,
        quantityIssued: issueQtys[item.id] ?? 0,
      }));

    if (issuedItems.length === 0) {
      toast.error("Enter a quantity to issue for at least one item.");
      return;
    }

    startTransition(async () => {
      const result = await issueRequisitionAction(issueRequisition.id, issuedItems);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Items issued successfully.");
      setShowIssueForm(false);
      setIssueRequisition(null);
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
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="PARTIALLY_ISSUED">Partially Issued</option>
          <option value="ISSUED">Issued</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
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
            New Requisition
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Requisition #</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Store</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Department</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Items</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Requested By</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-sm font-medium">{r.requisitionNumber}</td>
                <td className="px-4 py-3 text-sm">{r.storeName}</td>
                <td className="px-4 py-3 text-sm">{r.department}</td>
                <td className="px-4 py-3 text-right text-sm">{r.itemCount}</td>
                <td className="px-4 py-3 text-sm">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-sm">{r.requestedByName}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(r.requestedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {r.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleApprove(r.id)}
                          disabled={isPending}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(r.id)}
                          disabled={isPending}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {(r.status === "APPROVED" || r.status === "PARTIALLY_ISSUED") && (
                      <button
                        onClick={() => openIssueForm(r.id)}
                        disabled={isPending}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Issue Items
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No requisitions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Create Requisition Modal ───────────────────────────────── */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New Requisition</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Store *</label>
                  <select
                    value={reqStoreId}
                    onChange={(e) => {
                      setReqStoreId(e.target.value);
                      setReqItems([]);
                      loadStoreItems(e.target.value);
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
                  <label className="mb-1 block text-sm font-medium">Department *</label>
                  <input
                    type="text"
                    value={reqDepartment}
                    onChange={(e) => setReqDepartment(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="e.g. Science Department"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Purpose</label>
                <textarea
                  value={reqPurpose}
                  onChange={(e) => setReqPurpose(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Purpose of requisition"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">Items *</label>
                  <button
                    type="button"
                    onClick={addReqItem}
                    disabled={!reqStoreId}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    + Add Item
                  </button>
                </div>
                {loadingItems && (
                  <p className="text-sm text-muted-foreground">Loading items...</p>
                )}
                {!loadingItems && reqItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">No items added yet.</p>
                )}
                <div className="space-y-2">
                  {reqItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={item.storeItemId}
                        onChange={(e) => updateReqItem(idx, "storeItemId", e.target.value)}
                        className="flex-1 rounded-md border px-2 py-1.5 text-sm"
                      >
                        <option value="">Select item</option>
                        {storeItems.map((si) => (
                          <option key={si.id} value={si.id}>
                            {si.name} (Avail: {si.quantity} {si.unit})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={item.quantityRequested}
                        onChange={(e) => updateReqItem(idx, "quantityRequested", parseInt(e.target.value) || 0)}
                        className="w-24 rounded-md border px-2 py-1.5 text-sm"
                        min="1"
                        placeholder="Qty"
                      />
                      <button
                        onClick={() => removeReqItem(idx)}
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
                {isPending ? "Creating..." : "Create Requisition"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Issue Items Modal ──────────────────────────────────────── */}
      {showIssueForm && issueRequisition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">Issue Items</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Requisition: {issueRequisition.requisitionNumber}
            </p>
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full divide-y">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Item</th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase text-muted-foreground">Requested</th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase text-muted-foreground">Issued</th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase text-muted-foreground">Available</th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase text-muted-foreground">Issue Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-card">
                    {issueRequisition.items.map((item) => {
                      const remaining = item.quantityRequested - (item.quantityIssued ?? 0);
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm">
                            {item.itemName} ({item.itemUnit})
                          </td>
                          <td className="px-4 py-2 text-right text-sm">{item.quantityRequested}</td>
                          <td className="px-4 py-2 text-right text-sm">{item.quantityIssued ?? 0}</td>
                          <td className="px-4 py-2 text-right text-sm">{item.availableQty}</td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="number"
                              value={issueQtys[item.id] ?? 0}
                              onChange={(e) =>
                                setIssueQtys({
                                  ...issueQtys,
                                  [item.id]: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-24 rounded-md border px-2 py-1 text-right text-sm"
                              min="0"
                              max={Math.min(remaining, item.availableQty)}
                            />
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
                  setShowIssueForm(false);
                  setIssueRequisition(null);
                }}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleIssue}
                disabled={isPending}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? "Processing..." : "Issue Items"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
