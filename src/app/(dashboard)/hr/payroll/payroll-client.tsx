"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  createPayrollPeriodAction,
  generatePayrollAction,
  approvePayrollAction,
  getPayrollEntriesAction,
  createAllowanceAction,
  deleteAllowanceAction,
  createDeductionAction,
  deleteDeductionAction,
} from "@/modules/hr/actions/payroll.action";

// ─── Types ──────────────────────────────────────────────────────────

interface PayrollPeriod {
  id: string;
  month: number;
  year: number;
  status: string;
  entriesCount: number;
  totalNetPay: number;
  createdAt: Date;
}

interface PayrollEntry {
  id: string;
  staffId: string;
  staffName: string;
  staffStaffId: string;
  basicSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  netPay: number;
  details: {
    allowances: { name: string; amount: number }[];
    deductions: { name: string; amount: number }[];
  } | null;
}

interface AllowanceRow {
  id: string;
  name: string;
  type: string;
  amount: number;
  status: string;
}

interface DeductionRow {
  id: string;
  name: string;
  type: string;
  amount: number;
  isStatutory: boolean;
  status: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ─── Component ──────────────────────────────────────────────────────

export function PayrollClient({
  initialPeriods,
  initialAllowances,
  initialDeductions,
}: {
  initialPeriods: PayrollPeriod[];
  initialAllowances: AllowanceRow[];
  initialDeductions: DeductionRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState(0);
  const [periods] = useState<PayrollPeriod[]>(initialPeriods);
  const [allowances] = useState<AllowanceRow[]>(initialAllowances);
  const [deductions] = useState<DeductionRow[]>(initialDeductions);

  // Create period form
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const currentDate = new Date();
  const [periodForm, setPeriodForm] = useState({
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
  });

  // Allowance form
  const [showAllowanceForm, setShowAllowanceForm] = useState(false);
  const [allowanceForm, setAllowanceForm] = useState({
    name: "",
    type: "FIXED" as "FIXED" | "PERCENTAGE",
    amount: 0,
  });

  // Deduction form
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [deductionForm, setDeductionForm] = useState({
    name: "",
    type: "FIXED" as "FIXED" | "PERCENTAGE",
    amount: 0,
    isStatutory: false,
  });

  // Expanded period entries
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [periodEntries, setPeriodEntries] = useState<PayrollEntry[]>([]);

  // ─── Period actions ───────────────────────────────────────────────

  function handleCreatePeriod() {
    startTransition(async () => {
      const result = await createPayrollPeriodAction({
        month: periodForm.month,
        year: periodForm.year,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Payroll period ${MONTHS[periodForm.month - 1]} ${periodForm.year} created.`);
        setShowPeriodForm(false);
        router.refresh();
      }
    });
  }

  function handleGeneratePayroll(periodId: string) {
    startTransition(async () => {
      const result = await generatePayrollAction(periodId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `Payroll generated for ${result.generated} staff members.${
            result.errors && result.errors.length > 0
              ? ` ${result.errors.length} errors.`
              : ""
          }`,
        );
        router.refresh();
      }
    });
  }

  function handleApprovePayroll(periodId: string) {
    if (!confirm("Are you sure you want to approve this payroll? This action cannot be undone."))
      return;

    startTransition(async () => {
      const result = await approvePayrollAction(periodId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Payroll approved.");
        router.refresh();
      }
    });
  }

  function handleToggleEntries(periodId: string) {
    if (expandedPeriod === periodId) {
      setExpandedPeriod(null);
      setPeriodEntries([]);
      return;
    }

    startTransition(async () => {
      const result = await getPayrollEntriesAction(periodId);
      if (result.data) {
        setPeriodEntries(result.data);
        setExpandedPeriod(periodId);
      }
    });
  }

  // ─── Allowance actions ────────────────────────────────────────────

  function handleCreateAllowance() {
    if (!allowanceForm.name.trim()) {
      toast.error("Name is required.");
      return;
    }

    startTransition(async () => {
      const result = await createAllowanceAction({
        name: allowanceForm.name,
        type: allowanceForm.type,
        amount: allowanceForm.amount,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Allowance created.");
        setShowAllowanceForm(false);
        setAllowanceForm({ name: "", type: "FIXED", amount: 0 });
        router.refresh();
      }
    });
  }

  function handleDeleteAllowance(id: string, name: string) {
    if (!confirm(`Delete allowance "${name}"?`)) return;

    startTransition(async () => {
      const result = await deleteAllowanceAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Allowance deleted.");
        router.refresh();
      }
    });
  }

  // ─── Deduction actions ────────────────────────────────────────────

  function handleCreateDeduction() {
    if (!deductionForm.name.trim()) {
      toast.error("Name is required.");
      return;
    }

    startTransition(async () => {
      const result = await createDeductionAction({
        name: deductionForm.name,
        type: deductionForm.type,
        amount: deductionForm.amount,
        isStatutory: deductionForm.isStatutory,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Deduction created.");
        setShowDeductionForm(false);
        setDeductionForm({ name: "", type: "FIXED", amount: 0, isStatutory: false });
        router.refresh();
      }
    });
  }

  function handleDeleteDeduction(id: string, name: string) {
    if (!confirm(`Delete deduction "${name}"?`)) return;

    startTransition(async () => {
      const result = await deleteDeductionAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Deduction deleted.");
        router.refresh();
      }
    });
  }

  function formatCurrency(amount: number) {
    return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab(0)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 0
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Payroll Periods
        </button>
        <button
          type="button"
          onClick={() => setActiveTab(1)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 1
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Configuration
        </button>
      </div>

      {/* ─── Payroll Periods Tab ──────────────────────────────────── */}
      {activeTab === 0 && (
        <div>
          <div className="flex items-center justify-end mb-4">
            <button
              onClick={() => setShowPeriodForm(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create Period
            </button>
          </div>

          <div className="space-y-4">
            {periods.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                No payroll periods created yet.
              </div>
            ) : (
              periods.map((period) => (
                <div
                  key={period.id}
                  className="rounded-lg border border-border bg-card overflow-hidden"
                >
                  {/* Period Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleEntries(period.id)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {expandedPeriod === period.id ? "[-]" : "[+]"}
                      </button>
                      <div>
                        <span className="font-semibold">
                          {MONTHS[period.month - 1]} {period.year}
                        </span>
                        <span className="ml-3 text-xs text-muted-foreground">
                          {period.entriesCount} entries
                        </span>
                      </div>
                      <StatusBadge status={period.status} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">
                        {formatCurrency(period.totalNetPay)}
                      </span>
                      {period.status === "DRAFT" && (
                        <>
                          <button
                            onClick={() => handleGeneratePayroll(period.id)}
                            disabled={isPending}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {isPending ? "Generating..." : "Generate Payroll"}
                          </button>
                          {period.entriesCount > 0 && (
                            <button
                              onClick={() => handleApprovePayroll(period.id)}
                              disabled={isPending}
                              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Entries */}
                  {expandedPeriod === period.id && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="px-4 py-2 text-left font-medium">Staff ID</th>
                            <th className="px-4 py-2 text-left font-medium">Name</th>
                            <th className="px-4 py-2 text-right font-medium">Basic Salary</th>
                            <th className="px-4 py-2 text-right font-medium">Allowances</th>
                            <th className="px-4 py-2 text-right font-medium">Deductions</th>
                            <th className="px-4 py-2 text-right font-medium">Net Pay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {periodEntries.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="px-4 py-6 text-center text-muted-foreground"
                              >
                                {isPending
                                  ? "Loading entries..."
                                  : "No payroll entries. Click 'Generate Payroll' to create entries."}
                              </td>
                            </tr>
                          ) : (
                            periodEntries.map((entry) => (
                              <tr
                                key={entry.id}
                                className="border-b border-border last:border-0"
                              >
                                <td className="px-4 py-2 font-mono text-xs">
                                  {entry.staffStaffId}
                                </td>
                                <td className="px-4 py-2 font-medium">{entry.staffName}</td>
                                <td className="px-4 py-2 text-right text-muted-foreground">
                                  {formatCurrency(entry.basicSalary)}
                                </td>
                                <td className="px-4 py-2 text-right text-green-600">
                                  +{formatCurrency(entry.totalAllowances)}
                                </td>
                                <td className="px-4 py-2 text-right text-red-600">
                                  -{formatCurrency(entry.totalDeductions)}
                                </td>
                                <td className="px-4 py-2 text-right font-semibold">
                                  {formatCurrency(entry.netPay)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── Configuration Tab ────────────────────────────────────── */}
      {activeTab === 1 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Allowances */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Allowances</h3>
              <button
                onClick={() => setShowAllowanceForm(true)}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Add Allowance
              </button>
            </div>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Name</th>
                    <th className="px-4 py-2 text-center font-medium">Type</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allowances.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                        No allowances configured.
                      </td>
                    </tr>
                  ) : (
                    allowances.map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-medium">{a.name}</td>
                        <td className="px-4 py-2 text-center">
                          <StatusBadge
                            status={a.type}
                            className={
                              a.type === "FIXED"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            }
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          {a.type === "PERCENTAGE" ? `${a.amount}%` : formatCurrency(a.amount)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => handleDeleteAllowance(a.id, a.name)}
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

          {/* Deductions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Deductions</h3>
              <button
                onClick={() => setShowDeductionForm(true)}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Add Deduction
              </button>
            </div>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Name</th>
                    <th className="px-4 py-2 text-center font-medium">Type</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    <th className="px-4 py-2 text-center font-medium">Statutory</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deductions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        No deductions configured.
                      </td>
                    </tr>
                  ) : (
                    deductions.map((d) => (
                      <tr key={d.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-medium">{d.name}</td>
                        <td className="px-4 py-2 text-center">
                          <StatusBadge
                            status={d.type}
                            className={
                              d.type === "FIXED"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            }
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          {d.type === "PERCENTAGE" ? `${d.amount}%` : formatCurrency(d.amount)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {d.isStatutory ? (
                            <span className="text-xs text-green-600 font-medium">Yes</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => handleDeleteDeduction(d.id, d.name)}
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
        </div>
      )}

      {/* ─── Create Period Modal ──────────────────────────────────── */}
      {showPeriodForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Create Payroll Period</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Month</label>
                <select
                  value={periodForm.month}
                  onChange={(e) =>
                    setPeriodForm((p) => ({ ...p, month: parseInt(e.target.value) }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Year</label>
                <input
                  type="number"
                  value={periodForm.year}
                  onChange={(e) =>
                    setPeriodForm((p) => ({ ...p, year: parseInt(e.target.value) || 2024 }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  min={2020}
                  max={2100}
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPeriodForm(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePeriod}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Allowance Form Modal ─────────────────────────────────── */}
      {showAllowanceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Add Allowance</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={allowanceForm.name}
                  onChange={(e) =>
                    setAllowanceForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Transport Allowance"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={allowanceForm.type}
                  onChange={(e) =>
                    setAllowanceForm((p) => ({
                      ...p,
                      type: e.target.value as "FIXED" | "PERCENTAGE",
                    }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="FIXED">Fixed Amount (GHS)</option>
                  <option value="PERCENTAGE">Percentage of Basic (%)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {allowanceForm.type === "PERCENTAGE" ? "Percentage (%)" : "Amount (GHS)"}
                </label>
                <input
                  type="number"
                  value={allowanceForm.amount}
                  onChange={(e) =>
                    setAllowanceForm((p) => ({
                      ...p,
                      amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  min={0}
                  step={allowanceForm.type === "PERCENTAGE" ? 0.1 : 1}
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAllowanceForm(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAllowance}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Deduction Form Modal ─────────────────────────────────── */}
      {showDeductionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Add Deduction</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={deductionForm.name}
                  onChange={(e) =>
                    setDeductionForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. SSNIT Contribution"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={deductionForm.type}
                  onChange={(e) =>
                    setDeductionForm((p) => ({
                      ...p,
                      type: e.target.value as "FIXED" | "PERCENTAGE",
                    }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="FIXED">Fixed Amount (GHS)</option>
                  <option value="PERCENTAGE">Percentage of Basic (%)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {deductionForm.type === "PERCENTAGE" ? "Percentage (%)" : "Amount (GHS)"}
                </label>
                <input
                  type="number"
                  value={deductionForm.amount}
                  onChange={(e) =>
                    setDeductionForm((p) => ({
                      ...p,
                      amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  min={0}
                  step={deductionForm.type === "PERCENTAGE" ? 0.1 : 1}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={deductionForm.isStatutory}
                  onChange={(e) =>
                    setDeductionForm((p) => ({ ...p, isStatutory: e.target.checked }))
                  }
                  className="rounded accent-primary h-4 w-4"
                  id="isStatutory"
                />
                <label htmlFor="isStatutory" className="text-sm">
                  Statutory Deduction
                </label>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDeductionForm(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDeduction}
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
