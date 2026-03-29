"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  recordPaymentAction,
  getPaymentsAction,
  initiateReversalAction,
} from "@/modules/finance/actions/payment.action";
import {
  getBillsAction,
} from "@/modules/finance/actions/billing.action";
import {
  Filter,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
} from "lucide-react";

interface Term {
  id: string;
  name: string;
  isCurrent: boolean;
  academicYear: { id: string; name: string };
}

interface PaymentRecord {
  id: string;
  studentId: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string | null;
  receivedBy: string;
  receivedAt: string | Date;
  status: string;
  notes: string | null;
  studentName: string;
  studentIdNumber: string;
  receivedByName: string;
  receiptNumber: string | null;
  receipt?: { id: string; receiptNumber: string } | null;
  reversal?: { id: string; status: string } | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function formatCurrency(amount: number): string {
  return `GHS ${amount.toFixed(2)}`;
}

const methodColors: Record<string, string> = {
  CASH: "bg-emerald-50 text-emerald-700",
  BANK_TRANSFER: "bg-blue-50 text-blue-700",
  MOBILE_MONEY: "bg-purple-50 text-purple-700",
  CHEQUE: "bg-orange-50 text-orange-700",
  OTHER: "bg-gray-100 text-gray-600",
};

const methodLabels: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  MOBILE_MONEY: "Mobile Money",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

interface BillSearchResult {
  id: string;
  studentName: string;
  studentIdNumber: string;
  className: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
}

export function PaymentsClient({
  initialPayments,
  initialPagination,
  terms,
}: {
  initialPayments: PaymentRecord[];
  initialPagination: Pagination;
  terms: Term[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);

  // Filters
  const [filterTermId, setFilterTermId] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");

  // Record Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<BillSearchResult[]>([]);
  const [selectedBill, setSelectedBill] = useState<BillSearchResult | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "CASH" as string,
    referenceNumber: "",
    notes: "",
  });

  // Reversal
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [reversalPaymentId, setReversalPaymentId] = useState("");
  const [reversalReason, setReversalReason] = useState("");

  function handleOpenPaymentModal() {
    setSelectedBill(null);
    setStudentSearch("");
    setSearchResults([]);
    setPaymentForm({ amount: "", paymentMethod: "CASH", referenceNumber: "", notes: "" });
    setShowPaymentModal(true);
  }

  function handleSearchStudent() {
    if (!studentSearch.trim()) return;

    startTransition(async () => {
      setSearchingStudent(true);
      const result = await getBillsAction({ page: 1, pageSize: 10 });
      if (result.error) {
        toast.error(result.error);
        setSearchingStudent(false);
        return;
      }

      const bills = result.data ?? [];
      const q = studentSearch.toLowerCase();
      const matched = bills.filter(
        (b) =>
          b.studentName.toLowerCase().includes(q) ||
          b.studentIdNumber.toLowerCase().includes(q)
      );

      setSearchResults(
        matched.map((b) => ({
          id: b.id,
          studentName: b.studentName,
          studentIdNumber: b.studentIdNumber,
          className: b.className,
          totalAmount: b.totalAmount,
          paidAmount: b.paidAmount,
          balanceAmount: b.balanceAmount,
          status: b.status,
        }))
      );
      setSearchingStudent(false);
    });
  }

  function handleSelectBill(bill: BillSearchResult) {
    setSelectedBill(bill);
    setPaymentForm((prev) => ({
      ...prev,
      amount: bill.balanceAmount > 0 ? bill.balanceAmount.toFixed(2) : "",
    }));
  }

