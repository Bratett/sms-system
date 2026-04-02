"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createAssetAuditAction,
  getAssetAuditAction,
  recordAuditFindingsAction,
  completeAssetAuditAction,
} from "@/modules/inventory/actions/asset-audit.action";

// ─── Types ──────────────────────────────────────────────────────────

interface Audit {
  id: string;
  reference: string;
  status: string;
  scheduledDate: Date | string | null;
  completedAt: Date | string | null;
  conductedBy: string | null;
  conductedByName: string | null;
  assetCount: number;
  notes: string | null;
  createdAt: Date | string;
}

interface Category {
  id: string;
  name: string;
  code: string | null;
  assetCount: number;
}

interface AuditItem {
  id: string;
  fixedAssetId: string;
  assetNumber: string;
  assetName: string;
  categoryName: string;
  expectedLocation: string | null;
  expectedCondition: string | null;
  found: boolean | null;
  condition: string | null;
  locationVerified: boolean | null;
  notes: string | null;
}

type AssetCondition = "NEW" | "GOOD" | "FAIR" | "POOR" | "UNSERVICEABLE";

const STATUS_STYLES: Record<string, string> = {
  PLANNED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  COMPLETED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Component ──────────────────────────────────────────────────────

export function AssetAuditsClient({
  audits,
  categories,
}: {
  audits: Audit[];
  categories: Category[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFindingsModal, setShowFindingsModal] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);

  const [createForm, setCreateForm] = useState({
    scheduledDate: "",
    categoryId: "",
    locationFilter: "",
    notes: "",
  });

  // Local state for findings
  const [findings, setFindings] = useState<
    Record<string, { found: boolean; condition: AssetCondition; locationVerified: boolean; notes: string }>
  >({});

  function handleSubmitCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createAssetAuditAction({
        scheduledDate: createForm.scheduledDate || undefined,
        categoryId: createForm.categoryId || undefined,
        locationFilter: createForm.locationFilter || undefined,
        notes: createForm.notes || undefined,
      });
      if ("error" in result) { toast.error(result.error); return; }
      toast.success(`Audit ${result.data.reference} created with ${result.data.items.length} asset(s)`);
      setShowCreateModal(false);
      setCreateForm({ scheduledDate: "", categoryId: "", locationFilter: "", notes: "" });
      router.refresh();
    });
  }

  function handleOpenFindings(audit: Audit) {
    setSelectedAudit(audit);
    startTransition(async () => {
      const result = await getAssetAuditAction(audit.id);
      if ("error" in result) { toast.error(result.error); return; }
      const items = result.data.items;
      setAuditItems(items);
      // Initialize findings state from existing data
      const initial: Record<string, { found: boolean; condition: AssetCondition; locationVerified: boolean; notes: string }> = {};
      for (const item of items) {
        initial[item.id] = {
          found: item.found ?? true,
          condition: (item.condition as AssetCondition) ?? (item.expectedCondition as AssetCondition) ?? "GOOD",
          locationVerified: item.locationVerified ?? true,
          notes: item.notes ?? "",
        };
      }
      setFindings(initial);
      setShowFindingsModal(true);
    });
  }

  function updateFinding(itemId: string, field: string, value: unknown) {
    setFindings((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  }

  function handleSaveFindings(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAudit) return;
    startTransition(async () => {
      const payload = Object.entries(findings).map(([auditItemId, data]) => ({
        auditItemId,
        found: data.found,
        condition: data.condition,
        locationVerified: data.locationVerified,
        notes: data.notes || undefined,
      }));
      const result = await recordAuditFindingsAction(selectedAudit.id, payload);
      if ("error" in result) { toast.error(result.error); return; }
      toast.success(`Findings recorded for ${payload.length} asset(s)`);
      setShowFindingsModal(false);
      router.refresh();
    });
  }

  function handleStartAudit(audit: Audit) {
    handleOpenFindings(audit);
  }

  function handleComplete(audit: Audit) {
    startTransition(async () => {
      const result = await completeAssetAuditAction(audit.id);
      if ("error" in result) { toast.error(result.error); return; }
      const summary = result.data.summary;
      toast.success(`Audit completed — Found: ${summary.found}, Missing: ${summary.notFound}, Location issues: ${summary.locationMismatch}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Schedule Audit Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Schedule Audit
        </button>
      </div>

      {/* Audits Table */}
      {audits.length === 0 ? (
        <EmptyState title="No audits found" description="Schedule an asset audit to verify physical assets." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assets</th>
                  <th className="px-4 py-3">Scheduled Date</th>
                  <th className="px-4 py-3">Completed At</th>
                  <th className="px-4 py-3">Conducted By</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {audits.map((audit) => (
                  <tr key={audit.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-mono font-medium">{audit.reference}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[audit.status] ?? ""}`}>
                        {audit.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{audit.assetCount}</td>
                    <td className="px-4 py-3 text-sm">{fmtDate(audit.scheduledDate)}</td>
                    <td className="px-4 py-3 text-sm">{fmtDate(audit.completedAt)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{audit.conductedByName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {audit.status === "PLANNED" && (
                          <button
                            onClick={() => handleStartAudit(audit)}
                            disabled={isPending}
                            className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                          >
                            Start Audit
                          </button>
                        )}
                        {audit.status === "IN_PROGRESS" && (
                          <>
                            <button
                              onClick={() => handleOpenFindings(audit)}
                              disabled={isPending}
                              className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                            >
                              Record Findings
                            </button>
                            <button
                              onClick={() => handleComplete(audit)}
                              disabled={isPending}
                              className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50"
                            >
                              Complete
                            </button>
                          </>
                        )}
                        {(audit.status === "COMPLETED" || audit.status === "APPROVED") && (
                          <span className="text-xs text-muted-foreground">No actions</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Audit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Schedule Asset Audit</h2>
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Scheduled Date</label>
                <input
                  type="date"
                  value={createForm.scheduledDate}
                  onChange={(e) => setCreateForm((p) => ({ ...p, scheduledDate: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Category Filter (optional)</label>
                <select
                  value={createForm.categoryId}
                  onChange={(e) => setCreateForm((p) => ({ ...p, categoryId: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.assetCount})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Location Filter (optional)</label>
                <input
                  type="text"
                  value={createForm.locationFilter}
                  onChange={(e) => setCreateForm((p) => ({ ...p, locationFilter: e.target.value }))}
                  placeholder="Filter by location (e.g. Block A)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Additional notes for this audit"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Schedule Audit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Findings Modal */}
      {showFindingsModal && selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-1 text-lg font-semibold">Audit Findings — {selectedAudit.reference}</h2>
            <p className="mb-4 text-sm text-muted-foreground">{auditItems.length} asset(s) to verify</p>
            <form onSubmit={handleSaveFindings}>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2">Asset #</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Expected Location</th>
                      <th className="px-3 py-2">Found</th>
                      <th className="px-3 py-2">Condition</th>
                      <th className="px-3 py-2">Location OK</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditItems.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/50">
                        <td className="px-3 py-2 text-sm font-mono">{item.assetNumber}</td>
                        <td className="px-3 py-2 text-sm font-medium">{item.assetName}</td>
                        <td className="px-3 py-2 text-sm text-muted-foreground">{item.expectedLocation ?? "—"}</td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={findings[item.id]?.found ?? true}
                            onChange={(e) => updateFinding(item.id, "found", e.target.checked)}
                            className="h-4 w-4 rounded border-border"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={findings[item.id]?.condition ?? "GOOD"}
                            onChange={(e) => updateFinding(item.id, "condition", e.target.value)}
                            className="rounded border border-border bg-background px-2 py-1 text-xs"
                          >
                            <option value="NEW">New</option>
                            <option value="GOOD">Good</option>
                            <option value="FAIR">Fair</option>
                            <option value="POOR">Poor</option>
                            <option value="UNSERVICEABLE">Unserviceable</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={findings[item.id]?.locationVerified ?? true}
                            onChange={(e) => updateFinding(item.id, "locationVerified", e.target.checked)}
                            className="h-4 w-4 rounded border-border"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={findings[item.id]?.notes ?? ""}
                            onChange={(e) => updateFinding(item.id, "notes", e.target.value)}
                            placeholder="Notes"
                            className="w-full min-w-[120px] rounded border border-border bg-background px-2 py-1 text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFindingsModal(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Findings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
