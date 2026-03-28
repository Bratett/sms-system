"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createItemAction,
  updateItemAction,
  deleteItemAction,
} from "@/modules/inventory/actions/item.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ItemRow {
  id: string;
  storeId: string;
  storeName: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  code: string | null;
  unit: string;
  quantity: number;
  reorderLevel: number;
  unitPrice: number;
  value: number;
  description: string | null;
  status: string;
  isLowStock: boolean;
  createdAt: Date;
}

interface StoreOption {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Component ──────────────────────────────────────────────────────

export function ItemsClient({
  items,
  total,
  page,
  pageSize,
  stores,
  categories,
  filters,
}: {
  items: ItemRow[];
  total: number;
  page: number;
  pageSize: number;
  stores: StoreOption[];
  categories: CategoryOption[];
  filters: { storeId?: string; categoryId?: string; search?: string; lowStock?: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters
  const [storeId, setStoreId] = useState(filters.storeId ?? "");
  const [categoryId, setCategoryId] = useState(filters.categoryId ?? "");
  const [search, setSearch] = useState(filters.search ?? "");
  const [lowStock, setLowStock] = useState(filters.lowStock === "true");

  // Item form
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null);
  const [itemForm, setItemForm] = useState({
    storeId: "",
    categoryId: "",
    name: "",
    code: "",
    unit: "pcs",
    quantity: 0,
    reorderLevel: 0,
    unitPrice: 0,
    description: "",
  });

  const totalPages = Math.ceil(total / pageSize);

  // ─── Filter ─────────────────────────────────────────────────────

  function applyFilters() {
    const params = new URLSearchParams();
    if (storeId) params.set("storeId", storeId);
    if (categoryId) params.set("categoryId", categoryId);
    if (search) params.set("search", search);
    if (lowStock) params.set("lowStock", "true");
    router.push(`/inventory/items?${params.toString()}`);
  }

  function clearFilters() {
    setStoreId("");
    setCategoryId("");
    setSearch("");
    setLowStock(false);
    router.push("/inventory/items");
  }

  function goToPage(p: number) {
    const params = new URLSearchParams();
    if (storeId) params.set("storeId", storeId);
    if (categoryId) params.set("categoryId", categoryId);
    if (search) params.set("search", search);
    if (lowStock) params.set("lowStock", "true");
    params.set("page", String(p));
    router.push(`/inventory/items?${params.toString()}`);
  }

  // ─── CRUD ───────────────────────────────────────────────────────

  function openItemForm(item?: ItemRow) {
    if (item) {
      setEditingItem(item);
      setItemForm({
        storeId: item.storeId,
        categoryId: item.categoryId ?? "",
        name: item.name,
        code: item.code ?? "",
        unit: item.unit,
        quantity: item.quantity,
        reorderLevel: item.reorderLevel,
        unitPrice: item.unitPrice,
        description: item.description ?? "",
      });
    } else {
      setEditingItem(null);
      setItemForm({
        storeId: stores[0]?.id ?? "",
        categoryId: "",
        name: "",
        code: "",
        unit: "pcs",
        quantity: 0,
        reorderLevel: 0,
        unitPrice: 0,
        description: "",
      });
    }
    setShowItemForm(true);
  }

  function handleSaveItem() {
    if (!itemForm.name.trim()) {
      toast.error("Item name is required.");
      return;
    }
    if (!itemForm.storeId) {
      toast.error("Please select a store.");
      return;
    }

    startTransition(async () => {
      if (editingItem) {
        const result = await updateItemAction(editingItem.id, {
          categoryId: itemForm.categoryId || undefined,
          name: itemForm.name,
          code: itemForm.code || undefined,
          unit: itemForm.unit,
          reorderLevel: itemForm.reorderLevel,
          unitPrice: itemForm.unitPrice,
          description: itemForm.description || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Item updated successfully.");
      } else {
        const result = await createItemAction({
          storeId: itemForm.storeId,
          categoryId: itemForm.categoryId || undefined,
          name: itemForm.name,
          code: itemForm.code || undefined,
          unit: itemForm.unit,
          quantity: itemForm.quantity,
          reorderLevel: itemForm.reorderLevel,
          unitPrice: itemForm.unitPrice,
          description: itemForm.description || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Item created successfully.");
      }
      setShowItemForm(false);
      router.refresh();
    });
  }

  function handleDeleteItem(item: ItemRow) {
    if (!confirm(`Delete item "${item.name}"? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = await deleteItemAction(item.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Item deleted successfully.");
      router.refresh();
    });
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
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
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Name or code..."
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="lowStock"
            checked={lowStock}
            onChange={(e) => setLowStock(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="lowStock" className="text-sm text-muted-foreground">Low Stock Only</label>
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
        <div className="ml-auto">
          <button
            onClick={() => openItemForm()}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Item
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Store</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Qty</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Unit</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Reorder Lvl</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Unit Price</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Value</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-sm font-medium">{item.name}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{item.code ?? "-"}</td>
                <td className="px-4 py-3 text-sm">{item.storeName}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{item.categoryName ?? "-"}</td>
                <td className={`px-4 py-3 text-right text-sm font-medium ${item.isLowStock ? "text-red-600" : ""}`}>
                  {item.quantity}
                </td>
                <td className="px-4 py-3 text-sm">{item.unit}</td>
                <td className="px-4 py-3 text-right text-sm text-muted-foreground">{item.reorderLevel}</td>
                <td className="px-4 py-3 text-right text-sm">{formatCurrency(item.unitPrice)}</td>
                <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(item.value)}</td>
                <td className="px-4 py-3 text-sm">
                  {item.isLowStock ? (
                    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                      Low Stock
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                      In Stock
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openItemForm(item)}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No items found.
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
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} items
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`rounded-md px-3 py-1 text-sm ${
                    p === page
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-accent"
                  }`}
                >
                  {p}
                </button>
              );
            })}
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

      {/* Item Modal */}
      {showItemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              {editingItem ? "Edit Item" : "New Item"}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Item name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Store *</label>
                <select
                  value={itemForm.storeId}
                  onChange={(e) => setItemForm({ ...itemForm, storeId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  disabled={!!editingItem}
                >
                  <option value="">Select store</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Category</label>
                <select
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Code</label>
                <input
                  type="text"
                  value={itemForm.code}
                  onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="SKU / Code"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Unit</label>
                <select
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="liters">Liters</option>
                  <option value="boxes">Boxes</option>
                  <option value="packs">Packs</option>
                  <option value="rolls">Rolls</option>
                  <option value="bags">Bags</option>
                  <option value="sets">Sets</option>
                </select>
              </div>
              {!editingItem && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Initial Quantity</label>
                  <input
                    type="number"
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    min="0"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Reorder Level</label>
                <input
                  type="number"
                  value={itemForm.reorderLevel}
                  onChange={(e) => setItemForm({ ...itemForm, reorderLevel: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  min="0"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Unit Price (GHS)</label>
                <input
                  type="number"
                  value={itemForm.unitPrice}
                  onChange={(e) => setItemForm({ ...itemForm, unitPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowItemForm(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : editingItem ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
