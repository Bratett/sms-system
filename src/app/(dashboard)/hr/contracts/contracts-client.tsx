"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  getAllContractsAction,
  createContractAction,
  renewContractAction,
} from "@/modules/hr/actions/contract.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ContractRow {
  id: string;
  contractNumber: string | null;
  type: string;
  startDate: Date | string;
  endDate: Date | string | null;
  renewalDate: Date | string | null;
  terms: string | null;
  status: string;
  staff: {
    firstName: string;
    lastName: string;
    staffId: string;
  };
}

interface StaffOption {
  id: string;
  staffId: string;
  name: string;
}

const CONTRACT_TYPES = ["PERMANENT", "FIXED_TERM", "PROBATION", "NATIONAL_SERVICE"] as const;
const CONTRACT_STATUSES = ["ACTIVE", "EXPIRED", "RENEWED", "TERMINATED"] as const;

// ─── Component ──────────────────────────────────────────────────────

export function ContractsClient({
  initialContracts,
  initialTotal,
  initialPage,
  initialPageSize,
  expiringContracts,
  staffOptions,
}: {
  initialContracts: ContractRow[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  expiringContracts: ContractRow[];
  staffOptions: StaffOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [contracts, setContracts] = useState<ContractRow[]>(initialContracts);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  // Add contract form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    staffId: "",
    type: "" as string,
    startDate: "",
    endDate: "",
    terms: "",
  });

  // Renew modal
  const [renewingContract, setRenewingContract] = useState<ContractRow | null>(null);
  const [renewForm, setRenewForm] = useState({ newEndDate: "", newTerms: "" });

  const totalPages = Math.ceil(total / pageSize);

  function fetchContracts(newPage: number) {
    startTransition(async () => {
      const result = await getAllContractsAction({
        status: filterStatus || undefined,
        type: filterType || undefined,
        page: newPage,
        pageSize,
      });
      if ("data" in result && result.data) {
        setContracts(result.data as ContractRow[]);
        setTotal("total" in result ? result.total ?? 0 : 0);
        setPage("page" in result ? result.page ?? 1 : 1);
      }
    });
  }

  function handleCreate() {
    if (!form.staffId || !form.type || !form.startDate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    startTransition(async () => {
      const result = await createContractAction({
        staffId: form.staffId,
        type: form.type as (typeof CONTRACT_TYPES)[number],
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        terms: form.terms || undefined,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Contract created successfully.");
        setShowForm(false);
        setForm({ staffId: "", type: "", startDate: "", endDate: "", terms: "" });
        router.refresh();
      }
    });
  }

  function handleRenew() {
    if (!renewingContract || !renewForm.newEndDate) {
      toast.error("New end date is required.");
      return;
    }

    startTransition(async () => {
      const result = await renewContractAction(renewingContract.id, {
        newEndDate: renewForm.newEndDate,
        newTerms: renewForm.newTerms || undefined,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Contract renewed successfully.");
        setRenewingContract(null);
        setRenewForm({ newEndDate: "", newTerms: "" });
        router.refresh();
      }
    });
  }

  function formatDate(date: Date | string | null) {
    if (!date) return "---";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function daysUntil(date: Date | string | null): number {
    if (!date) return Infinity;
    const diff = new Date(date).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="space-y-8">
      {/* ─── Expiring Soon Alert ──────────────────────────────── */}
      {expiringContracts.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3">
            Contracts Expiring Within 30 Days ({expiringContracts.length})
          </h3>
          <div className="space-y-2">
            {expiringContracts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between text-sm bg-white dark:bg-amber-950/50 rounded-md px-3 py-2"
              >
                <span className="font-medium">
                  {c.staff.firstName} {c.staff.lastName}{" "}
                  <span className="text-muted-foreground">({c.staff.staffId})</span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    Expires {formatDate(c.endDate)} ({daysUntil(c.endDate)} days)
                  </span>
                  <button
                    onClick={() => {
                      setRenewingContract(c);
                      setRenewForm({ newEndDate: "", newTerms: "" });
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Renew
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Filters & Actions ────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          >
            <option value="">All Statuses</option>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          >
            <option value="">All Types</option>
            {CONTRACT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button
            onClick={() => fetchContracts(1)}
            disabled={isPending}
            className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            Apply
          </button>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Contract
        </button>
      </div>

      {/* ─── Contracts Table ──────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Staff Name</th>
                <th className="px-4 py-3 text-left font-medium">Contract #</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Start Date</th>
                <th className="px-4 py-3 text-left font-medium">End Date</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No contracts found.
                  </td>
                </tr>
              ) : (
                contracts.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {c.staff.firstName} {c.staff.lastName}
                      <span className="text-xs text-muted-foreground ml-1">({c.staff.staffId})</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.contractNumber || "---"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(c.startDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(c.endDate)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.status === "ACTIVE" && (
                        <button
                          onClick={() => {
                            setRenewingContract(c);
                            setRenewForm({ newEndDate: "", newTerms: "" });
                          }}
                          disabled={isPending}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Renew
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Pagination ───────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchContracts(page - 1)}
              disabled={page <= 1 || isPending}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
            >
              Previous
            </button>
            <button
              onClick={() => fetchContracts(page + 1)}
              disabled={page >= totalPages || isPending}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ─── Add Contract Modal ───────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Add Contract</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Staff Member</label>
                <select
                  value={form.staffId}
                  onChange={(e) => setForm((p) => ({ ...p, staffId: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select staff</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.staffId})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contract Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select type</option>
                  {CONTRACT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Terms (optional)</label>
                <textarea
                  value={form.terms}
                  onChange={(e) => setForm((p) => ({ ...p, terms: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Contract terms and conditions..."
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create Contract"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Renew Contract Modal ─────────────────────────────── */}
      {renewingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Renew Contract</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {renewingContract.staff.firstName} {renewingContract.staff.lastName} &mdash;{" "}
              {renewingContract.type.replace(/_/g, " ")}
              {renewingContract.endDate && (
                <> (current end: {formatDate(renewingContract.endDate)})</>
              )}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">New End Date</label>
                <input
                  type="date"
                  value={renewForm.newEndDate}
                  onChange={(e) => setRenewForm((p) => ({ ...p, newEndDate: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">New Terms (optional)</label>
                <textarea
                  value={renewForm.newTerms}
                  onChange={(e) => setRenewForm((p) => ({ ...p, newTerms: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Updated contract terms..."
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setRenewingContract(null)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleRenew}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Renewing..." : "Renew Contract"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
