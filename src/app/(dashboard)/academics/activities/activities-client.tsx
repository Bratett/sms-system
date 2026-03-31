"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createActivityAction,
  updateActivityAction,
  deleteActivityAction,
} from "@/modules/academics/actions/cocurricular.action";

// ─── Types ──────────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  name: string;
  type: string;
  description: string | null;
  supervisorId: string | null;
  maxParticipants: number | null;
  status: string;
  participantCount: number;
  createdAt: Date | string;
}

interface FormData {
  name: string;
  type: string;
  description: string;
  maxParticipants: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const ACTIVITY_TYPES = [
  "CLUB",
  "SPORT",
  "SOCIETY",
  "CULTURAL",
  "RELIGIOUS",
  "COMMUNITY_SERVICE",
  "OTHER_ACTIVITY",
] as const;

const TYPE_LABELS: Record<string, string> = {
  CLUB: "Club",
  SPORT: "Sport",
  SOCIETY: "Society",
  CULTURAL: "Cultural",
  RELIGIOUS: "Religious",
  COMMUNITY_SERVICE: "Community Service",
  OTHER_ACTIVITY: "Other",
};

// ─── Helpers ────────────────────────────────────────────────────────

function getTypeBadge(type: string) {
  const map: Record<string, string> = {
    CLUB: "bg-blue-100 text-blue-700",
    SPORT: "bg-emerald-100 text-emerald-700",
    SOCIETY: "bg-purple-100 text-purple-700",
    CULTURAL: "bg-amber-100 text-amber-700",
    RELIGIOUS: "bg-teal-100 text-teal-700",
    COMMUNITY_SERVICE: "bg-cyan-100 text-cyan-700",
    OTHER_ACTIVITY: "bg-gray-100 text-gray-700",
  };
  return map[type] || "bg-gray-100 text-gray-700";
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    INACTIVE: "bg-gray-100 text-gray-700",
  };
  return map[status] || "bg-gray-100 text-gray-700";
}

const emptyForm: FormData = {
  name: "",
  type: "CLUB",
  description: "",
  maxParticipants: "",
};

// ─── Component ──────────────────────────────────────────────────────

export function ActivitiesClient({
  initialActivities,
}: {
  initialActivities: ActivityItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activities] = useState<ActivityItem[]>(initialActivities);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ActivityItem | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ActivityItem | null>(null);

  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // ─── Filter logic ─────────────────────────────────────────────────

  const filtered = activities.filter((a) => {
    if (filterType && a.type !== filterType) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        a.name.toLowerCase().includes(term) ||
        (a.description && a.description.toLowerCase().includes(term))
      );
    }
    return true;
  });

  // ─── CRUD Handlers ────────────────────────────────────────────────

  function handleCreate() {
    setEditingItem(null);
    setFormData(emptyForm);
    setShowModal(true);
  }

  function handleEdit(item: ActivityItem) {
    setEditingItem(item);
    setFormData({
      name: item.name,
      type: item.type,
      description: item.description ?? "",
      maxParticipants: item.maxParticipants?.toString() ?? "",
    });
    setShowModal(true);
  }

  function confirmDelete(item: ActivityItem) {
    setDeletingItem(item);
    setShowDeleteConfirm(true);
  }

  function handleDelete() {
    if (!deletingItem) return;
    startTransition(async () => {
      const result = await deleteActivityAction(deletingItem.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Activity "${deletingItem.name}" deleted.`);
        setShowDeleteConfirm(false);
        setDeletingItem(null);
        router.refresh();
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Activity name is required.");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      description: formData.description.trim() || undefined,
      maxParticipants: formData.maxParticipants
        ? parseInt(formData.maxParticipants, 10)
        : undefined,
    };

    startTransition(async () => {
      if (editingItem) {
        const result = await updateActivityAction(editingItem.id, payload);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(`Activity "${formData.name}" updated.`);
          setShowModal(false);
          router.refresh();
        }
      } else {
        const result = await createActivityAction(payload);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(`Activity "${formData.name}" created.`);
          setShowModal(false);
          router.refresh();
        }
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search activities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-56 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Types</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Activity
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-center font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-center font-medium">
                  Max Participants
                </th>
                <th className="px-4 py-3 text-center font-medium">
                  Current
                </th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No activities found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getTypeBadge(item.type)}`}
                      >
                        {TYPE_LABELS[item.type] || item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {item.description || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.maxParticipants ?? "Unlimited"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.participantCount}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => confirmDelete(item)}
                          disabled={isPending}
                          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
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
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {activities.length} activities
      </p>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingItem ? `Edit Activity: ${editingItem.name}` : "New Activity"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Chess Club"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Describe the activity..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Max Participants
                </label>
                <input
                  type="number"
                  value={formData.maxParticipants}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxParticipants: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Leave empty for unlimited"
                  min={1}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending
                    ? "Saving..."
                    : editingItem
                      ? "Update Activity"
                      : "Create Activity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-lg">
            <div className="px-6 py-4">
              <h2 className="text-lg font-semibold">Confirm Delete</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Are you sure you want to delete &quot;{deletingItem.name}&quot;?
                This action cannot be undone.
              </p>
              {deletingItem.participantCount > 0 && (
                <p className="mt-2 text-sm text-amber-600">
                  Warning: This activity has {deletingItem.participantCount}{" "}
                  active participant(s).
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingItem(null);
                }}
                className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
