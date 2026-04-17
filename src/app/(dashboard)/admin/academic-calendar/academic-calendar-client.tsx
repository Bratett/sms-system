"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createAcademicEventAction,
  updateAcademicEventAction,
  deleteAcademicEventAction,
} from "@/modules/school/actions/academic-event.action";

const EVENT_TYPES = [
  "EXAM_PERIOD",
  "HOLIDAY",
  "HALF_TERM",
  "PTA_MEETING",
  "SPORTS_DAY",
  "CULTURAL_EVENT",
  "ORIENTATION",
  "GRADUATION_CEREMONY",
  "REGISTRATION",
  "MARK_DEADLINE",
  "OTHER",
] as const;

type EventType = (typeof EVENT_TYPES)[number];

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  EXAM_PERIOD: "bg-red-50 text-red-700 border-red-200",
  HOLIDAY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  HALF_TERM: "bg-blue-50 text-blue-700 border-blue-200",
  PTA_MEETING: "bg-purple-50 text-purple-700 border-purple-200",
  SPORTS_DAY: "bg-green-50 text-green-700 border-green-200",
  CULTURAL_EVENT: "bg-amber-50 text-amber-700 border-amber-200",
  ORIENTATION: "bg-cyan-50 text-cyan-700 border-cyan-200",
  GRADUATION_CEREMONY: "bg-yellow-50 text-yellow-700 border-yellow-200",
  REGISTRATION: "bg-teal-50 text-teal-700 border-teal-200",
  MARK_DEADLINE: "bg-orange-50 text-orange-700 border-orange-200",
  OTHER: "bg-gray-50 text-gray-700 border-gray-200",
};

interface FormData {
  title: string;
  type: EventType;
  description: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  color: string;
  academicYearId: string;
}

export function AcademicCalendarClient({
  initialEvents,
  academicYears,
  terms,
}: {
  initialEvents: any[];
  academicYears: Array<{ id: string; name: string; isCurrent: boolean }>;
  terms: Array<{
    id: string;
    name: string;
    termNumber: number;
    academicYearId: string;
    academicYearName: string;
    isCurrent: boolean;
  }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const currentYear = academicYears.find((ay) => ay.isCurrent);
  const [selectedYearId, setSelectedYearId] = useState(currentYear?.id ?? "");

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    title: "",
    type: "OTHER",
    description: "",
    startDate: "",
    endDate: "",
    isAllDay: false,
    color: "",
    academicYearId: currentYear?.id ?? "",
  });

  const filteredEvents = useMemo(() => {
    if (!selectedYearId) return initialEvents;
    return initialEvents.filter(
      (e: any) => e.academicYearId === selectedYearId
    );
  }, [initialEvents, selectedYearId]);

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort(
      (a: any, b: any) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
  }, [filteredEvents]);

  function handleCreate() {
    setEditingItem(null);
    setFormData({
      title: "",
      type: "OTHER",
      description: "",
      startDate: "",
      endDate: "",
      isAllDay: false,
      color: "",
      academicYearId: selectedYearId,
    });
    setShowModal(true);
  }

  function handleEdit(event: any) {
    setEditingItem(event);
    setFormData({
      title: event.title,
      type: event.type,
      description: event.description ?? "",
      startDate: event.startDate
        ? new Date(event.startDate).toISOString().split("T")[0]
        : "",
      endDate: event.endDate
        ? new Date(event.endDate).toISOString().split("T")[0]
        : "",
      isAllDay: event.isAllDay ?? false,
      color: event.color ?? "",
      academicYearId: event.academicYearId ?? selectedYearId,
    });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (editingItem) {
        const result = await updateAcademicEventAction(editingItem.id, {
          title: formData.title,
          type: formData.type,
          description: formData.description || undefined,
          startDate: new Date(formData.startDate),
          endDate: formData.endDate ? new Date(formData.endDate) : undefined,
          isAllDay: formData.isAllDay,
          color: formData.color || undefined,
        });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Event updated successfully");
      } else {
        const result = await createAcademicEventAction({
          title: formData.title,
          type: formData.type,
          startDate: new Date(formData.startDate),
          description: formData.description || undefined,
          endDate: formData.endDate ? new Date(formData.endDate) : undefined,
          isAllDay: formData.isAllDay,
          color: formData.color || undefined,
        });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Event created successfully");
      }
      setShowModal(false);
      setEditingItem(null);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleteId) return;
    startTransition(async () => {
      const result = await deleteAcademicEventAction(deleteId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Event deleted successfully");
      setDeleteId(null);
      router.refresh();
    });
  }

  function formatLabel(val: string) {
    return val.replace(/_/g, " ");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Academic Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Manage academic events, holidays, and important dates.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
        >
          Add Event
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground">
          Academic Year:
        </label>
        <select
          value={selectedYearId}
          onChange={(e) => setSelectedYearId(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Years</option>
          {academicYears.map((ay) => (
            <option key={ay.id} value={ay.id}>
              {ay.name} {ay.isCurrent ? "(Current)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {sortedEvents.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          No events found. Create one to get started.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Start Date</th>
                  <th className="px-4 py-3 text-left font-medium">End Date</th>
                  <th className="px-4 py-3 text-center font-medium">All Day</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedEvents.map((event: any) => (
                  <tr
                    key={event.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{event.title}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          EVENT_TYPE_COLORS[event.type as EventType] ??
                          EVENT_TYPE_COLORS.OTHER
                        }`}
                      >
                        {formatLabel(event.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(event.startDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.endDate
                        ? new Date(event.endDate).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {event.isAllDay ? (
                        <span className="text-emerald-600 font-medium">Yes</span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(event)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(event.id)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                          disabled={isPending}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Delete Event</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete this event? This action cannot be
              undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">
              {editingItem ? "Edit Event" : "Create Event"}
            </h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Event title"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: e.target.value as EventType,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {formatLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Optional description"
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  End Date (optional)
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isAllDay"
                  checked={formData.isAllDay}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isAllDay: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label
                  htmlFor="isAllDay"
                  className="text-sm font-medium text-foreground"
                >
                  All Day Event
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Color (optional)
                </label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, color: e.target.value }))
                  }
                  placeholder="e.g. #ff5733"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingItem(null);
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending
                    ? "Saving..."
                    : editingItem
                      ? "Update"
                      : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
