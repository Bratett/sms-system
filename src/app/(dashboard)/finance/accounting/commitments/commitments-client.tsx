"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  approveBudgetCommitmentAction,
  cancelBudgetCommitmentAction,
} from "@/modules/accounting/actions/budget-commitment.action";
import type { Monetary } from "@/lib/monetary";

type Status = "DRAFT" | "APPROVED" | "PARTIALLY_LIQUIDATED" | "LIQUIDATED" | "CANCELLED";

interface Commitment {
  id: string;
  commitmentNumber: string;
  vendorName: string;
  description: string | null;
  totalAmount: Monetary;
  liquidatedAmount: Monetary;
  currency: string;
  commitmentDate: Date | string;
  status: Status;
  budgetLine?: { expenseCategory: { name: string } } | null;
  lines: Array<{ id: string; description: string; quantity: Monetary; unitPrice: Monetary; amount: Monetary }>;
}

const STATUS_STYLES: Record<Status, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PARTIALLY_LIQUIDATED: "bg-amber-100 text-amber-700",
  LIQUIDATED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

function formatCurrency(n: Monetary | number): string {
  return `GHS ${Number(n).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CommitmentsClient({ commitments }: { commitments: Commitment[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveBudgetCommitmentAction(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Commitment approved — encumbrance journal posted");
      router.refresh();
    });
  }

  function handleCancel(id: string, reason: string) {
    startTransition(async () => {
      const result = await cancelBudgetCommitmentAction(id, reason);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Commitment cancelled — encumbrance reversed");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget Commitments"
        description="IPSAS 24 budgetary control — POs/obligations that encumber budget authority before actual spend"
      />

      {commitments.length === 0 ? (
        <EmptyState
          title="No commitments"
          description="Budget commitments can be created from the Budgets module when a PO or obligation needs to reserve budget authority."
        />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Budget Line</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Liquidated</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {commitments.map((c) => (
                <>
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-mono">{c.commitmentNumber}</td>
                    <td className="px-4 py-3 text-sm font-medium">{c.vendorName}</td>
                    <td className="px-4 py-3 text-xs">{c.budgetLine?.expenseCategory.name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(c.totalAmount)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(c.liquidatedAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status]}`}>
                        {c.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 text-xs">
                        <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="text-primary hover:underline">
                          {expandedId === c.id ? "Hide" : "View"}
                        </button>
                        {c.status === "DRAFT" && (
                          <ConfirmDialog
                            title="Approve Commitment"
                            description={`Approve ${c.commitmentNumber}? This posts the encumbrance journal (Dr 9100 / Cr 9200) and reduces available budget by GHS ${Number(c.totalAmount).toFixed(2)}.`}
                            onConfirm={() => handleApprove(c.id)}
                            trigger={<button disabled={isPending} className="text-green-600 hover:underline">Approve</button>}
                          />
                        )}
                        {(c.status === "APPROVED" || c.status === "PARTIALLY_LIQUIDATED") && (
                          <ConfirmDialog
                            title="Cancel Commitment"
                            description={`Cancel ${c.commitmentNumber}? The remaining encumbrance will be reversed and budget authority released.`}
                            onConfirm={() => handleCancel(c.id, "Cancelled via UI")}
                            variant="destructive"
                            trigger={<button disabled={isPending} className="text-red-600 hover:underline">Cancel</button>}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === c.id && (
                    <tr key={`${c.id}-details`}>
                      <td colSpan={7} className="bg-muted/30 px-4 py-3">
                        {c.description && <p className="text-sm mb-2 italic text-muted-foreground">{c.description}</p>}
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs uppercase text-muted-foreground">
                              <th className="px-3 py-2">Description</th>
                              <th className="px-3 py-2 text-right">Qty</th>
                              <th className="px-3 py-2 text-right">Unit Price</th>
                              <th className="px-3 py-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {c.lines.map((l) => (
                              <tr key={l.id}>
                                <td className="px-3 py-2">{l.description}</td>
                                <td className="px-3 py-2 text-right">{Number(l.quantity).toFixed(2)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(l.unitPrice)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(l.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
