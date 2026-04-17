"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import {
  previewInvoiceTextAction,
  commitParsedInvoiceAction,
} from "@/modules/inventory/actions/invoice-intake.action";

interface Supplier { id: string; name: string }

interface ParsedShape {
  invoiceNumber: string | null;
  invoiceDate: Date | string | null;
  dueDate: Date | string | null;
  supplierName: string | null;
  subTotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  currency: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; lineTotal: number; confidence: number }>;
  warnings: string[];
  confidence: number;
  raw: { charsExtracted: number; linesExtracted: number };
}

export function IntakeClient({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<ParsedShape | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [suggestedSupplierId, setSuggestedSupplierId] = useState<string | null>(null);
  const [poId, setPoId] = useState("");
  const [overrideInvoiceNumber, setOverrideInvoiceNumber] = useState<string>("");
  const [overrideTotal, setOverrideTotal] = useState<string>("");
  const [runMatch, setRunMatch] = useState(true);

  const runPreview = () => {
    if (!raw.trim()) return toast.error("Paste invoice body first");
    start(async () => {
      const res = await previewInvoiceTextAction(raw);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setPreview(res.data.parsed as ParsedShape);
      setSuggestedSupplierId(res.data.suggestions.supplierId);
      if (res.data.suggestions.supplierId) setSupplierId(res.data.suggestions.supplierId);
      if (res.data.suggestions.purchaseOrderId) setPoId(res.data.suggestions.purchaseOrderId);
      toast.success(
        `Parsed ${res.data.parsed.items.length} line items (confidence ${(res.data.parsed.confidence * 100).toFixed(0)}%)`,
      );
    });
  };

  const commit = () => {
    if (!supplierId) return toast.error("Pick a supplier");
    if (!preview) return toast.error("Run preview first");
    start(async () => {
      const res = await commitParsedInvoiceAction({
        raw,
        supplierId,
        purchaseOrderId: poId || null,
        override: {
          invoiceNumber: overrideInvoiceNumber || preview.invoiceNumber,
          totalAmount: overrideTotal ? Number(overrideTotal) : preview.totalAmount,
        },
        runMatch,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Invoice captured (${res.data.warnings.length} warnings, confidence ${(res.data.confidence * 100).toFixed(0)}%)`,
      );
      router.push("/inventory/supplier-invoices");
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice intake"
        description="Paste an email body or PDF-extracted text. The parser extracts fields and suggests a supplier; you confirm before committing."
      />

      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">Raw invoice text</span>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={18}
              className="mt-1 w-full rounded border p-2 font-mono text-xs"
              placeholder={`Invoice No: INV-00123\nDate: 2026-04-12\nFrom: Pentacorp Supplies\n\nExercise books   50   12.00   600.00\nChalk (box)      20    5.00   100.00\n...\nSubtotal: 700.00\nVAT:       105.00\nTotal:     805.00`}
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button
              disabled={pending}
              onClick={runPreview}
              className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
            >
              {pending ? "Parsing…" : "Preview"}
            </button>
            <button
              onClick={() => {
                setRaw("");
                setPreview(null);
              }}
              className="rounded border px-3 py-1 text-sm"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {!preview ? (
            <p className="text-sm text-muted-foreground">
              Preview output will appear here. Operators can correct any parsed field before commit.
            </p>
          ) : (
            <>
              <Field label="Invoice #" value={preview.invoiceNumber ?? "—"} />
              <Field
                label="Invoice date"
                value={preview.invoiceDate ? new Date(preview.invoiceDate).toLocaleDateString("en-GH") : "—"}
              />
              <Field label="Supplier (detected)" value={preview.supplierName ?? "—"} />
              <Field label="Total amount" value={preview.totalAmount != null ? `${preview.currency} ${preview.totalAmount.toFixed(2)}` : "—"} />
              <Field label="Subtotal" value={preview.subTotal != null ? preview.subTotal.toFixed(2) : "—"} />
              <Field label="Tax" value={preview.taxAmount != null ? preview.taxAmount.toFixed(2) : "—"} />
              <Field label="Confidence" value={`${(preview.confidence * 100).toFixed(0)}%`} emphasis={preview.confidence < 0.6} />

              {preview.warnings.length > 0 && (
                <ul className="ml-4 list-disc text-sm text-amber-700">
                  {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}

              <div className="space-y-2 pt-2 border-t">
                <label className="block text-sm">
                  <span className="text-xs text-muted-foreground">Supplier {suggestedSupplierId ? "(suggested)" : ""}</span>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="mt-1 w-full rounded border p-2"
                  >
                    <option value="">Select supplier…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.id === suggestedSupplierId ? " ← suggested" : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="text-xs text-muted-foreground">Linked purchase order ID (optional)</span>
                  <input
                    value={poId}
                    onChange={(e) => setPoId(e.target.value)}
                    placeholder="po_xxxxx"
                    className="mt-1 w-full rounded border p-2 text-xs font-mono"
                  />
                </label>

                <label className="block text-sm">
                  <span className="text-xs text-muted-foreground">Override invoice number</span>
                  <input
                    value={overrideInvoiceNumber}
                    onChange={(e) => setOverrideInvoiceNumber(e.target.value)}
                    placeholder={preview.invoiceNumber ?? ""}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>

                <label className="block text-sm">
                  <span className="text-xs text-muted-foreground">Override total</span>
                  <input
                    type="number"
                    step="0.01"
                    value={overrideTotal}
                    onChange={(e) => setOverrideTotal(e.target.value)}
                    placeholder={preview.totalAmount?.toFixed(2)}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={runMatch}
                    onChange={(e) => setRunMatch(e.target.checked)}
                  />
                  Run 3-way match on commit (if PO linked)
                </label>

                <button
                  disabled={pending}
                  onClick={commit}
                  className="w-full rounded bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  {pending ? "Committing…" : "Commit invoice"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {preview && preview.items.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Parsed line items</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-2">Description</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Unit</th>
                  <th className="p-2 text-right">Line total</th>
                  <th className="p-2 text-right">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((it, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{it.description}</td>
                    <td className="p-2 text-right">{it.quantity}</td>
                    <td className="p-2 text-right">{it.unitPrice.toFixed(2)}</td>
                    <td className="p-2 text-right">{it.lineTotal.toFixed(2)}</td>
                    <td className={`p-2 text-right ${it.confidence < 0.7 ? "text-amber-700" : ""}`}>
                      {(it.confidence * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <aside className="rounded border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-semibold mb-1">Automating ingestion</p>
        <p>
          External mail forwarders can POST pre-extracted text straight to{" "}
          <code>/api/inventory/invoice-intake</code> with an <code>x-intake-signature</code>{" "}
          header (HMAC-SHA256 over the body, key from <code>INVENTORY_INTAKE_SECRET</code>).
          The endpoint creates a draft SupplierInvoice exactly as this UI does.
        </p>
      </aside>
    </div>
  );
}

function Field({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={emphasis ? "text-amber-700 font-semibold" : ""}>{value}</span>
    </div>
  );
}
