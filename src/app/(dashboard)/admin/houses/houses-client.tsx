"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  createHouseAction,
  updateHouseAction,
  deleteHouseAction,
} from "@/modules/school/actions/house.action";

interface House {
  id: string;
  name: string;
  color: string | null;
  motto: string | null;
  description: string | null;
  status: string;
  housemasterId: string | null;
  housemaster: { id: string; firstName: string; lastName: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface EligibleHousemaster {
  id: string;
  firstName: string;
  lastName: string;
  userId: string | null;
}

interface FormData {
  name: string;
  color: string;
  motto: string;
  description: string;
  housemasterId: string;
}

export function HousesClient({
  houses,
  eligibleHousemasters,
}: {
  houses: House[];
  eligibleHousemasters: EligibleHousemaster[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    color: "#3b82f6",
    motto: "",
    description: "",
    housemasterId: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  function handleCreate() {
    setEditingHouse(null);
    setFormData({
      name: "",
      color: "#3b82f6",
      motto: "",
      description: "",
      housemasterId: "",
    });
    setFormError(null);
    setShowModal(true);
  }

  function handleEdit(house: House) {
    setEditingHouse(house);
    setFormData({
      name: house.name,
      color: house.color ?? "#3b82f6",
      motto: house.motto ?? "",
      description: house.description ?? "",
      housemasterId: house.housemasterId ?? "",
    });
    setFormError(null);
    setShowModal(true);
  }

  function handleClose() {
    setShowModal(false);
    setEditingHouse(null);
    setFormError(null);
  }

  function handleDelete(house: House) {
    if (!confirm(`Are you sure you want to delete house "${house.name}"?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteHouseAction(house.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`House "${house.name}" deleted successfully.`);
        router.refresh();
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("House name is required.");
      return;
    }
    setFormError(null);

    startTransition(async () => {
      if (editingHouse) {
        const result = await updateHouseAction(editingHouse.id, {
          name: formData.name.trim(),
          color: formData.color,
          motto: formData.motto.trim(),
          description: formData.description.trim(),
          housemasterId: formData.housemasterId,
        });
        if ("error" in result) {
          setFormError(result.error);
        } else {
          toast.success(`House "${formData.name}" updated successfully.`);
          handleClose();
          router.refresh();
        }
      } else {
        const result = await createHouseAction({
          name: formData.name.trim(),
          color: formData.color || undefined,
          motto: formData.motto.trim() || undefined,
          description: formData.description.trim() || undefined,
          housemasterId: formData.housemasterId,
        });
        if ("error" in result) {
          setFormError(result.error);
        } else {
          toast.success(`House "${formData.name}" created successfully.`);
          handleClose();
          router.refresh();
        }
      }
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={handleCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add House
        </button>
      </div>

      {houses.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          No houses found. Click &quot;Add House&quot; to create one.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {houses.map((house) => (
            <div
              key={house.id}
              className="rounded-lg border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-full border border-border shrink-0"
                    style={{ backgroundColor: house.color ?? "#6b7280" }}
                    title={house.color ?? "No color set"}
                  />
                  <div>
                    <h3 className="font-semibold text-base">{house.name}</h3>
                    {house.motto && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">
                        &ldquo;{house.motto}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
                <StatusBadge status={house.status} />
              </div>

              {house.description && (
                <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                  {house.description}
                </p>
              )}

              {house.color && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Color:</span>
                  <span className="font-mono">{house.color}</span>
                </div>
              )}

              {house.housemaster && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Housemaster:</span>
                  <span className="font-medium text-foreground">
                    {house.housemaster.firstName} {house.housemaster.lastName}
                  </span>
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
                <button
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  onClick={() => handleEdit(house)}
                >
                  Edit
                </button>
                <button
                  className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                  onClick={() => handleDelete(house)}
                  disabled={isPending}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingHouse ? `Edit House: ${editingHouse.name}` : "Add House"}
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-md p-3 text-sm bg-red-50 text-red-800 border border-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  House Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Red House"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-14 rounded border border-input cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Motto</label>
                <input
                  type="text"
                  value={formData.motto}
                  onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Unity and Strength"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Brief description of the house"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Housemaster</label>
                <select
                  value={formData.housemasterId}
                  onChange={(e) =>
                    setFormData({ ...formData, housemasterId: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— None —</option>
                  {eligibleHousemasters.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.firstName} {staff.lastName}
                    </option>
                  ))}
                </select>
                {eligibleHousemasters.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No eligible staff found. Staff must be active and have a linked portal user.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending
                    ? "Saving..."
                    : editingHouse
                      ? "Update House"
                      : "Create House"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
