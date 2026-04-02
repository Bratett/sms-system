"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createRoomAction,
  updateRoomAction,
  deleteRoomAction,
} from "@/modules/timetable/actions/timetable.action";

// ─── Types ──────────────────────────────────────────────────────────

interface RoomRow {
  id: string;
  name: string;
  building: string | null;
  capacity: number | null;
  type: string;
  isActive: boolean;
  slotsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ROOM_TYPES = ["CLASSROOM", "LABORATORY", "HALL", "FIELD", "OTHER"] as const;

// ─── Component ──────────────────────────────────────────────────────

export function RoomsClient({
  rooms,
  filters,
}: {
  rooms: RoomRow[];
  filters: { type?: string; search?: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters
  const [typeFilter, setTypeFilter] = useState(filters.type ?? "");
  const [search, setSearch] = useState(filters.search ?? "");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null);
  const [roomForm, setRoomForm] = useState({
    name: "",
    building: "",
    capacity: 0,
    type: "CLASSROOM" as (typeof ROOM_TYPES)[number],
  });

  // ─── Filter ─────────────────────────────────────────────────────

  function applyFilters() {
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (search) params.set("search", search);
    router.push(`/timetable/rooms?${params.toString()}`);
  }

  function clearFilters() {
    setTypeFilter("");
    setSearch("");
    router.push("/timetable/rooms");
  }

  // ─── CRUD ───────────────────────────────────────────────────────

  function openForm(room?: RoomRow) {
    if (room) {
      setEditingRoom(room);
      setRoomForm({
        name: room.name,
        building: room.building ?? "",
        capacity: room.capacity ?? 0,
        type: room.type as (typeof ROOM_TYPES)[number],
      });
    } else {
      setEditingRoom(null);
      setRoomForm({ name: "", building: "", capacity: 0, type: "CLASSROOM" });
    }
    setShowForm(true);
  }

  function handleSave() {
    if (!roomForm.name.trim()) {
      toast.error("Room name is required.");
      return;
    }

    startTransition(async () => {
      if (editingRoom) {
        const result = await updateRoomAction(editingRoom.id, {
          name: roomForm.name,
          building: roomForm.building || null,
          capacity: roomForm.capacity || null,
          type: roomForm.type,
        });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Room updated successfully.");
      } else {
        const result = await createRoomAction({
          name: roomForm.name,
          building: roomForm.building || undefined,
          capacity: roomForm.capacity || undefined,
          type: roomForm.type,
        });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Room created successfully.");
      }
      setShowForm(false);
      router.refresh();
    });
  }

  function handleDelete(room: RoomRow) {
    if (!confirm(`Delete room "${room.name}"? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = await deleteRoomAction(room.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Room deleted successfully.");
      router.refresh();
    });
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            {ROOM_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
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
            placeholder="Name or building..."
          />
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
            onClick={() => openForm()}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Room
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Building</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Capacity</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Active</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Slots</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {rooms.map((room) => (
              <tr key={room.id}>
                <td className="px-4 py-3 text-sm font-medium">{room.name}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{room.building ?? "-"}</td>
                <td className="px-4 py-3 text-right text-sm">{room.capacity ?? "-"}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                    {room.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {room.isActive ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-sm text-muted-foreground">{room.slotsCount}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openForm(room)}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(room)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No rooms found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Room Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              {editingRoom ? "Edit Room" : "New Room"}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <input
                  type="text"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Room name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Building</label>
                <input
                  type="text"
                  value={roomForm.building}
                  onChange={(e) => setRoomForm({ ...roomForm, building: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Building name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Capacity</label>
                <input
                  type="number"
                  value={roomForm.capacity}
                  onChange={(e) => setRoomForm({ ...roomForm, capacity: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  min="0"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">Type *</label>
                <select
                  value={roomForm.type}
                  onChange={(e) => setRoomForm({ ...roomForm, type: e.target.value as (typeof ROOM_TYPES)[number] })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {ROOM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
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
                {isPending ? "Saving..." : editingRoom ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
