"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getSuppliersAction,
  createSupplierAction,
  updateSupplierAction,
  deleteSupplierAction,
} from "@/modules/inventory/actions/supplier.action";

// ─── Types ──────────────────────────────────────────────────────────

interface SupplierRow {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
  purchaseOrderCount: number;
  createdAt: Date;
}

// ─── Component ──────────────────────────────────────────────────────

export function SuppliersClient({
  suppliers: initialSuppliers,
}: {
  suppliers: SupplierRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [suppliers, setSuppliers] = useState<SupplierRow[]>(initialSuppliers);
  const [search, setSearch] = useState("");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
  });

  // ─── Search ─────────────────────────────────────────────────────

  function handleSearch() {
    startTransition(async () => {
      const result = await getSuppliersAction(search || undefined);
      if (result.data) {
        setSuppliers(result.data);
      }
    });
  }

  // ─── CRUD ───────────────────────────────────────────────────────

  function openForm(supplier?: SupplierRow) {
    if (supplier) {
      setEditingSupplier(supplier);
      setForm({
        name: supplier.name,
        contactPerson: supplier.contactPerson ?? "",
        phone: supplier.phone ?? "",
        email: supplier.email ?? "",
        address: supplier.address ?? "",
      });
    } else {
      setEditingSupplier(null);
      setForm({ name: "", contactPerson: "", phone: "", email: "", address: "" });
    }
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Supplier name is required.");
      return;
    }

    startTransition(async () => {
      if (editingSupplier) {
        const result = await updateSupplierAction(editingSupplier.id, {
          name: form.name,
          contactPerson: form.contactPerson || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Supplier updated successfully.");
      } else {
        const result = await createSupplierAction({
          name: form.name,
          contactPerson: form.contactPerson || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Supplier created successfully.");
      }
      setShowForm(false);
      router.refresh();
    });
  }

  function handleDelete(supplier: SupplierRow) {
    if (!confirm(`Delete supplier "${supplier.name}"? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = await deleteSupplierAction(supplier.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Supplier deleted successfully.");
      router.refresh();
    });
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Search + Add */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full max-w-sm rounded-md border px-3 py-2 text-sm"
            placeholder="Search suppliers..."
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          Search
        </button>
        <button
          onClick={() => openForm()}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Supplier
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Contact Person</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">PO Count</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td className="px-4 py-3 text-sm font-medium">{supplier.name}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{supplier.contactPerson ?? "-"}</td>
                <td className="px-4 py-3 text-sm">{supplier.phone ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{supplier.email ?? "-"}</td>
                <td className="px-4 py-3 text-right text-sm">{supplier.purchaseOrderCount}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                    {supplier.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openForm(supplier)}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(supplier)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No suppliers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              {editingSupplier ? "Edit Supplier" : "New Supplier"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Supplier name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Contact Person</label>
                <input
                  type="text"
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Contact person name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. 0244000000"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="supplier@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Physical address"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : editingSupplier ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
