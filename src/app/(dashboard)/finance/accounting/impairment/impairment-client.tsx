"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { applyImpairmentAction, writeOffBillAction } from "@/modules/accounting/actions/impairment.action";

interface AgingData {
  asOfDate: Date | string;
  buckets: { b0_30: number; b31_60: number; b61_90: number; b91_180: number; b180_plus: number };
  eclRates: { b0_30: number; b31_60: number; b61_90: number; b91_180: number; b180_plus: number };
  allowancePerBucket: { b0_30: number; b31_60: number; b61_90: number; b91_180: number; b180_plus: number };
  totalReceivables: number;
  totalAllowance: number;
  netReceivables: number;
  billCount: number;
  details: Array<{ bucket: "b0_30" | "b31_60" | "b61_90" | "b91_180" | "b180_plus"; billId: string; studentId: string; days: number; amount: number }>;
}

type Bucket = "b0_30" | "b31_60" | "b61_90" | "b91_180" | "b180_plus";
const BUCKET_LABELS: Record<Bucket, string> = {
  b0_30: "0\u201330 days",
  b31_60: "31\u201360 days",
  b61_90: "61\u201390 days",
  b91_180: "91\u2013180 days",
  b180_plus: "180+ days",
};

function formatCurrency(n: number): string {
  return `GHS ${Number(n).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ImpairmentClient({ aging }: { aging: AgingData | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [writeOffBillIdInput, setWriteOffBillIdInput] = useState("");
  const [writeOffReason, setWriteOffReason] = useState("");

  function handleApplyImpairment() {
    startTransition(async () => {
      const result = await applyImpairmentAction(new Date());
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const { previousAllowance, newAllowance, delta } = result.data;
      toast.success(`ECL adjusted: ${formatCurrency(previousAllowance)} → ${formatCurrency(newAllowance)} (Δ ${formatCurrency(delta)})`);
      router.refresh();
    });
  }

  function handleWriteOff() {
    if (!writeOffBillIdInput.trim() || !writeOffReason.trim()) {
      toast.error("Bill ID and reason are required");
      return;
    }
    startTransition(async () => {
      const result = await writeOffBillAction(writeOffBillIdInput.trim(), writeOffReason.trim());
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Bill written off");
      setWriteOffBillIdInput("");
      setWriteOffReason("");
      router.refresh();
    });
  }

  if (!aging) {
    return (
      <div className="space-y-6">
        <PageHeader title="Receivables Impairment" description="IPSAS 29/41 expected credit loss and write-offs" />
        <EmptyState title="No aging data" description="Generate a receivables aging report first." />
      </div>
    );
  }

  const buckets: Bucket[] = ["b0_30", "b31_60", "b61_90", "b91_180", "b180_plus"];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receivables Impairment"
        description="IPSAS 29/41 expected credit loss, allowance adjustment, and bill write-off"
        actions={
          <ConfirmDialog
            title="Apply Impairment"
            description={`Post adjusting journal to set allowance to ${formatCurrency(aging.totalAllowance)}. Computed from current aging with default ECL rates.`}
            onConfirm={handleApplyImpairment}
            trigger={
              <button disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                Apply Impairment
              </button>
            }
          />
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Gross Receivables</p>
          <p className="text-2xl font-bold">{formatCurrency(aging.totalReceivables)}</p>
          <p className="text-xs text-muted-foreground">{aging.billCount} outstanding bills</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Required Allowance (ECL)</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(aging.totalAllowance)}</p>
          <p className="text-xs text-muted-foreground">Expected credit loss</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Net Receivables</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(aging.netReceivables)}</p>
          <p className="text-xs text-muted-foreground">Gross − allowance</p>
        </div>
      </div>

      {/* Aging breakdown */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Aging Breakdown</h2>
        </div>
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/30">
            <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2">Bucket</th>
              <th className="px-4 py-2 text-right">Outstanding</th>
              <th className="px-4 py-2 text-right">ECL Rate</th>
              <th className="px-4 py-2 text-right">Allowance</th>
              <th className="px-4 py-2 text-right">Bills</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {buckets.map((b) => {
              const count = aging.details.filter((d) => d.bucket === b).length;
              return (
                <tr key={b}>
                  <td className="px-4 py-2 text-sm">{BUCKET_LABELS[b]}</td>
                  <td className="px-4 py-2 text-sm text-right">{formatCurrency(aging.buckets[b])}</td>
                  <td className="px-4 py-2 text-sm text-right text-muted-foreground">{aging.eclRates[b]}%</td>
                  <td className="px-4 py-2 text-sm text-right">{formatCurrency(aging.allowancePerBucket[b])}</td>
                  <td className="px-4 py-2 text-sm text-right text-muted-foreground">{count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Write-off */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-bold mb-3">Write Off Uncollectible Bill</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Posts <code>Dr Allowance (up to current balance) + Dr Bad Debt (remainder) / Cr Accounts Receivable</code>. Marks the bill as fully waived.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={writeOffBillIdInput}
            onChange={(e) => setWriteOffBillIdInput(e.target.value)}
            placeholder="Bill ID (cuid)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
          />
          <input
            type="text"
            value={writeOffReason}
            onChange={(e) => setWriteOffReason(e.target.value)}
            placeholder="Reason (e.g., student emigrated)"
            className="sm:col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3">
          <ConfirmDialog
            title="Write Off Bill"
            description={`Write off bill ${writeOffBillIdInput || "[none]"}? This is irreversible via the UI.`}
            onConfirm={handleWriteOff}
            variant="destructive"
            trigger={
              <button disabled={isPending || !writeOffBillIdInput || !writeOffReason} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                Write Off
              </button>
            }
          />
        </div>
      </div>
    </div>
  );
}
