"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createHostelAction,
  updateHostelAction,
  deleteHostelAction,
  getHostelAction,
  createDormitoryAction,
  updateDormitoryAction,
  deleteDormitoryAction,
  createBedsAction,
  deleteBedAction,
} from "@/modules/boarding/actions/hostel.action";

// ─── Types ──────────────────────────────────────────────────────────

interface HostelRow {
  id: string;
  name: string;
  gender: string;
  capacity: number;
  wardenId: string | null;
  wardenName: string | null;
  description: string | null;
  status: string;
  dormitoryCount: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  createdAt: Date;
}

interface DormitoryDetail {
  id: string;
  name: string;
  floor: string | null;
  capacity: number;
  beds: BedDetail[];
}

interface BedDetail {
  id: string;
  bedNumber: string;
  status: string;
  studentName: string | null;
  allocationId: string | null;
}

// ─── Component ──────────────────────────────────────────────────────

export function HostelsClient({ hostels: initialHostels }: { hostels: HostelRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [hostels] = useState<HostelRow[]>(initialHostels);
  const [expandedHostelId, setExpandedHostelId] = useState<string | null>(null);
  const [expandedDormId, setExpandedDormId] = useState<string | null>(null);
  const [hostelDetail, setHostelDetail] = useState<{
    id: string;
    dormitories: DormitoryDetail[];
  } | null>(null);

  // Hostel form
  const [showHostelForm, setShowHostelForm] = useState(false);
  const [editingHostel, setEditingHostel] = useState<HostelRow | null>(null);
  const [hostelForm, setHostelForm] = useState({
    name: "",
    gender: "MALE" as "MALE" | "FEMALE",
    capacity: 0,
    wardenId: "",
    description: "",
  });

  // Dormitory form
  const [showDormForm, setShowDormForm] = useState(false);
  const [dormParentHostelId, setDormParentHostelId] = useState("");
  const [dormForm, setDormForm] = useState({
    name: "",
    floor: "",
    capacity: 0,
  });

  // Bed form
  const [showBedForm, setShowBedForm] = useState(false);
  const [bedParentDormId, setBedParentDormId] = useState("");
  const [bedForm, setBedForm] = useState({
    count: 10,
    prefix: "Bed",
  });

  // ─── Load Hostel Detail ─────────────────────────────────────────

  function handleExpandHostel(hostelId: string) {
    if (expandedHostelId === hostelId) {
      setExpandedHostelId(null);
      setExpandedDormId(null);
      setHostelDetail(null);
      return;
    }

    setExpandedHostelId(hostelId);
    setExpandedDormId(null);

    startTransition(async () => {
      const result = await getHostelAction(hostelId);
      if (result.data) {
        setHostelDetail({
          id: result.data.id,
          dormitories: result.data.dormitories,
        });
      }
    });
  }

  // ─── Hostel CRUD ────────────────────────────────────────────────

  function openHostelForm(hostel?: HostelRow) {
    if (hostel) {
      setEditingHostel(hostel);
      setHostelForm({
        name: hostel.name,
        gender: hostel.gender as "MALE" | "FEMALE",
        capacity: hostel.capacity,
        wardenId: hostel.wardenId || "",
        description: hostel.description || "",
      });
    } else {
      setEditingHostel(null);
      setHostelForm({ name: "", gender: "MALE", capacity: 0, wardenId: "", description: "" });
    }
    setShowHostelForm(true);
  }

  function handleSaveHostel() {
    if (!hostelForm.name.trim()) {
      toast.error("Hostel name is required.");
      return;
    }

    startTransition(async () => {
      if (editingHostel) {
        const result = await updateHostelAction(editingHostel.id, {
          name: hostelForm.name,
          gender: hostelForm.gender,
          capacity: hostelForm.capacity,
          wardenId: hostelForm.wardenId || undefined,
          description: hostelForm.description || undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Hostel updated successfully.");
          setShowHostelForm(false);
          router.refresh();
        }
      } else {
        const result = await createHostelAction({
          name: hostelForm.name,
          gender: hostelForm.gender,
          capacity: hostelForm.capacity,
          wardenId: hostelForm.wardenId || undefined,
          description: hostelForm.description || undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Hostel created successfully.");
          setShowHostelForm(false);
          router.refresh();
        }
      }
    });
  }

  function handleDeleteHostel(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete the hostel "${name}"?`)) return;

    startTransition(async () => {
      const result = await deleteHostelAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Hostel deleted successfully.");
        router.refresh();
      }
    });
  }

  // ─── Dormitory CRUD ─────────────────────────────────────────────

  function openDormForm(hostelId: string) {
    setDormParentHostelId(hostelId);
    setDormForm({ name: "", floor: "", capacity: 0 });
    setShowDormForm(true);
  }

  function handleSaveDormitory() {
    if (!dormForm.name.trim()) {
      toast.error("Dormitory name is required.");
      return;
    }

    startTransition(async () => {
      const result = await createDormitoryAction({
        hostelId: dormParentHostelId,
        name: dormForm.name,
        floor: dormForm.floor || undefined,
        capacity: dormForm.capacity,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Dormitory created successfully.");
        setShowDormForm(false);
        // Reload hostel detail
        const hostelResult = await getHostelAction(dormParentHostelId);
        if (hostelResult.data) {
          setHostelDetail({
            id: hostelResult.data.id,
            dormitories: hostelResult.data.dormitories,
          });
        }
        router.refresh();
      }
    });
  }

  function handleDeleteDormitory(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete dormitory "${name}"?`)) return;

    startTransition(async () => {
      const result = await deleteDormitoryAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Dormitory deleted.");
        if (expandedHostelId) {
          const hostelResult = await getHostelAction(expandedHostelId);
          if (hostelResult.data) {
            setHostelDetail({
              id: hostelResult.data.id,
              dormitories: hostelResult.data.dormitories,
            });
          }
        }
        router.refresh();
      }
    });
  }

  // ─── Bed CRUD ───────────────────────────────────────────────────

  function openBedForm(dormitoryId: string) {
    setBedParentDormId(dormitoryId);
    setBedForm({ count: 10, prefix: "Bed" });
    setShowBedForm(true);
  }

  function handleAddBeds() {
    if (bedForm.count < 1) {
      toast.error("Enter at least 1 bed.");
      return;
    }

    startTransition(async () => {
      const result = await createBedsAction(bedParentDormId, bedForm.count, bedForm.prefix);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${bedForm.count} beds created successfully.`);
        setShowBedForm(false);
        if (expandedHostelId) {
          const hostelResult = await getHostelAction(expandedHostelId);
          if (hostelResult.data) {
            setHostelDetail({
              id: hostelResult.data.id,
              dormitories: hostelResult.data.dormitories,
            });
          }
        }
        router.refresh();
      }
    });
  }

  function handleDeleteBed(id: string, bedNumber: string) {
    if (!confirm(`Delete bed "${bedNumber}"?`)) return;

    startTransition(async () => {
      const result = await deleteBedAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Bed deleted.");
        if (expandedHostelId) {
          const hostelResult = await getHostelAction(expandedHostelId);
          if (hostelResult.data) {
            setHostelDetail({
              id: hostelResult.data.id,
              dormitories: hostelResult.data.dormitories,
            });
          }
        }
        router.refresh();
      }
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────

  function getOccupancyPercent(occupied: number, total: number) {
    return total > 0 ? Math.round((occupied / total) * 100) : 0;
  }

  function getBedColorClass(status: string) {
    switch (status) {
      case "AVAILABLE":
        return "bg-green-100 border-green-300 text-green-700";
      case "OCCUPIED":
        return "bg-red-100 border-red-300 text-red-700";
      case "MAINTENANCE":
        return "bg-yellow-100 border-yellow-300 text-yellow-700";
      default:
        return "bg-gray-100 border-gray-300 text-gray-700";
    }
  }

  return (
    <div className="space-y-4">
      {/* Add Hostel button */}
      <div className="flex justify-end">
        <button
          onClick={() => openHostelForm()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Hostel
        </button>
      </div>

      {/* Hostel Cards */}
      {hostels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <h3 className="text-lg font-medium text-foreground">No Hostels</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by adding your first hostel.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {hostels.map((hostel) => {
            const occupancyPercent = getOccupancyPercent(hostel.occupiedBeds, hostel.totalBeds);
            const isExpanded = expandedHostelId === hostel.id;

            return (
              <div key={hostel.id} className={`rounded-lg border border-border bg-card overflow-hidden ${isExpanded ? "md:col-span-2 lg:col-span-3" : ""}`}>
                {/* Hostel Card Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => handleExpandHostel(hostel.id)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{hostel.name}</h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            hostel.gender === "MALE"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-pink-100 text-pink-700"
                          }`}
                        >
                          {hostel.gender}
                        </span>
                      </div>
                      {hostel.wardenName && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Warden: {hostel.wardenName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openHostelForm(hostel);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHostel(hostel.id, hostel.name);
                        }}
                        className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Dormitories</p>
                      <p className="text-sm font-semibold">{hostel.dormitoryCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Beds</p>
                      <p className="text-sm font-semibold">{hostel.totalBeds}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Occupied</p>
                      <p className="text-sm font-semibold">{hostel.occupiedBeds}</p>
                    </div>
                  </div>

                  {/* Occupancy Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Occupancy</span>
                      <span>{occupancyPercent}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          occupancyPercent >= 90
                            ? "bg-red-500"
                            : occupancyPercent >= 70
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{ width: `${occupancyPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Dormitory Details */}
                {isExpanded && hostelDetail && (
                  <div className="border-t border-border p-4 bg-muted/10">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Dormitories</h4>
                      <button
                        onClick={() => openDormForm(hostel.id)}
                        className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        Add Dormitory
                      </button>
                    </div>

                    {hostelDetail.dormitories.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No dormitories yet. Add one to get started.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {hostelDetail.dormitories.map((dorm) => {
                          const dormOccupied = dorm.beds.filter((b) => b.status === "OCCUPIED").length;
                          const dormTotal = dorm.beds.length;
                          const isDormExpanded = expandedDormId === dorm.id;

                          return (
                            <div
                              key={dorm.id}
                              className="rounded-md border border-border bg-card"
                            >
                              <div
                                className="p-3 cursor-pointer hover:bg-muted/30 transition-colors flex items-center justify-between"
                                onClick={() =>
                                  setExpandedDormId(isDormExpanded ? null : dorm.id)
                                }
                              >
                                <div>
                                  <span className="font-medium text-sm">{dorm.name}</span>
                                  {dorm.floor && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      Floor: {dorm.floor}
                                    </span>
                                  )}
                                  <span className="ml-3 text-xs text-muted-foreground">
                                    {dormOccupied}/{dormTotal} beds occupied
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openBedForm(dorm.id);
                                    }}
                                    className="text-xs text-green-600 hover:text-green-800 font-medium"
                                  >
                                    Add Beds
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteDormitory(dorm.id, dorm.name);
                                    }}
                                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                                  >
                                    Delete
                                  </button>
                                  <span className="text-xs text-muted-foreground">
                                    {isDormExpanded ? "▲" : "▼"}
                                  </span>
                                </div>
                              </div>

                              {/* Bed Grid */}
                              {isDormExpanded && (
                                <div className="border-t border-border p-3">
                                  {dorm.beds.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-2">
                                      No beds. Click &quot;Add Beds&quot; to create some.
                                    </p>
                                  ) : (
                                    <>
                                      {/* Legend */}
                                      <div className="flex items-center gap-4 mb-3 text-xs">
                                        <div className="flex items-center gap-1">
                                          <div className="h-3 w-3 rounded bg-green-100 border border-green-300" />
                                          <span>Available</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <div className="h-3 w-3 rounded bg-red-100 border border-red-300" />
                                          <span>Occupied</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <div className="h-3 w-3 rounded bg-yellow-100 border border-yellow-300" />
                                          <span>Maintenance</span>
                                        </div>
                                      </div>

                                      {/* Grid */}
                                      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                                        {dorm.beds.map((bed) => (
                                          <div
                                            key={bed.id}
                                            className={`relative rounded border p-2 text-center text-xs ${getBedColorClass(
                                              bed.status,
                                            )}`}
                                            title={
                                              bed.studentName
                                                ? `${bed.bedNumber} - ${bed.studentName}`
                                                : bed.bedNumber
                                            }
                                          >
                                            <p className="font-medium truncate">{bed.bedNumber}</p>
                                            {bed.studentName && (
                                              <p className="text-[10px] truncate mt-0.5">
                                                {bed.studentName}
                                              </p>
                                            )}
                                            {bed.status === "AVAILABLE" && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteBed(bed.id, bed.bedNumber);
                                                }}
                                                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center hover:bg-red-600"
                                                title="Delete bed"
                                              >
                                                x
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Hostel Form Modal ──────────────────────────────────────── */}
      {showHostelForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">
              {editingHostel ? "Edit Hostel" : "Add Hostel"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Hostel Name</label>
                <input
                  type="text"
                  value={hostelForm.name}
                  onChange={(e) => setHostelForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Kwame Nkrumah Hall"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select
                  value={hostelForm.gender}
                  onChange={(e) =>
                    setHostelForm((p) => ({ ...p, gender: e.target.value as "MALE" | "FEMALE" }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Capacity</label>
                <input
                  type="number"
                  value={hostelForm.capacity}
                  onChange={(e) =>
                    setHostelForm((p) => ({ ...p, capacity: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description (optional)</label>
                <textarea
                  value={hostelForm.description}
                  onChange={(e) => setHostelForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Brief description..."
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowHostelForm(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveHostel}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Dormitory Form Modal ───────────────────────────────────── */}
      {showDormForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Add Dormitory</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Dormitory Name</label>
                <input
                  type="text"
                  value={dormForm.name}
                  onChange={(e) => setDormForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Block A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Floor (optional)</label>
                <input
                  type="text"
                  value={dormForm.floor}
                  onChange={(e) => setDormForm((p) => ({ ...p, floor: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Ground Floor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Capacity</label>
                <input
                  type="number"
                  value={dormForm.capacity}
                  onChange={(e) =>
                    setDormForm((p) => ({ ...p, capacity: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  min={0}
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDormForm(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDormitory}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Beds Modal ─────────────────────────────────────────── */}
      {showBedForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Add Beds</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Number of Beds</label>
                <input
                  type="number"
                  value={bedForm.count}
                  onChange={(e) =>
                    setBedForm((p) => ({ ...p, count: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  min={1}
                  max={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Prefix (optional)</label>
                <input
                  type="text"
                  value={bedForm.prefix}
                  onChange={(e) => setBedForm((p) => ({ ...p, prefix: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Bed"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Beds will be named: {bedForm.prefix} 1, {bedForm.prefix} 2, etc.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowBedForm(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBeds}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Adding..." : `Add ${bedForm.count} Beds`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
