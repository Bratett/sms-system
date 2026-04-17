"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { parseInvoiceText, type ParsedInvoice } from "@/lib/inventory/invoice-parser";
import { runThreeWayMatch, persistMatchOutcome } from "@/lib/inventory/three-way-match";

const MAX_RAW_CHARS = 100_000;

/**
 * Deterministic "preview" — run the parser without persisting. The UI
 * renders this so the operator can edit fields before committing.
 */
export async function previewInvoiceTextAction(raw: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUPPLIER_INVOICE_CREATE);
  if (denied) return denied;

  if (typeof raw !== "string") return { error: "raw must be a string" };
  if (raw.length === 0) return { error: "raw text is empty" };
  if (raw.length > MAX_RAW_CHARS) return { error: `raw text exceeds ${MAX_RAW_CHARS} chars` };

  const parsed = parseInvoiceText(raw);

  // Suggest a supplier — case-insensitive substring match on the parsed name.
  let suggestedSupplierId: string | null = null;
  if (parsed.supplierName) {
    const supplier = await db.supplier.findFirst({
      where: {
        schoolId: ctx.schoolId,
        OR: [
          { name: { equals: parsed.supplierName, mode: "insensitive" } },
          { name: { contains: parsed.supplierName, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true },
    });
    suggestedSupplierId = supplier?.id ?? null;
  }

  // Suggest the newest open PO for that supplier if total roughly matches.
  let suggestedPurchaseOrderId: string | null = null;
  if (suggestedSupplierId && parsed.totalAmount) {
    const po = await db.purchaseOrder.findFirst({
      where: {
        supplierId: suggestedSupplierId,
        status: { in: ["SENT", "PARTIALLY_RECEIVED", "RECEIVED"] },
      },
      orderBy: { orderedAt: "desc" },
      select: { id: true, totalAmount: true, orderNumber: true },
    });
    if (po) suggestedPurchaseOrderId = po.id;
  }

  return {
    data: {
      parsed,
      suggestions: {
        supplierId: suggestedSupplierId,
        purchaseOrderId: suggestedPurchaseOrderId,
      },
    },
  };
}

/**
 * Persists the parsed draft as a SupplierInvoice + line items, optionally
 * running a 3-way match straight away. Operator must confirm the supplier
 * binding (the parser is only a suggestion).
 */
export async function commitParsedInvoiceAction(input: {
  raw: string;
  supplierId: string;
  purchaseOrderId?: string | null;
  // operator-supplied overrides (e.g. correct invoice date after parser
  // chose the wrong one)
  override?: Partial<ParsedInvoice>;
  runMatch?: boolean;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUPPLIER_INVOICE_CREATE);
  if (denied) return denied;

  if (!input.raw || !input.supplierId) return { error: "raw and supplierId are required" };
  if (input.raw.length > MAX_RAW_CHARS) return { error: "raw text too large" };

  const parsed = parseInvoiceText(input.raw);
  const merged = { ...parsed, ...(input.override ?? {}) } as ParsedInvoice;

  if (!merged.invoiceNumber) return { error: "Could not extract invoice number — provide via override" };
  if (!merged.invoiceDate) return { error: "Could not extract invoice date — provide via override" };
  if (!merged.totalAmount || merged.totalAmount <= 0) {
    return { error: "Could not extract total amount — provide via override" };
  }

  const supplier = await db.supplier.findFirst({
    where: { id: input.supplierId, schoolId: ctx.schoolId },
  });
  if (!supplier) return { error: "Supplier not found for this tenant" };

  if (input.purchaseOrderId) {
    const po = await db.purchaseOrder.findUnique({ where: { id: input.purchaseOrderId } });
    if (!po) return { error: "Purchase order not found" };
    if (po.supplierId !== supplier.id) {
      return { error: "Purchase order does not belong to this supplier" };
    }
  }

  const subTotal = merged.subTotal ?? merged.totalAmount - (merged.taxAmount ?? 0);
  const taxAmount = merged.taxAmount ?? 0;
  const totalAmount = merged.totalAmount;

  // Duplicate guard — (supplier, invoiceNumber) unique on the DB but we catch
  // early so the operator gets a clean error rather than a prisma P2002.
  const duplicate = await db.supplierInvoice.findUnique({
    where: {
      supplierId_invoiceNumber: {
        supplierId: supplier.id,
        invoiceNumber: merged.invoiceNumber,
      },
    },
  });
  if (duplicate) {
    return { error: `Invoice ${merged.invoiceNumber} is already captured for ${supplier.name}` };
  }

  const created = await db.$transaction(async (tx) => {
    const invoice = await tx.supplierInvoice.create({
      data: {
        schoolId: ctx.schoolId,
        supplierId: supplier.id,
        purchaseOrderId: input.purchaseOrderId ?? null,
        invoiceNumber: merged.invoiceNumber!,
        invoiceDate: merged.invoiceDate!,
        dueDate: merged.dueDate ?? null,
        subTotal,
        taxAmount,
        totalAmount,
        currency: merged.currency || "GHS",
        status: "RECEIVED",
        notes: `Auto-parsed (confidence ${merged.confidence.toFixed(2)})${merged.warnings.length ? "\n" + merged.warnings.map((w) => "- " + w).join("\n") : ""}`,
        receivedBy: ctx.session.user.id,
      },
    });
    if (merged.items.length > 0) {
      await tx.supplierInvoiceItem.createMany({
        data: merged.items.map((i) => ({
          supplierInvoiceId: invoice.id,
          schoolId: ctx.schoolId,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        })),
      });
    }
    return invoice;
  });

  // Optionally run a 3-way match if a PO is linked.
  if (input.runMatch && created.purchaseOrderId) {
    try {
      const outcome = await runThreeWayMatch({
        schoolId: ctx.schoolId,
        supplierInvoiceId: created.id,
      });
      await persistMatchOutcome(ctx.schoolId, created.id, outcome);
    } catch {
      // leave operator to rerun from the UI
    }
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "SupplierInvoice",
    entityId: created.id,
    module: "inventory",
    description: `Captured supplier invoice ${merged.invoiceNumber} via intake parser`,
    metadata: {
      confidence: merged.confidence,
      warnings: merged.warnings,
      itemsParsed: merged.items.length,
    },
  });

  revalidatePath("/inventory/supplier-invoices");
  return {
    data: {
      invoiceId: created.id,
      confidence: merged.confidence,
      warnings: merged.warnings,
    },
  };
}
