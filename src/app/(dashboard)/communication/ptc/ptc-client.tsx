"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createPTCSessionAction,
  deletePTCSessionAction,
} from "@/modules/communication/actions/ptc.action";

interface FormData {
  title: string;
  academicYearId: string;
  termId: string;
  date: string;
  startTime: string;
  endTime: string;
  slotDuration: number;
  location: string;
}

export function PTCClient({
  initialSessions,
  academicYears,
  terms,
}: {
  initialSessions: any[];
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

  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    title: "",
    academicYearId: currentYear?.id ?? "",
    termId: "",
    date: "",
    startTime: "",
    endTime: "",
    slotDuration: 15,
    location: "",
  });

  const filteredTerms = useMemo(() => {
    return terms.filter((t) => t.academicYearId === formData.academicYearId);
  }, [terms, formData.academicYearId]);

  function handleCreate() {
    setFormData({
      title: "",
      academicYearId: currentYear?.id ?? "",
      termId: "",
      date: "",
      startTime: "",
      endTime: "",
      slotDuration: 15,
      location: "",
    });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createPTCSessionAction({
        title: formData.title,
        academicYearId: formData.academicYearId,
        termId: formData.termId,
        date: new Date(formData.date),
        startTime: formData.startTime,
        endTime: formData.endTime,
        slotDuration: formData.slotDuration,
        location: formData.location || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("PTC session created successfully");
      setShowModal(false);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleteId) return;
    startTransition(async () => {
      const result = await deletePTCSessionAction(deleteId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("PTC session deleted successfully");
      setDeleteId(null);
      router.refresh();
    });
  }

  function getStatusBadge(status: string) {
    const colors =
      status === "ACTIVE"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-gray-50 text-gray-700 border-gray-200";
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors}`}
      >
        {status}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Parent-Teacher Conferences</h1>
          <p className="text-sm text-muted-foreground">
            Schedule and manage parent-teacher conference sessions.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
        >
          Create Session
        </button>
      </div>

      {/* Table */}
      {initialSessions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          No PTC sessions found. Create one to get started.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Time Range</th>
                  <th className="px-4 py-3 text-center font-medium">
                    Slot Duration
                  </th>
                  <th className="px-4 py-3 text-center font-medium">Bookings</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialSessions.map((session: any) => (
                  <tr
                    key={session.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{session.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {session.date
                        ? new Date(session.date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {session.startTime} - {session.endTime}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {session.slotDuration} min
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-xs font-medium">
                        {session.bookingCount ?? session._count?.bookings ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(session.status ?? "ACTIVE")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDeleteId(session.id)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                        disabled={isPending}
                      >
                        Delete
                      </button>
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
            <h3 className="text-lg font-semibold">Delete PTC Session</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete this PTC session? All associated
              bookings will also be removed. This action cannot be undone.
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

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">Create PTC Session</h3>
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
                  placeholder="e.g. Term 1 PTC Meeting"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Academic Year
                </label>
                <select
                  value={formData.academicYearId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      academicYearId: e.target.value,
                      termId: "",
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">Select academic year</option>
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>
                      {ay.name} {ay.isCurrent ? "(Current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Term
                </label>
                <select
                  value={formData.termId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, termId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">Select term</option>
                  {filteredTerms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.isCurrent ? "(Current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        startTime: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        endTime: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Slot Duration (minutes)
                </label>
                <input
                  type="number"
                  value={formData.slotDuration}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      slotDuration: parseInt(e.target.value) || 15,
                    }))
                  }
                  min={5}
                  max={60}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Location (optional)
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                  placeholder="e.g. School Hall, Room 101"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  {isPending ? "Creating..." : "Create Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
