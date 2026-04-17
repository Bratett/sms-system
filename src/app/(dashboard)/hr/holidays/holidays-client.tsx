"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getHolidaysAction,
  createHolidayAction,
  deleteHolidayAction,
  importGhanaHolidaysAction,
} from "@/modules/hr/actions/holiday.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Holiday {
  id: string;
  name: string;
  date: Date | string;
  recurring: boolean;
}

// ─── Component ──────────────────────────────────────────────────────

export function HolidaysClient({
  initialHolidays,
  initialYear,
}: {
  initialHolidays: Holiday[];
  initialYear: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [year, setYear] = useState(initialYear);

  // Add holiday form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    date: "",
    recurring: false,
  });

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const yearOptions = Array.from({ length: 5 }, (_, i) => initialYear - 2 + i);

  // ─── Fetch holidays for selected year ─────────────────────────────

  function handleYearChange(newYear: number) {
    setYear(newYear);
    startTransition(async () => {
      const result = await getHolidaysAction({ year: newYear });
      if ("data" in result) {
        setHolidays(result.data);
      }
    });
  }

  // ─── Create Holiday ───────────────────────────────────────────────

  function handleCreate() {
    if (!form.name.trim() || !form.date) {
      toast.error("Name and date are required.");
      return;
    }

    startTransition(async () => {
      const result = await createHolidayAction({
        name: form.name.trim(),
        date: form.date,
        recurring: form.recurring,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Holiday created.");
        setShowForm(false);
        setForm({ name: "", date: "", recurring: false });
        router.refresh();
      }
    });
  }

  // ─── Delete Holiday ───────────────────────────────────────────────

  function handleDelete() {
    if (!deletingId) return;

    startTransition(async () => {
      const result = await deleteHolidayAction(deletingId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Holiday deleted.");
        setDeletingId(null);
        router.refresh();
      }
    });
  }

  // ─── Import Ghana Holidays ────────────────────────────────────────

  function handleImportGhana() {
    startTransition(async () => {
      const result = await importGhanaHolidaysAction(year);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Imported ${result.data.imported} Ghana holidays.`);
        router.refresh();
      }
    });
  }

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* ─── Controls ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Year:</label>
          <select
            value={year}
            onChange={(e) => handleYearChange(parseInt(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={handleImportGhana}
            disabled={isPending}
            className="rounded-md border border-input bg-background px-4 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {isPending ? "Importing..." : "Import Ghana Holidays"}
          </button>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Holiday
        </button>
      </div>

      {/* ─── Holidays Table ────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-center font-medium">Recurring</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidays.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No holidays found for {year}.
                  </td>
                </tr>
              ) : (
                holidays.map((h) => (
                  <tr key={h.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(h.date)}
                    </td>
                    <td className="px-4 py-3 font-medium">{h.name}</td>
                    <td className="px-4 py-3 text-center">
                      {h.recurring ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDeletingId(h.id)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Add Holiday Modal ─────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Add Holiday</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Independence Day"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.recurring}
                  onChange={(e) => setForm((p) => ({ ...p, recurring: e.target.checked }))}
                  className="rounded accent-primary h-4 w-4"
                  id="recurring"
                />
                <label htmlFor="recurring" className="text-sm">
                  Recurring every year
                </label>
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
                {isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─────────────────────────────── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Confirm Delete</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete this holiday? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
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
