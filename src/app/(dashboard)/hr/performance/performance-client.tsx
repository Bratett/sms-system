"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getPerformanceNotesAction,
  createPerformanceNoteAction,
} from "@/modules/hr/actions/performance.action";

// ─── Types ──────────────────────────────────────────────────────────

interface PerformanceNote {
  id: string;
  staffId: string;
  staffName?: string;
  period: string;
  rating: number | null;
  strengths: string | null;
  areasForImprovement: string | null;
  goals: string | null;
  comments: string | null;
  academicYearId?: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ─── Component ──────────────────────────────────────────────────────

export function PerformanceClient({
  notes: initialNotes,
  pagination: initialPagination,
}: {
  notes: PerformanceNote[];
  pagination: Pagination;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [notes, setNotes] = useState<PerformanceNote[]>(initialNotes);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    staffId: "",
    period: "",
    rating: 3,
    strengths: "",
    areasForImprovement: "",
    goals: "",
    comments: "",
  });

  function fetchNotes(newPage: number) {
    startTransition(async () => {
      const result = await getPerformanceNotesAction({ page: newPage, pageSize: 25 });
      if ("data" in result) {
        setNotes(result.data);
        setPagination(
          result.pagination ?? { page: newPage, pageSize: 25, total: 0, totalPages: 0 },
        );
      }
    });
  }

  function handleCreate() {
    if (!form.staffId.trim() || !form.period.trim()) {
      toast.error("Staff ID and period are required.");
      return;
    }

    startTransition(async () => {
      const result = await createPerformanceNoteAction({
        staffId: form.staffId.trim(),
        period: form.period.trim(),
        rating: form.rating,
        strengths: form.strengths || undefined,
        areasForImprovement: form.areasForImprovement || undefined,
        goals: form.goals || undefined,
        comments: form.comments || undefined,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Performance review created.");
        setShowForm(false);
        setForm({
          staffId: "",
          period: "",
          rating: 3,
          strengths: "",
          areasForImprovement: "",
          goals: "",
          comments: "",
        });
        router.refresh();
      }
    });
  }

  function renderRating(rating: number | null) {
    if (rating == null) return "-";
    return `${rating}/5`;
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Review
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Staff Name</th>
                <th className="px-4 py-3 text-left font-medium">Period</th>
                <th className="px-4 py-3 text-center font-medium">Rating</th>
                <th className="px-4 py-3 text-left font-medium">Strengths</th>
                <th className="px-4 py-3 text-left font-medium">Areas for Improvement</th>
                <th className="px-4 py-3 text-left font-medium">Goals</th>
              </tr>
            </thead>
            <tbody>
              {notes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No performance reviews found.
                  </td>
                </tr>
              ) : (
                notes.map((note) => (
                  <tr key={note.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {note.staffName || note.staffId}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{note.period}</td>
                    <td className="px-4 py-3 text-center font-medium">
                      {renderRating(note.rating)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">
                      {note.strengths || "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">
                      {note.areasForImprovement || "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">
                      {note.goals || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchNotes(pagination.page - 1)}
              disabled={pagination.page <= 1 || isPending}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
            >
              Previous
            </button>
            <button
              onClick={() => fetchNotes(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isPending}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add Review Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Add Performance Review</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Staff ID</label>
                <input
                  type="text"
                  value={form.staffId}
                  onChange={(e) => setForm((p) => ({ ...p, staffId: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Enter staff ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Period</label>
                <input
                  type="text"
                  value={form.period}
                  onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Term 1 2025/2026"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rating (1-5)</label>
                <input
                  type="number"
                  value={form.rating}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      rating: Math.min(5, Math.max(1, parseInt(e.target.value) || 1)),
                    }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  min={1}
                  max={5}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Strengths</label>
                <textarea
                  value={form.strengths}
                  onChange={(e) => setForm((p) => ({ ...p, strengths: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Key strengths observed..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Areas for Improvement</label>
                <textarea
                  value={form.areasForImprovement}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, areasForImprovement: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Areas that need improvement..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Goals</label>
                <textarea
                  value={form.goals}
                  onChange={(e) => setForm((p) => ({ ...p, goals: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Development goals..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Comments</label>
                <textarea
                  value={form.comments}
                  onChange={(e) => setForm((p) => ({ ...p, comments: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Additional comments..."
                />
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
                {isPending ? "Saving..." : "Save Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
