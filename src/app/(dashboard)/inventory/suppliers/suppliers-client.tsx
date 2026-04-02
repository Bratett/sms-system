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
import {
  getSupplierContractsAction,
  createSupplierContractAction,
  getExpiringContractsAction,
} from "@/modules/inventory/actions/supplier-contract.action";
import {
  rateSupplierAction,
  getSupplierRatingsAction,
  getSupplierScorecardsAction,
} from "@/modules/inventory/actions/supplier-rating.action";

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

interface ContractRow {
  id: string;
  supplierId: string;
  supplierName: string;
  contractNumber: string | null;
  startDate?: string | Date;
  endDate: string | Date;
  terms?: string | null;
  value?: number | null;
  documentUrl?: string | null;
  status?: string;
  daysUntilExpiry?: number;
  isExpired?: boolean;
  urgency?: string;
}

interface ScorecardRow {
  id: string;
  name: string;
  contactPerson: string | null;
  totalOrders: number;
  totalSpend: number;
  ratingCount: number;
  avgDelivery: number | null;
  avgQuality: number | null;
  avgPricing: number | null;
  avgOverall: number | null;
}

// ─── Component ──────────────────────────────────────────────────────

export function SuppliersClient({
  suppliers: initialSuppliers,
  contracts: initialContracts = [],
  expiringContracts: initialExpiringContracts = [],
  scorecards: initialScorecards = [],
}: {
  suppliers: SupplierRow[];
  contracts?: ContractRow[];
  expiringContracts?: ContractRow[];
  scorecards?: ScorecardRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"suppliers" | "contracts" | "ratings">("suppliers");

  const [suppliers, setSuppliers] = useState<SupplierRow[]>(initialSuppliers);
  const [contracts, setContracts] = useState<ContractRow[]>(initialContracts);
  const [expiringContracts, setExpiringContracts] = useState<ContractRow[]>(initialExpiringContracts);
  const [scorecards, setScorecards] = useState<ScorecardRow[]>(initialScorecards);
  const [search, setSearch] = useState("");

  // Supplier Form
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
  });

  // Contract Form
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractForm, setContractForm] = useState({
    supplierId: "",
    contractNumber: "",
    startDate: "",
    endDate: "",
    terms: "",
    value: "",
    documentUrl: "",
  });

  // Rating Form
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingForm, setRatingForm] = useState({
    supplierId: "",
    deliveryScore: 5,
    qualityScore: 5,
    pricingScore: 5,
    comments: "",
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

  // ─── Contract CRUD ─────────────────────────────────────────────

  function handleCreateContract() {
    if (!contractForm.supplierId || !contractForm.contractNumber || !contractForm.startDate || !contractForm.endDate) {
      toast.error("Supplier, contract number, start date, and end date are required.");
      return;
    }

    startTransition(async () => {
      const result = await createSupplierContractAction({
        supplierId: contractForm.supplierId,
        contractNumber: contractForm.contractNumber,
        startDate: contractForm.startDate,
        endDate: contractForm.endDate,
        terms: contractForm.terms || undefined,
        value: contractForm.value ? parseFloat(contractForm.value) : undefined,
        documentUrl: contractForm.documentUrl || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Contract created successfully.");
      setShowContractModal(false);
      setContractForm({ supplierId: "", contractNumber: "", startDate: "", endDate: "", terms: "", value: "", documentUrl: "" });
      router.refresh();
    });
  }

  // ─── Rating CRUD ───────────────────────────────────────────────

  function handleRateSupplier() {
    if (!ratingForm.supplierId) {
      toast.error("Please select a supplier.");
      return;
    }

    startTransition(async () => {
      const result = await rateSupplierAction({
        supplierId: ratingForm.supplierId,
        deliveryScore: ratingForm.deliveryScore,
        qualityScore: ratingForm.qualityScore,
        pricingScore: ratingForm.pricingScore,
        comments: ratingForm.comments || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Supplier rated successfully.");
      setShowRatingModal(false);
      setRatingForm({ supplierId: "", deliveryScore: 5, qualityScore: 5, pricingScore: 5, comments: "" });
      router.refresh();
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────

  function renderStars(score: number) {
    const rounded = Math.round(score * 10) / 10;
    const full = Math.floor(rounded);
    const stars = [];
    for (let i = 0; i < 5; i++) {
      if (i < full) {
        stars.push(<span key={i} className="text-yellow-500">&#9733;</span>);
      } else {
        stars.push(<span key={i} className="text-gray-300">&#9733;</span>);
      }
    }
    return <span className="inline-flex items-center gap-0.5">{stars} <span className="ml-1 text-xs text-muted-foreground">{rounded.toFixed(1)}</span></span>;
  }

  function formatDate(d: string | Date) {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        <button
          onClick={() => setActiveTab("suppliers")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "suppliers"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Suppliers ({suppliers.length})
        </button>
        <button
          onClick={() => setActiveTab("contracts")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "contracts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Contracts ({contracts.length})
        </button>
        <button
          onClick={() => setActiveTab("ratings")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "ratings"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Scorecards ({scorecards.length})
        </button>
      </div>

      {/* ─── Suppliers Tab ─────────────────────────────────────────── */}
      {activeTab === "suppliers" && (
        <>
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
        </>
      )}

      {/* ─── Contracts Tab ─────────────────────────────────────────── */}
      {activeTab === "contracts" && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Manage supplier contracts and agreements</h3>
            <button
              onClick={() => {
                setContractForm({ supplierId: "", contractNumber: "", startDate: "", endDate: "", terms: "", value: "", documentUrl: "" });
                setShowContractModal(true);
              }}
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add Contract
            </button>
          </div>

          {/* Expiring Contracts Warning */}
          {expiringContracts.length > 0 && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
              <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">
                Expiring Soon ({expiringContracts.length})
              </h4>
              <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-500">
                The following contracts are expiring within the next 30 days:
              </p>
              <ul className="mt-2 space-y-1">
                {expiringContracts.map((c) => (
                  <li key={c.id} className="text-xs text-yellow-700 dark:text-yellow-500">
                    {c.supplierName} &mdash; {c.contractNumber} (expires {formatDate(c.endDate)})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Contracts Table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Contract #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Start Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">End Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-card">
                {contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td className="px-4 py-3 text-sm font-medium">{contract.supplierName}</td>
                    <td className="px-4 py-3 text-sm font-mono">{contract.contractNumber}</td>
                    <td className="px-4 py-3 text-sm">{contract.startDate ? formatDate(contract.startDate) : "-"}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(contract.endDate)}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      {contract.value != null ? `GHS ${Number(contract.value).toLocaleString("en-GH", { minimumFractionDigits: 2 })}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        contract.status === "ACTIVE"
                          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                          : contract.status === "EXPIRED"
                          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {contract.documentUrl && (
                        <a href={contract.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          View Doc
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
                {contracts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No contracts found. Add a contract to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── Scorecards Tab ────────────────────────────────────────── */}
      {activeTab === "ratings" && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Supplier performance scorecards and ratings</h3>
            <button
              onClick={() => {
                setRatingForm({ supplierId: "", deliveryScore: 5, qualityScore: 5, pricingScore: 5, comments: "" });
                setShowRatingModal(true);
              }}
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Rate Supplier
            </button>
          </div>

          {/* Scorecards Table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Supplier Name</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Orders</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Total Spend</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Avg Delivery</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Avg Quality</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Avg Pricing</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Overall Rating</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Rating Count</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-card">
                {scorecards.map((sc) => (
                  <tr key={sc.id}>
                    <td className="px-4 py-3 text-sm font-medium">{sc.name}</td>
                    <td className="px-4 py-3 text-right text-sm">{sc.totalOrders}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      GHS {Number(sc.totalSpend).toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">{renderStars(sc.avgDelivery ?? 0)}</td>
                    <td className="px-4 py-3 text-center text-sm">{renderStars(sc.avgQuality ?? 0)}</td>
                    <td className="px-4 py-3 text-center text-sm">{renderStars(sc.avgPricing ?? 0)}</td>
                    <td className="px-4 py-3 text-center text-sm">{renderStars(sc.avgOverall ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-sm">{sc.ratingCount}</td>
                  </tr>
                ))}
                {scorecards.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No supplier scorecards yet. Rate a supplier to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── Supplier Modal ────────────────────────────────────────── */}
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

      {/* ─── Contract Modal ────────────────────────────────────────── */}
      {showContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Contract</h2>
              <button onClick={() => setShowContractModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Supplier *</label>
                <select
                  value={contractForm.supplierId}
                  onChange={(e) => setContractForm({ ...contractForm, supplierId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Contract Number *</label>
                <input
                  type="text"
                  value={contractForm.contractNumber}
                  onChange={(e) => setContractForm({ ...contractForm, contractNumber: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. CNT-2026-001"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Start Date *</label>
                  <input
                    type="date"
                    value={contractForm.startDate}
                    onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">End Date *</label>
                  <input
                    type="date"
                    value={contractForm.endDate}
                    onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Terms</label>
                <textarea
                  value={contractForm.terms}
                  onChange={(e) => setContractForm({ ...contractForm, terms: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Contract terms and conditions"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Value (GHS)</label>
                <input
                  type="number"
                  value={contractForm.value}
                  onChange={(e) => setContractForm({ ...contractForm, value: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Document URL</label>
                <input
                  type="url"
                  value={contractForm.documentUrl}
                  onChange={(e) => setContractForm({ ...contractForm, documentUrl: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowContractModal(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateContract}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create Contract"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Rating Modal ──────────────────────────────────────────── */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Rate Supplier</h2>
              <button onClick={() => setShowRatingModal(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Supplier *</label>
                <select
                  value={ratingForm.supplierId}
                  onChange={(e) => setRatingForm({ ...ratingForm, supplierId: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Delivery Score (1-5) *</label>
                <select
                  value={ratingForm.deliveryScore}
                  onChange={(e) => setRatingForm({ ...ratingForm, deliveryScore: parseInt(e.target.value) })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>{v} - {["Poor", "Below Avg", "Average", "Good", "Excellent"][v - 1]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Quality Score (1-5) *</label>
                <select
                  value={ratingForm.qualityScore}
                  onChange={(e) => setRatingForm({ ...ratingForm, qualityScore: parseInt(e.target.value) })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>{v} - {["Poor", "Below Avg", "Average", "Good", "Excellent"][v - 1]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Pricing Score (1-5) *</label>
                <select
                  value={ratingForm.pricingScore}
                  onChange={(e) => setRatingForm({ ...ratingForm, pricingScore: parseInt(e.target.value) })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>{v} - {["Poor", "Below Avg", "Average", "Good", "Excellent"][v - 1]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Comments</label>
                <textarea
                  value={ratingForm.comments}
                  onChange={(e) => setRatingForm({ ...ratingForm, comments: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Additional feedback..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowRatingModal(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleRateSupplier}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Submitting..." : "Submit Rating"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