  function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBill) {
      toast.error("Please select a student bill");
      return;
    }

    startTransition(async () => {
      const result = await recordPaymentAction({
        studentBillId: selectedBill.id,
        amount: parseFloat(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod as "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "CHEQUE" | "OTHER",
        referenceNumber: paymentForm.referenceNumber || undefined,
        notes: paymentForm.notes || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `Payment recorded. Receipt: ${result.data?.receipt?.receiptNumber ?? "N/A"}`
      );
      setShowPaymentModal(false);
      router.refresh();
    });
  }

  function handleInitiateReversal(paymentId: string) {
    setReversalPaymentId(paymentId);
    setReversalReason("");
    setShowReversalModal(true);
  }

  function handleSubmitReversal(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await initiateReversalAction({
        paymentId: reversalPaymentId,
        reason: reversalReason,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Reversal request submitted");
      setShowReversalModal(false);
      router.refresh();
    });
  }

  function handleFilterChange(termId: string, method: string) {
    startTransition(async () => {
      const filters: Record<string, unknown> = { page: 1, pageSize: 25 };
      if (termId !== "all") filters.termId = termId;
      if (method !== "all") filters.paymentMethod = method;

      const result = await getPaymentsAction(
        filters as Parameters<typeof getPaymentsAction>[0]
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setPayments(result.data ?? []);
      setPagination(
        result.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 }
      );
    });
  }

  function handlePageChange(page: number) {
    startTransition(async () => {
      const filters: Record<string, unknown> = { page, pageSize: 25 };
      if (filterTermId !== "all") filters.termId = filterTermId;
      if (filterMethod !== "all") filters.paymentMethod = filterMethod;

      const result = await getPaymentsAction(
        filters as Parameters<typeof getPaymentsAction>[0]
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setPayments(result.data ?? []);
      setPagination(
        result.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 }
      );
    });
  }

  const filterSelectClass =
    "h-9 rounded-lg border border-input bg-background px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Record and manage student fee payments."
        actions={
          <button
            onClick={handleOpenPaymentModal}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Record Payment
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={filterTermId}
          onChange={(e) => {
            setFilterTermId(e.target.value);
            handleFilterChange(e.target.value, filterMethod);
          }}
          className={filterSelectClass}
        >
          <option value="all">All Terms</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.academicYear.name})
            </option>
          ))}
        </select>
        <select
          value={filterMethod}
          onChange={(e) => {
            setFilterMethod(e.target.value);
            handleFilterChange(filterTermId, e.target.value);
          }}
          className={filterSelectClass}
        >
          <option value="all">All Methods</option>
          <option value="CASH">Cash</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="MOBILE_MONEY">Mobile Money</option>
          <option value="CHEQUE">Cheque</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {/* Payments Table */}
      {payments.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-6 w-6" />}
          title="No payments found"
          description="Record payments to track student fee collections."
          action={
            <button
              onClick={handleOpenPaymentModal}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Record Payment
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receipt #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Student</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Received By</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {payment.receiptNumber ?? "---"}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium">{payment.studentName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {payment.studentIdNumber}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          methodColors[payment.paymentMethod] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {methodLabels[payment.paymentMethod] ?? payment.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {payment.referenceNumber ?? "---"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {payment.receivedByName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(payment.receivedAt), "dd MMM yyyy HH:mm")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {payment.receiptNumber && (
                          <a
                            href={`/finance/receipts?receipt=${payment.receiptNumber}`}
                            className="text-xs font-medium text-primary hover:text-primary/80"
                          >
                            Receipt
                          </a>
                        )}
                        {payment.status === "CONFIRMED" && (
                          <button
                            onClick={() => handleInitiateReversal(payment.id)}
                            className="text-xs font-medium text-destructive hover:text-destructive/80"
                          >
                            Reverse
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
                {pagination.total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page <= 1 || isPending}
                  className="rounded-md p-1.5 transition-colors hover:bg-accent disabled:opacity-30"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || isPending}
                  className="rounded-md p-1.5 transition-colors hover:bg-accent disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-xs text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || isPending}
                  className="rounded-md p-1.5 transition-colors hover:bg-accent disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={pagination.page >= pagination.totalPages || isPending}
                  className="rounded-md p-1.5 transition-colors hover:bg-accent disabled:opacity-30"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Record Payment</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Student Search */}
            {!selectedBill ? (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Search Student (by name or ID)
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Enter student name or ID..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearchStudent()}
                        className={`${inputClass} pl-9`}
                      />
                    </div>
                    <button
                      onClick={handleSearchStudent}
                      disabled={isPending || searchingStudent}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {searchingStudent ? "..." : "Search"}
                    </button>
                  </div>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Select a bill to make payment for:
                    </p>
                    {searchResults.map((bill) => (
                      <button
                        key={bill.id}
                        onClick={() => handleSelectBill(bill)}
                        className="w-full rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/30"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{bill.studentName}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {bill.studentIdNumber}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {bill.className}
                            </span>
                          </div>
                          <StatusBadge status={bill.status} />
                        </div>
                        <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground tabular-nums">
                          <span>Total: {formatCurrency(bill.totalAmount)}</span>
                          <span>Paid: {formatCurrency(bill.paidAmount)}</span>
                          <span className="font-medium text-foreground">
                            Balance: {formatCurrency(bill.balanceAmount)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleRecordPayment} className="mt-5 space-y-4">
                {/* Selected Bill Summary */}
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{selectedBill.studentName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {selectedBill.studentIdNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedBill(null)}
                      className="text-xs font-medium text-primary hover:text-primary/80"
                    >
                      Change
                    </button>
                  </div>
                  <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground tabular-nums">
                    <span>Total: {formatCurrency(selectedBill.totalAmount)}</span>
                    <span>Paid: {formatCurrency(selectedBill.paidAmount)}</span>
                    <span className="font-medium text-foreground">
                      Balance: {formatCurrency(selectedBill.balanceAmount)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Amount (GHS) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Payment Method <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        paymentMethod: e.target.value,
                      }))
                    }
                    className={inputClass}
                    required
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                {paymentForm.paymentMethod !== "CASH" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Reference Number <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Transaction reference"
                      value={paymentForm.referenceNumber}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          referenceNumber: e.target.value,
                        }))
                      }
                      className={inputClass}
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Notes (optional)
                  </label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    className={inputClass}
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-accent"
                    disabled={isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending ? "Processing..." : "Record Payment"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Reversal Modal */}
      {showReversalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Reverse Payment</h3>
              <button
                onClick={() => setShowReversalModal(false)}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              This will submit a reversal request that needs to be approved.
            </p>
            <form onSubmit={handleSubmitReversal} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Reason for Reversal <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Explain why this payment needs to be reversed..."
                  className={inputClass}
                  rows={3}
                  required
                />
              </div>
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowReversalModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-accent"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
                >
                  {isPending ? "Submitting..." : "Submit Reversal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
