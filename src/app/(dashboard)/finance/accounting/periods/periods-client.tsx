"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  createFiscalPeriodAction,
  setFiscalPeriodStatusAction,
  closeFiscalYearAction,
} from "@/modules/accounting/actions/fiscal-period.action";

interface FiscalPeriod {
  id: string;
  name: string;
  startDate: Date | string;
  endDate: Date | string;
  status: "OPEN" | "SOFT_CLOSED" | "CLOSED";
  isFiscalYear: boolean;
  closedAt: Date | string | null;
  subPeriods?: FiscalPeriod[];
}

const STATUS_STYLES: Record<FiscalPeriod["status"], string> = {
  OPEN: "bg-green-100 text-green-700",
  SOFT_CLOSED: "bg-amber-100 text-amber-700",
  CLOSED: "bg-gray-200 text-gray-700",
};

export function FiscalPeriodsClient({ periods }: { periods: FiscalPeriod[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    isFiscalYear: true,
    fiscalYearId: "",
  });

  const fiscalYears = periods.filter((p) => p.isFiscalYear);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createFiscalPeriodAction({
        name: form.name,
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        isFiscalYear: form.isFiscalYear,
        fiscalYearId: form.isFiscalYear ? null : form.fiscalYearId || null,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Fiscal period created");
      setShowModal(false);
      setForm({ name: "", startDate: "", endDate: "", isFiscalYear: true, fiscalYearId: "" });
      router.refresh();
    });
  }

  function handleSetStatus(periodId: string, status: "OPEN" | "SOFT_CLOSED" | "CLOSED") {
    startTransition(async () => {
      const result = await setFiscalPeriodStatusAction(periodId, status);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Period status set to ${status}`);
      router.refresh();
    });
  }

  function handleYearEndClose(periodId: string) {
    startTransition(async () => {
      const result = await closeFiscalYearAction(periodId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Year closed: surplus GHS ${result.data.netResult.toFixed(2)} transferred to Accumulated Surplus`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fiscal Periods"
        description="Manage fiscal years, sub-periods, and year-end closing entries"
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Period
          </button>
        }
      />

      {periods.length === 0 ? (
        <EmptyState
          title="No fiscal periods"
          description="Create your first fiscal year to enable period-based posting, IPSAS reports, and year-end close."
        />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-xs">{p.isFiscalYear ? "Fiscal Year" : "Sub-period"}</td>
                  <td className="px-4 py-3 text-sm">{new Date(p.startDate).toLocaleDateString("en-GH")}</td>
                  <td className="px-4 py-3 text-sm">{new Date(p.endDate).toLocaleDateString("en-GH")}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status]}`}>
                      {p.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {p.status === "OPEN" && (
                        <button
                          disabled={isPending}
                          onClick={() => handleSetStatus(p.id, "SOFT_CLOSED")}
                          className="text-amber-600 hover:underline"
                        >
                          Soft-close
                        </button>
                      )}
                      {p.status === "SOFT_CLOSED" && (
                        <button
                          disabled={isPending}
                          onClick={() => handleSetStatus(p.id, "OPEN")}
                          className="text-green-600 hover:underline"
                        >
                          Reopen
                        </button>
                      )}
                      {p.isFiscalYear && p.status !== "CLOSED" && (
                        <ConfirmDialog
                          title="Close Fiscal Year"
                          description={`Close ${p.name}? This posts closing entries that zero out Revenue and Expense accounts into Accumulated Surplus. Cannot be undone without an adjusting reopen.`}
                          onConfirm={() => handleYearEndClose(p.id)}
                          variant="destructive"
                          trigger={
                            <button disabled={isPending} className="text-red-600 hover:underline">
                              Year-end close
                            </button>
                          }
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create Fiscal Period</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground text-xl">
                &times;
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="FY 2026 or FY 2026 Q1"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End *</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isFiscalYear}
                  onChange={(e) => setForm({ ...form, isFiscalYear: e.target.checked })}
                />
                Top-level Fiscal Year (eligible for year-end close)
              </label>
              {!form.isFiscalYear && (
                <div>
                  <label className="block text-sm font-medium mb-1">Parent Fiscal Year</label>
                  <select
                    value={form.fiscalYearId}
                    onChange={(e) => setForm({ ...form, fiscalYearId: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">None</option>
                    {fiscalYears.map((fy) => (
                      <option key={fy.id} value={fy.id}>
                        {fy.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
