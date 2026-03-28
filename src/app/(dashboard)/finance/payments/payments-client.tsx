"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  recordPaymentAction,
  getPaymentsAction,
  initiateReversalAction,
} from "@/modules/finance/actions/payment.action";
import {
  getBillsAction,
  getStudentBillAction,
} from "@/modules/finance/actions/billing.action";

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
  CASH: "bg-green-100 text-green-700",
  BANK_TRANSFER: "bg-blue-100 text-blue-700",
  MOBILE_MONEY: "bg-purple-100 text-purple-700",
  CHEQUE: "bg-orange-100 text-orange-700",
  OTHER: "bg-gray-100 text-gray-700",
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
      // Search bills to find students with outstanding balances
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Record and manage student fee payments."
        actions={
          <button
            onClick={handleOpenPaymentModal}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Record Payment
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Term:</label>
          <select
            value={filterTermId}
            onChange={(e) => {
              setFilterTermId(e.target.value);
              handleFilterChange(e.target.value, filterMethod);
            }}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Terms</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.academicYear.name})
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Method:</label>
          <select
            value={filterMethod}
            onChange={(e) => {
              setFilterMethod(e.target.value);
              handleFilterChange(filterTermId, e.target.value);
            }}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Methods</option>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      {payments.length === 0 ? (
        <EmptyState
          title="No payments found"
          description="Record payments to track student fee collections."
          action={
            <button
              onClick={handleOpenPaymentModal}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Record Payment
            </button>
          }
        />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Receipt #</th>
                  <th className="px-4 py-3 text-left font-medium">Student</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-center font-medium">Method</th>
                  <th className="px-4 py-3 text-left font-medium">Reference</th>
                  <th className="px-4 py-3 text-left font-medium">Received By</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {payment.receiptNumber ?? "---"}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium">{payment.studentName}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {payment.studentIdNumber}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          methodColors[payment.paymentMethod] ?? "bg-gray-100 text-gray-700"
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
                      {payment.status === "CONFIRMED" ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-medium">
                          Confirmed
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-medium">
                          Reversed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {payment.receiptNumber && (
                          <a
                            href={`/finance/receipts?receipt=${payment.receiptNumber}`}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Receipt
                          </a>
                        )}
                        {payment.status === "CONFIRMED" && (
                          <button
                            onClick={() => handleInitiateReversal(payment.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
                {pagination.total} payments
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || isPending}
                  className="rounded-md border border-border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || isPending}
                  className="rounded-md border border-border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Record Payment</h3>

            {/* Student Search */}
            {!selectedBill ? (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Search Student (by name or ID)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter student name or ID..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearchStudent()}
                      className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={handleSearchStudent}
                      disabled={isPending || searchingStudent}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {searchingStudent ? "Searching..." : "Search"}
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
                        className="w-full text-left rounded-md border border-border p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{bill.studentName}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {bill.studentIdNumber}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {bill.className}
                            </span>
                          </div>
                          <span
                            className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                              bill.status === "PAID"
                                ? "bg-green-100 text-green-700"
                                : bill.status === "PARTIAL"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {bill.status}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Total: {formatCurrency(bill.totalAmount)} | Paid:{" "}
                          {formatCurrency(bill.paidAmount)} | Balance:{" "}
                          {formatCurrency(bill.balanceAmount)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRecordPayment} className="mt-4 space-y-4">
                {/* Selected Bill Summary */}
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{selectedBill.studentName}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {selectedBill.studentIdNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedBill(null)}
                      className="text-xs text-primary hover:text-primary/80"
                    >
                      Change
                    </button>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Total: {formatCurrency(selectedBill.totalAmount)} | Paid:{" "}
                    {formatCurrency(selectedBill.paidAmount)} | Balance:{" "}
                    {formatCurrency(selectedBill.balanceAmount)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Amount (GHS)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Payment Method
                  </label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        paymentMethod: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                    <label className="block text-sm font-medium text-foreground">
                      Reference Number
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
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Notes (optional)
                  </label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                    disabled={isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Reverse Payment</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This will submit a reversal request that needs to be approved.
            </p>
            <form onSubmit={handleSubmitReversal} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Reason for Reversal
                </label>
                <textarea
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Explain why this payment needs to be reversed..."
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowReversalModal(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
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
