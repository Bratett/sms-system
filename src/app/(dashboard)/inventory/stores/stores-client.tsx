"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createStoreAction,
  updateStoreAction,
  deleteStoreAction,
  createCategoryAction,
  deleteCategoryAction,
} from "@/modules/inventory/actions/store.action";

// ─── Types ──────────────────────────────────────────────────────────

interface StoreRow {
  id: string;
  name: string;
  description: string | null;
  managerId: string | null;
  managerName: string | null;
  status: string;
  itemCount: number;
  totalValue: number;
  lowStockCount: number;
  createdAt: Date;
}

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: Date;
}

function formatCurrency(amount: number): string {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Component ──────────────────────────────────────────────────────

export function StoresClient({
  stores: initialStores,
  categories: initialCategories,
}: {
  stores: StoreRow[];
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [stores] = useState<StoreRow[]>(initialStores);
  const [categories] = useState<CategoryRow[]>(initialCategories);

  // Store form
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreRow | null>(null);
  const [storeForm, setStoreForm] = useState({
    name: "",
    description: "",
    managerId: "",
  });

  // Category form
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
  });

  // Active tab
  const [activeTab, setActiveTab] = useState<"stores" | "categories">("stores");

  // ─── Store Handlers ─────────────────────────────────────────────

  function openStoreForm(store?: StoreRow) {
    if (store) {
      setEditingStore(store);
      setStoreForm({
        name: store.name,
        description: store.description ?? "",
        managerId: store.managerId ?? "",
      });
    } else {
      setEditingStore(null);
      setStoreForm({ name: "", description: "", managerId: "" });
    }
    setShowStoreForm(true);
  }

  function handleSaveStore() {
    if (!storeForm.name.trim()) {
      toast.error("Store name is required.");
      return;
    }

    startTransition(async () => {
      if (editingStore) {
        const result = await updateStoreAction(editingStore.id, {
          name: storeForm.name,
          description: storeForm.description || undefined,
          managerId: storeForm.managerId || undefined,
        });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Store updated successfully.");
      } else {
        const result = await createStoreAction({
          name: storeForm.name,
          description: storeForm.description || undefined,
          managerId: storeForm.managerId || undefined,
        });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Store created successfully.");
      }
      setShowStoreForm(false);
      router.refresh();
    });
  }

  function handleDeleteStore(store: StoreRow) {
    if (!confirm(`Delete store "${store.name}"? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = await deleteStoreAction(store.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Store deleted successfully.");
      router.refresh();
    });
  }

  // ─── Category Handlers ──────────────────────────────────────────

  function openCategoryForm() {
    setCategoryForm({ name: "", description: "" });
    setShowCategoryForm(true);
  }

  function handleSaveCategory() {
    if (!categoryForm.name.trim()) {
      toast.error("Category name is required.");
      return;
    }

    startTransition(async () => {
      const result = await createCategoryAction({
        name: categoryForm.name,
        description: categoryForm.description || undefined,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Category created successfully.");
      setShowCategoryForm(false);
      router.refresh();
    });
  }

  function handleDeleteCategory(cat: CategoryRow) {
    if (!confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = await deleteCategoryAction(cat.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Category deleted successfully.");
      router.refresh();
    });
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        <button
          onClick={() => setActiveTab("stores")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "stores"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Stores ({stores.length})
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "categories"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Categories ({categories.length})
        </button>
      </div>

      {/* Stores Tab */}
      {activeTab === "stores" && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => openStoreForm()}
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add Store
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <div key={store.id} className="rounded-lg border bg-card p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{store.name}</h3>
                    {store.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{store.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openStoreForm(store)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteStore(store)}
                      className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {store.managerName && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Manager: {store.managerName}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">{store.itemCount} items</span>
                  <span className="font-medium">{formatCurrency(store.totalValue)}</span>
                </div>

                {store.lowStockCount > 0 && (
                  <span className="mt-2 inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                    {store.lowStockCount} low stock
                  </span>
                )}
              </div>
            ))}

            {stores.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">
                No stores found. Create one to get started.
              </p>
            )}
          </div>
        </>
      )}

      {/* Categories Tab */}
      {activeTab === "categories" && (
        <>
          <div className="flex justify-end">
            <button
              onClick={openCategoryForm}
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add Category
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="min-w-full divide-y">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-card">
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td className="px-4 py-3 text-sm font-medium">{cat.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{cat.description ?? "-"}</td>
                    <td className="px-4 py-3 text-sm">{cat.itemCount}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        disabled={isPending}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No categories found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Store Modal */}
      {showStoreForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              {editingStore ? "Edit Store" : "New Store"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <input
                  type="text"
                  value={storeForm.name}
                  onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Main Store"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                  value={storeForm.description}
                  onChange={(e) => setStoreForm({ ...storeForm, description: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowStoreForm(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStore}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : editingStore ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">New Category</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Cleaning Supplies"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowCategoryForm(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
