"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  updateMatchToleranceAction,
  rerunMatchAction,
  approveSupplierInvoiceAction,
  recordInvoicePaymentAction,
} from "@/modules/inventory/actions/supplier-invoice.action";

interface Invoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  totalAmount: string | number;
  currency: string;
  status: string;
  invoiceDate: Date | string;
  dueDate: Date | string | null;
  matches: Array<{
    id: string;
    result: string;
    priceVariance: string | number;
    quantityVariance: string | number;
    withinTolerance: boolean;
  }>;
}

interface Tolerance {
  id: string;
  priceTolerancePercent: string | number;
  priceToleranceAbsolute: string | number;
  quantityTolerancePercent: string | number;
  autoApproveClean: boolean;
  requireGoodsReceived: boolean;
}

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "string" ? parseFloat(v) : v;
}

function statusPill(status: string) {
  const map: Record<string, string> = {
    RECEIVED: "bg-blue-100 text-blue-700",
    MATCHED: "bg-green-100 text-green-700",
    VARIANCE: "bg-amber-100 text-amber-700",
    APPROVED: "bg-emerald-100 text-emerald-700",
    PAID: "bg-gray-200 text-gray-700",
    REJECTED: "bg-red-100 text-red-700",
    VOIDED: "bg-gray-100 text-gray-500",
  };
  return `rounded px-2 py-0.5 text-xs ${map[status] ?? "bg-gray-100 text-gray-600"}`;
}

export function SupplierInvoicesClient({
  initialInvoices,
  tolerance,
}: {
  initialInvoices: Invoice[];
  tolerance: Tolerance | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pricePct, setPricePct] = useState(toNum(tolerance?.priceTolerancePercent) || 0);
  const [priceAbs, setPriceAbs] = useState(toNum(tolerance?.priceToleranceAbsolute) || 0);
  const [qtyPct, setQtyPct] = useState(toNum(tolerance?.quantityTolerancePercent) || 0);
  const [autoApprove, setAutoApprove] = useState(tolerance?.autoApproveClean ?? false);
  const [requireGrn, setRequireGrn] = useState(tolerance?.requireGoodsReceived ?? true);

  const saveTolerance = () => {
    start(async () => {
      const res = await updateMatchToleranceAction({
        priceTolerancePercent: pricePct,
        priceToleranceAbsolute: priceAbs,
        quantityTolerancePercent: qtyPct,
        autoApproveClean: autoApprove,
        requireGoodsReceived: requireGrn,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Tolerance settings updated");
      router.refresh();
    });
  };

  const rerun = (id: string) => {
    start(async () => {
      const res = await rerunMatchAction(id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Match: ${res.data.result}`);
      router.refresh();
    });
  };

  const approve = (inv: Invoice) => {
    const latest = inv.matches[0];
    const needsOverride = latest && latest.result !== "CLEAN";
    const notes = needsOverride ? prompt("Approval note (required for variance override):") : null;
    if (needsOverride && !notes) return;
    start(async () => {
      const res = await approveSupplierInvoiceAction({
        invoiceId: inv.id,
        notes: notes ?? undefined,
        override: !!needsOverride,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Invoice approved");
      router.refresh();
    });
  };

  const pay = (id: string) => {
    const ref = prompt("Payment reference (bank transfer #, cheque #, etc.):");
    if (!ref) return;
    start(async () => {
      const res = await recordInvoicePaymentAction({ invoiceId: id, paymentRef: ref });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Payment recorded");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier invoices & 3-way match"
        description="Capture supplier invoices, reconcile against PO/GRN, approve only clean or overridden matches."
      />

      <section className="rounded border bg-card p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold">Match tolerance</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <NumberInput label="Price tolerance %" value={pricePct} onChange={setPricePct} />
          <NumberInput label="Price tolerance (GHS)" value={priceAbs} onChange={setPriceAbs} />
          <NumberInput label="Quantity tolerance %" value={qtyPct} onChange={setQtyPct} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
            />
            Auto-approve clean matches
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requireGrn}
              onChange={(e) => setRequireGrn(e.target.checked)}
            />
            Require goods-received record
          </label>
        </div>
        <div className="mt-3">
          <button
            disabled={pending}
            onClick={saveTolerance}
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
          >
            Save
          </button>
        </div>
      </section>

      <section>
        {initialInvoices.length === 0 ? (
          <EmptyState title="No supplier invoices" description="Capture your first supplier invoice to run a 3-way match." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-2">Invoice #</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Due</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Match</th>
                  <th className="p-2 text-right">Price var.</th>
                  <th className="p-2 text-right">Qty var.</th>
                  <th className="p-2 text-right">Total</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialInvoices.map((inv) => {
                  const latest = inv.matches[0];
                  return (
                    <tr key={inv.id} className="border-t">
                      <td className="p-2 font-mono">{inv.invoiceNumber}</td>
                      <td className="p-2">{new Date(inv.invoiceDate).toLocaleDateString("en-GH")}</td>
                      <td className="p-2">
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-GH") : "—"}
                      </td>
                      <td className="p-2">
                        <span className={statusPill(inv.status)}>{inv.status}</span>
                      </td>
                      <td className="p-2 text-xs">{latest?.result ?? "—"}</td>
                      <td className="p-2 text-right">{toNum(latest?.priceVariance).toFixed(2)}</td>
                      <td className="p-2 text-right">{toNum(latest?.quantityVariance).toFixed(4)}</td>
                      <td className="p-2 text-right">
                        {inv.currency} {toNum(inv.totalAmount).toFixed(2)}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <button
                            disabled={pending}
                            onClick={() => rerun(inv.id)}
                            className="rounded border px-2 py-0.5 text-xs hover:bg-muted"
                          >
                            Re-match
                          </button>
                          {(inv.status === "MATCHED" || inv.status === "VARIANCE") && (
                            <button
                              disabled={pending}
                              onClick={() => approve(inv)}
                              className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white hover:bg-emerald-700"
                            >
                              Approve
                            </button>
                          )}
                          {inv.status === "APPROVED" && (
                            <button
                              disabled={pending}
                              onClick={() => pay(inv.id)}
                              className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground"
                            >
                              Mark paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-1 w-full rounded border p-1 text-sm"
      />
    </label>
  );
}
