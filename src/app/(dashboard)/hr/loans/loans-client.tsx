"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  getLoansAction,
  createLoanAction,
  approveLoanAction,
  cancelLoanAction,
} from "@/modules/hr/actions/loan.action";

// ─── Types ──────────────────────────────────────────────────────────

interface LoanRow {
  id: string;
  loanNumber: string;
  type: string;
  amount: unknown;
  interestRate: unknown;
  totalRepayment: unknown;
  monthlyDeduction: unknown;
  tenure: number;
  remainingBalance: unknown;
  status: string;
  approvedAt: Date | string | null;
  staff: {
    firstName: string;
    lastName: string;
    staffId: string;
  };
}

interface StaffOption {
  id: string;
  staffId: string;
  name: string;
}

const LOAN_TYPES = ["SALARY_ADVANCE", "PERSONAL_LOAN", "EMERGENCY_LOAN"] as const;
const LOAN_STATUSES = ["PENDING", "APPROVED", "ACTIVE", "FULLY_PAID", "CANCELLED"] as const;

// ─── Component ──────────────────────────────────────────────────────

export function LoansClient({
  initialLoans,
  initialTotal,
  initialPage,
  initialPageSize,
  staffOptions,
}: {
  initialLoans: LoanRow[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  staffOptions: StaffOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [loans, setLoans] = useState<LoanRow[]>(initialLoans);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);
  const [filterStatus, setFilterStatus] = useState("");

  // New loan form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    staffId: "",
    type: "" as string,
    amount: "",
    interestRate: "0",
    tenure: "",
  });

  const totalPages = Math.ceil(total / pageSize);

  // Calculated preview values
  const previewAmount = parseFloat(form.amount) || 0;
  const previewRate = parseFloat(form.interestRate) || 0;
  const previewTenure = parseInt(form.tenure) || 0;
  const previewTotal = previewAmount * (1 + previewRate / 100);
  const previewMonthly = previewTenure > 0 ? previewTotal / previewTenure : 0;

  function fetchLoans(newPage: number) {
    startTransition(async () => {
      const result = await getLoansAction({
        status: filterStatus || undefined,
        page: newPage,
        pageSize,
      });
      if ("data" in result) {
        setLoans(result.data as LoanRow[]);
        setTotal("total" in result ? result.total ?? 0 : 0);
        setPage("page" in result ? result.page ?? 1 : 1);
      }
    });
  }

  function handleCreate() {
    if (!form.staffId || !form.type || !form.amount || !form.tenure) {
      toast.error("Please fill in all required fields.");
      return;
    }

    startTransition(async () => {
      const result = await createLoanAction({
        staffId: form.staffId,
        type: form.type as (typeof LOAN_TYPES)[number],
        amount: parseFloat(form.amount),
        interestRate: parseFloat(form.interestRate) || 0,
        tenure: parseInt(form.tenure),
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Loan application created successfully.");
        setShowForm(false);
        setForm({ staffId: "", type: "", amount: "", interestRate: "0", tenure: "" });
        router.refresh();
      }
    });
  }

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveLoanAction(id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Loan approved.");
        router.refresh();
      }
    });
  }

  function handleCancel(id: string) {
    if (!confirm("Are you sure you want to cancel this loan application?")) return;

    startTransition(async () => {
      const result = await cancelLoanAction(id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Loan cancelled.");
        router.refresh();
      }
    });
  }

  function num(val: unknown): number {
    if (val === null || val === undefined) return 0;
    return Number(val);
  }

  function formatCurrency(val: unknown): string {
    return num(val).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <div className="space-y-6">
      {/* ─── Filters & Actions ────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          >
            <option value="">All Statuses</option>
            {LOAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button
            onClick={() => fetchLoans(1)}
            disabled={isPending}
            className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            Apply
          </button>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New Loan
        </button>
      </div>

      {/* ─── Loans Table ──────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Staff Name</th>
                <th className="px-4 py-3 text-left font-medium">Loan #</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Monthly Deduction</th>
                <th className="px-4 py-3 text-right font-medium">Remaining</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No loans found.
                  </td>
                </tr>
              ) : (
                loans.map((loan) => (
                  <tr key={loan.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {loan.staff.firstName} {loan.staff.lastName}
                      <span className="text-xs text-muted-foreground ml-1">({loan.staff.staffId})</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{loan.loanNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{loan.type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(loan.amount)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(loan.monthlyDeduction)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(loan.remainingBalance)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={loan.status} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {loan.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => handleApprove(loan.id)}
                            disabled={isPending}
                            className="text-xs text-green-600 hover:text-green-800 font-medium mr-2"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleCancel(loan.id)}
                            disabled={isPending}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Pagination ───────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLoans(page - 1)}
              disabled={page <= 1 || isPending}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
            >
              Previous
            </button>
            <button
              onClick={() => fetchLoans(page + 1)}
              disabled={page >= totalPages || isPending}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ─── New Loan Modal ───────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">New Loan Application</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Staff Member</label>
                <select
                  value={form.staffId}
                  onChange={(e) => setForm((p) => ({ ...p, staffId: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select staff</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.staffId})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Loan Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select type</option>
                  {LOAN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 grid-cols-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="0.00"
                    min={0}
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Interest Rate (%)</label>
                  <input
                    type="number"
                    value={form.interestRate}
                    onChange={(e) => setForm((p) => ({ ...p, interestRate: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    min={0}
                    max={100}
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tenure (months)</label>
                  <input
                    type="number"
                    value={form.tenure}
                    onChange={(e) => setForm((p) => ({ ...p, tenure: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="12"
                    min={1}
                  />
                </div>
              </div>

              {/* Repayment Preview */}
              {previewAmount > 0 && previewTenure > 0 && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <p className="font-medium mb-2">Repayment Preview</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Total Repayment:</span>{" "}
                      <span className="font-medium">
                        {previewTotal.toLocaleString("en-GH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Monthly Deduction:</span>{" "}
                      <span className="font-medium">
                        {previewMonthly.toLocaleString("en-GH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Interest:</span>{" "}
                      <span className="font-medium">
                        {(previewTotal - previewAmount).toLocaleString("en-GH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>{" "}
                      <span className="font-medium">{previewTenure} months</span>
                    </div>
                  </div>
                </div>
              )}
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
                {isPending ? "Submitting..." : "Submit Loan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
