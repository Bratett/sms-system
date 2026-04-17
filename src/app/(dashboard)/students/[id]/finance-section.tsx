"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency } from "@/lib/format-currency";
import { getStudentBillsAction } from "@/modules/finance/actions/billing.action";
import { getPaymentsAction } from "@/modules/finance/actions/payment.action";

interface Bill {
  id: string;
  termName: string;
  totalAmount: unknown;
  paidAmount: unknown;
  balanceAmount: unknown;
  status: string;
  feeStructure: { id: string; name: string } | null;
  generatedAt: Date;
}

interface Payment {
  id: string;
  amount: unknown;
  paymentMethod: string;
  receivedAt: Date;
  receiptNumber: string | null;
  reversedAt?: Date | null;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function StudentFinanceSection({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const [billRes, payRes] = await Promise.all([
        getStudentBillsAction(studentId),
        getPaymentsAction({ studentId, pageSize: 10 }),
      ]);
      if (cancelled) return;
      if ("error" in billRes) {
        setError(billRes.error as string);
        setLoading(false);
        return;
      }
      if ("error" in payRes) {
        setError(payRes.error as string);
        setLoading(false);
        return;
      }
      setBills((billRes.data ?? []) as unknown as Bill[]);
      setPayments((payRes.data ?? []) as unknown as Payment[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading finance data…</div>;
  }

  if (error) {
    return <div className="py-12 text-center text-sm text-red-600">Error: {error}</div>;
  }

  const totalBilled = bills.reduce((sum, b) => sum + Number(b.totalAmount ?? 0), 0);
  const totalPaid = bills.reduce((sum, b) => sum + Number(b.paidAmount ?? 0), 0);
  const outstanding = bills.reduce((sum, b) => sum + Number(b.balanceAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Total Billed</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(totalBilled)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Total Paid</p>
          <p className="mt-1 text-2xl font-semibold text-green-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Outstanding</p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              outstanding > 0 ? "text-red-600" : "text-muted-foreground"
            }`}
          >
            {formatCurrency(outstanding)}
          </p>
        </div>
      </div>

      {/* Recent bills */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Recent Bills</h3>
          <Link
            href={`/finance/billing?studentId=${studentId}`}
            className="text-xs text-primary hover:underline"
          >
            View all bills →
          </Link>
        </div>
        {bills.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No bills on record.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Term</th>
                  <th className="px-3 py-2 font-medium">Fee Structure</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                  <th className="px-3 py-2 font-medium text-right">Paid</th>
                  <th className="px-3 py-2 font-medium text-right">Balance</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.slice(0, 5).map((b) => (
                  <tr
                    key={b.id}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => router.push(`/finance/billing?billId=${b.id}`)}
                  >
                    <td className="px-3 py-2">{b.termName}</td>
                    <td className="px-3 py-2">{b.feeStructure?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(b.totalAmount as never)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(b.paidAmount as never)}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(b.balanceAmount as never)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent payments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Recent Payments</h3>
          <Link
            href={`/finance/payments?studentId=${studentId}`}
            className="text-xs text-primary hover:underline"
          >
            View all payments →
          </Link>
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No payments on record.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                  <th className="px-3 py-2 font-medium">Receipt #</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 5).map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2">{formatDate(p.receivedAt)}</td>
                    <td className="px-3 py-2">{p.paymentMethod}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(p.amount as never)}</td>
                    <td className="px-3 py-2">
                      {p.receiptNumber ? (
                        <Link
                          href={`/finance/receipts?receipt=${p.receiptNumber}`}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.receiptNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
