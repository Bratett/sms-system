"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { getPaymentAction } from "@/modules/finance/actions/payment.action";

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
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ReceiptDetail {
  id: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string | null;
  receivedAt: string | Date;
  status: string;
  notes: string | null;
  studentName: string;
  studentIdNumber: string;
  receivedByName: string;
  receipt?: {
    id: string;
    receiptNumber: string;
    generatedAt: string | Date;
  } | null;
  studentBill?: {
    id: string;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    billItems?: Array<{
      id: string;
      amount: number;
      feeItem: {
        id: string;
        name: string;
        code: string | null;
      };
    }>;
    feeStructure?: {
      id: string;
      name: string;
    } | null;
  };
}

function formatCurrency(amount: number): string {
  return `GHS ${amount.toFixed(2)}`;
}

const methodLabels: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  MOBILE_MONEY: "Mobile Money",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

const methodColors: Record<string, string> = {
  CASH: "bg-green-100 text-green-700",
  BANK_TRANSFER: "bg-blue-100 text-blue-700",
  MOBILE_MONEY: "bg-purple-100 text-purple-700",
  CHEQUE: "bg-orange-100 text-orange-700",
  OTHER: "bg-gray-100 text-gray-700",
};

export function ReceiptsClient({
  initialPayments,
  initialPagination,
}: {
  initialPayments: PaymentRecord[];
  initialPagination: Pagination;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptDetail | null>(null);

  // Filter payments that have receipts
  const receipts = useMemo(() => {
    return initialPayments.filter((p) => p.receiptNumber);
  }, [initialPayments]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return receipts;
    const q = searchQuery.toLowerCase();
    return receipts.filter(
      (r) =>
        (r.receiptNumber ?? "").toLowerCase().includes(q) ||
        r.studentName.toLowerCase().includes(q) ||
        r.studentIdNumber.toLowerCase().includes(q)
    );
  }, [receipts, searchQuery]);

  function handleViewReceipt(payment: PaymentRecord) {
    startTransition(async () => {
      const result = await getPaymentAction(payment.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSelectedReceipt(result.data as ReceiptDetail);
    });
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Hide non-receipt content when printing */}
      <div className="print:hidden">
        <PageHeader
          title="Receipts"
          description="Search and view payment receipts."
        />

        {/* Search */}
        <div className="mt-4 flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Search:</label>
          <input
            type="text"
            placeholder="Receipt number or student name/ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary w-96"
          />
        </div>
      </div>

      {/* Receipt List - hide when viewing a receipt for print */}
      {!selectedReceipt && (
        <div className="print:hidden">
          {filtered.length === 0 ? (
            <EmptyState
              title="No receipts found"
              description={
                searchQuery
                  ? "No receipts match your search criteria."
                  : "No payment receipts have been generated yet."
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
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium">
                          {payment.receiptNumber}
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
                          {format(new Date(payment.receivedAt), "dd MMM yyyy")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleViewReceipt(payment)}
                            disabled={isPending}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                          >
                            View Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Printable Receipt View */}
      {selectedReceipt && (
        <div>
          <div className="print:hidden mb-4 flex items-center gap-3">
            <button
              onClick={() => setSelectedReceipt(null)}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              Back to List
            </button>
            <button
              onClick={handlePrint}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Print Receipt
            </button>
          </div>

          {/* Receipt - printable area */}
          <div className="max-w-2xl mx-auto bg-white border border-border rounded-lg p-8 print:border-0 print:shadow-none print:p-0 print:max-w-none">
            {/* School Header */}
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
              <h1 className="text-xl font-bold uppercase tracking-wide">
                School Name
              </h1>
              <p className="text-sm text-gray-600">School Address</p>
              <p className="text-xs text-gray-500 italic">School Motto</p>
            </div>

            {/* Receipt Title */}
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold uppercase border-2 border-gray-800 inline-block px-6 py-1">
                OFFICIAL RECEIPT
              </h2>
            </div>

            {/* Receipt Info */}
            <div className="flex justify-between mb-6 text-sm">
              <div>
                <p>
                  <span className="font-semibold">Receipt No:</span>{" "}
                  <span className="font-mono">
                    {selectedReceipt.receipt?.receiptNumber ?? "N/A"}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Date:</span>{" "}
                  {format(
                    new Date(selectedReceipt.receipt?.generatedAt ?? selectedReceipt.receivedAt),
                    "dd MMMM yyyy"
                  )}
                </p>
              </div>
            </div>

            {/* Student Info */}
            <div className="mb-6 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <p>
                  <span className="font-semibold">Student Name:</span>{" "}
                  {selectedReceipt.studentName}
                </p>
                <p>
                  <span className="font-semibold">Student ID:</span>{" "}
                  {selectedReceipt.studentIdNumber}
                </p>
              </div>
            </div>

            {/* Fee Item Breakdown */}
            {selectedReceipt.studentBill?.billItems &&
              selectedReceipt.studentBill.billItems.length > 0 && (
                <div className="mb-6">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-800">
                        <th className="text-left py-2 font-semibold">Fee Item</th>
                        <th className="text-left py-2 font-semibold">Code</th>
                        <th className="text-right py-2 font-semibold">Amount (GHS)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReceipt.studentBill.billItems.map((item) => (
                        <tr key={item.id} className="border-b border-gray-300">
                          <td className="py-1.5">{item.feeItem.name}</td>
                          <td className="py-1.5 text-gray-500">
                            {item.feeItem.code ?? "---"}
                          </td>
                          <td className="py-1.5 text-right">
                            {item.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-800">
                        <td colSpan={2} className="py-2 font-semibold">
                          Total Bill
                        </td>
                        <td className="py-2 text-right font-semibold">
                          {(selectedReceipt.studentBill?.totalAmount ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

            {/* Payment Details */}
            <div className="mb-6 text-sm border-2 border-gray-800 rounded p-4">
              <div className="grid grid-cols-2 gap-3">
                <p>
                  <span className="font-semibold">Amount Paid:</span>{" "}
                  <span className="text-lg font-bold">
                    {formatCurrency(selectedReceipt.amount)}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Amount in Words:</span>{" "}
                  <span className="italic">
                    Ghana Cedis {selectedReceipt.amount.toFixed(2)} only
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Payment Method:</span>{" "}
                  {methodLabels[selectedReceipt.paymentMethod] ??
                    selectedReceipt.paymentMethod}
                </p>
                {selectedReceipt.referenceNumber && (
                  <p>
                    <span className="font-semibold">Reference:</span>{" "}
                    {selectedReceipt.referenceNumber}
                  </p>
                )}
              </div>
            </div>

            {/* Balance After Payment */}
            <div className="mb-8 text-sm">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-500">Total Bill</p>
                  <p className="font-semibold">
                    {formatCurrency(selectedReceipt.studentBill?.totalAmount ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Total Paid</p>
                  <p className="font-semibold text-green-700">
                    {formatCurrency(selectedReceipt.studentBill?.paidAmount ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Balance</p>
                  <p className="font-semibold text-red-700">
                    {formatCurrency(selectedReceipt.studentBill?.balanceAmount ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Signature Line */}
            <div className="flex justify-between items-end mt-12 text-sm">
              <div className="text-center">
                <div className="border-t border-gray-800 pt-1 w-48">
                  <p className="font-semibold">{selectedReceipt.receivedByName}</p>
                  <p className="text-xs text-gray-500">Received By</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-800 pt-1 w-48">
                  <p className="text-xs text-gray-500">Signature / Stamp</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-400">
              <p>This is a computer-generated receipt.</p>
              <p>
                Generated on{" "}
                {format(
                  new Date(
                    selectedReceipt.receipt?.generatedAt ?? selectedReceipt.receivedAt
                  ),
                  "dd MMM yyyy 'at' HH:mm"
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
