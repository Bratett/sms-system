"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createVehicleAction,
  updateVehicleAction,
  deleteVehicleAction,
} from "@/modules/transport/actions/transport.action";

// ─── Types ──────────────────────────────────────────────────────────

interface VehicleRow {
  id: string;
  registrationNumber: string;
  type: string;
  capacity: number;
  driverName: string | null;
  driverPhone: string | null;
  status: string;
  insuranceExpiry: Date | string | null;
  lastServiceDate: Date | string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────

const VEHICLE_TYPES = ["BUS", "MINIBUS", "VAN", "CAR"] as const;
const VEHICLE_STATUSES = ["ACTIVE", "MAINTENANCE", "RETIRED"] as const;

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    MAINTENANCE: "bg-yellow-100 text-yellow-700",
    RETIRED: "bg-gray-100 text-gray-700",
  };
  return map[status] || "bg-gray-100 text-gray-700";
}

// ─── Component ──────────────────────────────────────────────────────

export function VehiclesClient({
  vehicles,
  total,
  page,
  pageSize,
  filters,
}: {
  vehicles: VehicleRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: { search?: string; status?: string; type?: string };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleRow | null>(null);

  // Filter state
  const [search, setSearch] = useState(filters.search ?? "");
  const [statusFilter, setStatusFilter] = useState(filters.status ?? "");
  const [typeFilter, setTypeFilter] = useState(filters.type ?? "");

  // Form state
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [type, setType] = useState<string>("BUS");
  const [capacity, setCapacity] = useState<number>(0);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [lastServiceDate, setLastServiceDate] = useState("");

  const totalPages = Math.ceil(total / pageSize);

  function applyFilters() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    startTransition(() => {
      router.push(`/transport/vehicles?${params.toString()}`);
    });
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    startTransition(() => {
      router.push("/transport/vehicles");
    });
  }

  function openCreate() {
    setEditingVehicle(null);
    setRegistrationNumber("");
    setType("BUS");
    setCapacity(0);
    setDriverName("");
    setDriverPhone("");
    setInsuranceExpiry("");
    setLastServiceDate("");
    setShowForm(true);
  }

  function openEdit(vehicle: VehicleRow) {
    setEditingVehicle(vehicle);
    setRegistrationNumber(vehicle.registrationNumber);
    setType(vehicle.type);
    setCapacity(vehicle.capacity);
    setDriverName(vehicle.driverName ?? "");
    setDriverPhone(vehicle.driverPhone ?? "");
    setInsuranceExpiry(vehicle.insuranceExpiry ? new Date(vehicle.insuranceExpiry).toISOString().split("T")[0] : "");
    setLastServiceDate(vehicle.lastServiceDate ? new Date(vehicle.lastServiceDate).toISOString().split("T")[0] : "");
    setShowForm(true);
  }

  async function handleSubmit() {
    const payload = {
      registrationNumber,
      type: type as "BUS" | "MINIBUS" | "VAN" | "CAR",
      capacity,
      driverName: driverName || undefined,
      driverPhone: driverPhone || undefined,
      insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : undefined,
      lastServiceDate: lastServiceDate ? new Date(lastServiceDate) : undefined,
    };

    if (editingVehicle) {
      const res = await updateVehicleAction(editingVehicle.id, payload);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Vehicle updated successfully");
    } else {
      const res = await createVehicleAction(payload);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Vehicle created successfully");
    }
    setShowForm(false);
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this vehicle?")) return;
    const res = await deleteVehicleAction(id);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success("Vehicle deleted successfully");
    startTransition(() => router.refresh());
  }

  function goToPage(p: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    params.set("page", String(p));
    startTransition(() => {
      router.push(`/transport/vehicles?${params.toString()}`);
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
            placeholder="Registration, driver..."
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
            {VEHICLE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All Types</option>
            {VEHICLE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
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
            Add Vehicle
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Registration</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Capacity</th>
              <th className="px-4 py-3 text-left font-medium">Driver</th>
              <th className="px-4 py-3 text-left font-medium">Driver Phone</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No vehicles found.
                </td>
              </tr>
            ) : (
              vehicles.map((v) => (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{v.registrationNumber}</td>
                  <td className="px-4 py-3">{v.type}</td>
                  <td className="px-4 py-3">{v.capacity}</td>
                  <td className="px-4 py-3">{v.driverName ?? "-"}</td>
                  <td className="px-4 py-3">{v.driverPhone ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadge(v.status)}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(v)} className="text-sm text-blue-600 hover:underline">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(v.id)} className="text-sm text-red-600 hover:underline">
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
              {editingVehicle ? "Edit Vehicle" : "Add Vehicle"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Registration Number *</label>
                <input
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Type *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Capacity *</label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Driver Name</label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Driver Phone</label>
                  <input
                    type="text"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Insurance Expiry</label>
                  <input
                    type="date"
                    value={insuranceExpiry}
                    onChange={(e) => setInsuranceExpiry(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Last Service Date</label>
                  <input
                    type="date"
                    value={lastServiceDate}
                    onChange={(e) => setLastServiceDate(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
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
                disabled={!registrationNumber || !capacity}
                className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {editingVehicle ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
