"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createRouteAction,
  updateRouteAction,
  deleteRouteAction,
} from "@/modules/transport/actions/transport.action";

// ─── Types ──────────────────────────────────────────────────────────

interface RouteRow {
  id: string;
  name: string;
  description: string | null;
  vehicleId: string | null;
  vehicleRegistration: string | null;
  startPoint: string | null;
  endPoint: string | null;
  distance: number | null;
  estimatedDuration: number | null;
  fee: number | null;
  status: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    INACTIVE: "bg-gray-100 text-gray-700",
  };
  return map[status] || "bg-gray-100 text-gray-700";
}

function formatCurrency(amount: number | null) {
  if (amount == null) return "-";
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Component ──────────────────────────────────────────────────────

export function RoutesClient({
  routes,
  total,
  page,
  pageSize,
  filters,
}: {
  routes: RouteRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: { search?: string; status?: string; vehicleId?: string };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteRow | null>(null);

  // Filter state
  const [search, setSearch] = useState(filters.search ?? "");
  const [statusFilter, setStatusFilter] = useState(filters.status ?? "");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [startPoint, setStartPoint] = useState("");
  const [endPoint, setEndPoint] = useState("");
  const [distance, setDistance] = useState<number | "">("");
  const [estimatedDuration, setEstimatedDuration] = useState<number | "">("");
  const [fee, setFee] = useState<number | "">("");

  const totalPages = Math.ceil(total / pageSize);

  function applyFilters() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    startTransition(() => {
      router.push(`/transport/routes?${params.toString()}`);
    });
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("");
    startTransition(() => {
      router.push("/transport/routes");
    });
  }

  function openCreate() {
    setEditingRoute(null);
    setName("");
    setDescription("");
    setVehicleId("");
    setStartPoint("");
    setEndPoint("");
    setDistance("");
    setEstimatedDuration("");
    setFee("");
    setShowForm(true);
  }

  function openEdit(route: RouteRow) {
    setEditingRoute(route);
    setName(route.name);
    setDescription(route.description ?? "");
    setVehicleId(route.vehicleId ?? "");
    setStartPoint(route.startPoint ?? "");
    setEndPoint(route.endPoint ?? "");
    setDistance(route.distance ?? "");
    setEstimatedDuration(route.estimatedDuration ?? "");
    setFee(route.fee ?? "");
    setShowForm(true);
  }

  async function handleSubmit() {
    const payload = {
      name,
      description: description || undefined,
      vehicleId: vehicleId || undefined,
      startPoint: startPoint || undefined,
      endPoint: endPoint || undefined,
      distance: distance !== "" ? Number(distance) : undefined,
      estimatedDuration: estimatedDuration !== "" ? Number(estimatedDuration) : undefined,
      fee: fee !== "" ? Number(fee) : undefined,
    };

    if (editingRoute) {
      const res = await updateRouteAction(editingRoute.id, payload);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Route updated successfully");
    } else {
      const res = await createRouteAction(payload);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Route created successfully");
    }
    setShowForm(false);
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this route?")) return;
    const res = await deleteRouteAction(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Route deleted successfully");
    startTransition(() => router.refresh());
  }

  function goToPage(p: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", String(p));
    startTransition(() => {
      router.push(`/transport/routes?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="Route name..."
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
        <button onClick={applyFilters} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Filter
        </button>
        <button onClick={resetFilters} className="h-9 rounded-md border px-4 text-sm font-medium">
          Reset
        </button>
        <div className="ml-auto">
          <button onClick={openCreate} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Add Route
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Start Point</th>
              <th className="px-4 py-3 text-left font-medium">End Point</th>
              <th className="px-4 py-3 text-left font-medium">Distance</th>
              <th className="px-4 py-3 text-left font-medium">Duration</th>
              <th className="px-4 py-3 text-left font-medium">Fee</th>
              <th className="px-4 py-3 text-left font-medium">Vehicle</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {routes.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No routes found.
                </td>
              </tr>
            ) : (
              routes.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">{r.startPoint ?? "-"}</td>
                  <td className="px-4 py-3">{r.endPoint ?? "-"}</td>
                  <td className="px-4 py-3">{r.distance != null ? `${r.distance} km` : "-"}</td>
                  <td className="px-4 py-3">{r.estimatedDuration != null ? `${r.estimatedDuration} min` : "-"}</td>
                  <td className="px-4 py-3">{formatCurrency(r.fee)}</td>
                  <td className="px-4 py-3">{r.vehicleRegistration ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadge(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(r)} className="text-sm text-blue-600 hover:underline">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="text-sm text-red-600 hover:underline">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
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
              className="h-8 rounded-md border px-3 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="h-8 rounded-md border px-3 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              {editingRoute ? "Edit Route" : "Add Route"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Start Point</label>
                  <input
                    type="text"
                    value={startPoint}
                    onChange={(e) => setStartPoint(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">End Point</label>
                  <input
                    type="text"
                    value={endPoint}
                    onChange={(e) => setEndPoint(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Distance (km)</label>
                  <input
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Duration (min)</label>
                  <input
                    type="number"
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Fee (GHS)</label>
                  <input
                    type="number"
                    value={fee}
                    onChange={(e) => setFee(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Vehicle ID</label>
                <input
                  type="text"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  placeholder="Enter vehicle ID"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="h-9 rounded-md border px-4 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!name}
                className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {editingRoute ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
