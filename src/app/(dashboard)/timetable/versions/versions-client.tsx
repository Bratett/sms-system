"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  createTimetableVersionAction,
  publishTimetableVersionAction,
  restoreTimetableVersionAction,
} from "@/modules/timetable/actions/timetable-version.action";

interface VersionRow {
  id: string;
  name: string;
  status: string;
  slotCount: number;
  createdBy: string;
  publishedAt: Date | null;
  createdAt: Date;
}

interface TermOption {
  id: string;
  name: string;
  isCurrent: boolean;
  academicYearName: string;
  academicYearId: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PUBLISHED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-blue-100 text-blue-700",
};

export function VersionsClient({
  versions,
  terms,
  currentTermId,
}: {
  versions: VersionRow[];
  terms: TermOption[];
  currentTermId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [selectedTermId, setSelectedTermId] = useState(currentTermId ?? "");

  const selectedTerm = terms.find((t) => t.id === selectedTermId);

  function handleFilter(termId: string) {
    setSelectedTermId(termId);
    const params = new URLSearchParams();
    if (termId) params.set("termId", termId);
    router.push(`/timetable/versions?${params.toString()}`);
  }

  function handleCreateSnapshot() {
    if (!snapshotName.trim()) {
      toast.error("Version name is required.");
      return;
    }
    if (!selectedTerm) {
      toast.error("Select a term first.");
      return;
    }

    startTransition(async () => {
      const result = await createTimetableVersionAction({
        termId: selectedTerm.id,
        academicYearId: selectedTerm.academicYearId,
        name: snapshotName.trim(),
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Snapshot created with ${result.data?.slotCount} slots.`);
        setShowForm(false);
        setSnapshotName("");
        router.refresh();
      }
    });
  }

  function handlePublish(id: string, name: string) {
    if (!confirm(`Publish version "${name}"? This will archive the currently published version.`)) return;

    startTransition(async () => {
      const result = await publishTimetableVersionAction(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(`Version "${name}" published.`);
        router.refresh();
      }
    });
  }

  function handleRestore(id: string, name: string) {
    if (
      !confirm(
        `Restore version "${name}"? This will DELETE all current timetable slots for this term and replace them with the snapshot data. This action cannot be undone.`,
      )
    )
      return;

    startTransition(async () => {
      const result = await restoreTimetableVersionAction(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(`Restored ${result.data?.restored} slots from "${name}".`);
        router.refresh();
      }
    });
  }

  return (
    <>
      {/* Filters + Actions */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Term</label>
          <select
            value={selectedTermId}
            onChange={(e) => handleFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm min-w-[220px]"
          >
            <option value="">All Terms</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.academicYearName} - {t.name} {t.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setShowForm(true)}
            disabled={isPending || !selectedTermId}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Create Snapshot
          </button>
        </div>
      </div>

      {/* Versions Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-center font-medium">Slots</th>
              <th className="px-4 py-3 text-left font-medium">Created By</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-left font-medium">Published</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No timetable versions found.
                  {selectedTermId
                    ? " Create a snapshot to save the current timetable state."
                    : " Select a term to filter."}
                </td>
              </tr>
            ) : (
              versions.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{v.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[v.status] ?? ""
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">{v.slotCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.createdBy}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {format(new Date(v.createdAt), "dd MMM yyyy HH:mm")}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {v.publishedAt
                      ? format(new Date(v.publishedAt), "dd MMM yyyy HH:mm")
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {v.status === "DRAFT" && (
                        <button
                          onClick={() => handlePublish(v.id, v.name)}
                          disabled={isPending}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Publish
                        </button>
                      )}
                      <button
                        onClick={() => handleRestore(v.id, v.name)}
                        disabled={isPending}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Restore
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Snapshot Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Create Timetable Snapshot</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              This will save a copy of the current timetable for{" "}
              <strong>{selectedTerm?.academicYearName} - {selectedTerm?.name}</strong>.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium">Version Name *</label>
              <input
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="e.g., Before mid-term changes"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  setSnapshotName("");
                }}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSnapshot}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create Snapshot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
