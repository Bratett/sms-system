"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createPeriodAction,
  updatePeriodAction,
  deletePeriodAction,
} from "@/modules/timetable/actions/timetable.action";

// ─── Types ──────────────────────────────────────────────────────────

interface PeriodRow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  order: number;
  type: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PERIOD_TYPES = ["LESSON", "BREAK", "ASSEMBLY", "FREE"] as const;

// ─── Component ──────────────────────────────────────────────────────

export function PeriodsClient({
  periods,
}: {
  periods: PeriodRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<PeriodRow | null>(null);
  const [periodForm, setPeriodForm] = useState({
    name: "",
    startTime: "",
    endTime: "",
    order: 1,
    type: "LESSON" as (typeof PERIOD_TYPES)[number],
  });

  // ─── CRUD ───────────────────────────────────────────────────────

  function openForm(period?: PeriodRow) {
    if (period) {
      setEditingPeriod(period);
      setPeriodForm({
        name: period.name,
        startTime: period.startTime,
        endTime: period.endTime,
        order: period.order,
        type: period.type as (typeof PERIOD_TYPES)[number],
      });
    } else {
      setEditingPeriod(null);
      const nextOrder = periods.length > 0 ? Math.max(...periods.map((p) => p.order)) + 1 : 1;
      setPeriodForm({ name: "", startTime: "", endTime: "", order: nextOrder, type: "LESSON" });
    }
    setShowForm(true);
  }

  function handleSave() {
    if (!periodForm.name.trim()) {
      toast.error("Period name is required.");
      return;
    }
    if (!periodForm.startTime || !periodForm.endTime) {
      toast.error("Start time and end time are required.");
      return;
    }

    startTransition(async () => {
      if (editingPeriod) {
        const result = await updatePeriodAction(editingPeriod.id, {
          name: periodForm.name,
          startTime: periodForm.startTime,
          endTime: periodForm.endTime,
          order: periodForm.order,
          type: periodForm.type,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Period updated successfully.");
      } else {
        const result = await createPeriodAction({
          name: periodForm.name,
          startTime: periodForm.startTime,
          endTime: periodForm.endTime,
          order: periodForm.order,
          type: periodForm.type,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Period created successfully.");
      }
      setShowForm(false);
      router.refresh();
    });
  }

  function handleDelete(period: PeriodRow) {
    if (!confirm(`Delete period "${period.name}"? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = await deletePeriodAction(period.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Period deleted successfully.");
      router.refresh();
    });
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-end rounded-lg border bg-card p-4">
        <button
          onClick={() => openForm()}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Period
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Order</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Start Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">End Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Active</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {periods.map((period) => (
              <tr key={period.id}>
                <td className="px-4 py-3 text-sm font-medium">{period.order}</td>
                <td className="px-4 py-3 text-sm font-medium">{period.name}</td>
                <td className="px-4 py-3 text-sm">{period.startTime}</td>
                <td className="px-4 py-3 text-sm">{period.endTime}</td>
                <td className="px-4 py-3 text-sm">
                  {period.type === "LESSON" ? (
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                      LESSON
                    </span>
                  ) : period.type === "BREAK" ? (
                    <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
                      BREAK
                    </span>
                  ) : period.type === "ASSEMBLY" ? (
                    <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-400">
                      ASSEMBLY
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-950 dark:text-gray-400">
                      FREE
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {period.isActive ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openForm(period)}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(period)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {periods.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No periods configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Period Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              {editingPeriod ? "Edit Period" : "New Period"}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <input
                  type="text"
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Period 1, Morning Break"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Start Time *</label>
                <input
                  type="text"
                  value={periodForm.startTime}
                  onChange={(e) => setPeriodForm({ ...periodForm, startTime: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="08:00"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">End Time *</label>
                <input
                  type="text"
                  value={periodForm.endTime}
                  onChange={(e) => setPeriodForm({ ...periodForm, endTime: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="08:45"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Order *</label>
                <input
                  type="number"
                  value={periodForm.order}
                  onChange={(e) => setPeriodForm({ ...periodForm, order: parseInt(e.target.value) || 1 })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  min="1"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Type *</label>
                <select
                  value={periodForm.type}
                  onChange={(e) => setPeriodForm({ ...periodForm, type: e.target.value as (typeof PERIOD_TYPES)[number] })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {PERIOD_TYPES.map((t) => (
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
                {isPending ? "Saving..." : editingPeriod ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
