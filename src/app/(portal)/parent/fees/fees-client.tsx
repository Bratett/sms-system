"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getChildFeesAction } from "@/modules/portal/actions/parent.action";
import { formatDate } from "@/lib/utils";

interface ChildData {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
}

interface BillData {
  id: string;
  termName: string;
  academicYearName: string;
  feeStructureName: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  dueDate: Date | null;
  generatedAt: Date;
  payments: {
    id: string;
    amount: number;
    paymentMethod: string;
    referenceNumber: string | null;
    receivedAt: Date;
    receiptNumber: string | null;
  }[];
}

interface FeesData {
  bills: BillData[];
  summary: {
    totalFees: number;
    totalPaid: number;
    totalBalance: number;
  };
}

interface FeesClientProps {
  students: ChildData[];
}

export function FeesClient({ students }: FeesClientProps) {
  const searchParams = useSearchParams();
  const initialStudentId = searchParams.get("studentId") || students[0]?.id || "";

  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId);
  const [feesData, setFeesData] = useState<FeesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedBill, setExpandedBill] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedStudentId) return;
    let cancelled = false;
    setLoading(true);
    getChildFeesAction(selectedStudentId)
      .then((result) => {
        if (cancelled) return;
        if (result.data) {
          setFeesData(result.data as unknown as FeesData);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStudentId]);

  const formatCurrency = (amount: number) =>
    `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Overview"
        description="View fee bills and payment history for your children."
      />

      {/* Child Selector */}
      {students.length > 1 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <label className="block text-sm font-medium text-gray-700">Select Child</label>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:max-w-xs"
          >
            {students.map((child) => (
              <option key={child.id} value={child.id}>
                {child.firstName} {child.lastName} ({child.studentId})
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : feesData ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Total Fees</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {formatCurrency(feesData.summary.totalFees)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Total Paid</p>
              <p className="mt-1 text-2xl font-bold text-green-600">
                {formatCurrency(feesData.summary.totalPaid)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Outstanding Balance</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  feesData.summary.totalBalance > 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {formatCurrency(feesData.summary.totalBalance)}
              </p>
            </div>
          </div>

          {/* Bills Table */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">Fee Bills</h3>
            </div>

            {feesData.bills.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No fee bills found for this student.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {feesData.bills.map((bill) => (
                  <div key={bill.id}>
                    <button
                      onClick={() => setExpandedBill(expandedBill === bill.id ? null : bill.id)}
                      className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">{bill.feeStructureName}</span>
                          <StatusBadge status={bill.status} />
                        </div>
                        <p className="mt-0.5 text-sm text-gray-500">
                          {bill.termName} - {bill.academicYearName}
                        </p>
                      </div>
                      <div className="ml-4 text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(bill.totalAmount)}
                        </p>
                        {bill.balanceAmount > 0 && (
                          <p className="text-xs text-red-600">
                            Balance: {formatCurrency(bill.balanceAmount)}
                          </p>
                        )}
                      </div>
                    </button>

                    {expandedBill === bill.id && (
                      <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                        <div className="mb-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                          <div>
                            <p className="text-gray-500">Total Amount</p>
                            <p className="font-medium">{formatCurrency(bill.totalAmount)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Paid</p>
                            <p className="font-medium text-green-600">
                              {formatCurrency(bill.paidAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Balance</p>
                            <p className="font-medium text-red-600">
                              {formatCurrency(bill.balanceAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Due Date</p>
                            <p className="font-medium">
                              {bill.dueDate ? formatDate(bill.dueDate) : "Not set"}
                            </p>
                          </div>
                        </div>

                        {bill.payments.length > 0 && (
                          <div className="mt-3">
                            <h4 className="mb-2 text-sm font-medium text-gray-700">
                              Payment History
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                                    <th className="pb-2 pr-4">Date</th>
                                    <th className="pb-2 pr-4">Amount</th>
                                    <th className="pb-2 pr-4">Method</th>
                                    <th className="pb-2">Receipt</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {bill.payments.map((payment) => (
                                    <tr key={payment.id}>
                                      <td className="py-2 pr-4">
                                        {formatDate(payment.receivedAt)}
                                      </td>
                                      <td className="py-2 pr-4 font-medium">
                                        {formatCurrency(payment.amount)}
                                      </td>
                                      <td className="py-2 pr-4 capitalize">
                                        {payment.paymentMethod.replace(/_/g, " ").toLowerCase()}
                                      </td>
                                      <td className="py-2">{payment.receiptNumber ?? "-"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : students.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900">No Children Linked</h3>
          <p className="mt-1 text-sm text-gray-500">
            Your account has not been linked to any student records.
          </p>
        </div>
      ) : null}
    </div>
  );
}
