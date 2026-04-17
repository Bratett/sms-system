"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { runThreeWayMatch, persistMatchOutcome } from "@/lib/inventory/three-way-match";
import {
  createSupplierInvoiceSchema,
  updateMatchToleranceSchema,
  approveInvoiceSchema,
  type CreateSupplierInvoiceInput,
  type UpdateMatchToleranceInput,
  type ApproveInvoiceInput,
} from "../schemas/supplier-invoice.schema";

// parse helper removed — call schema.safeParse directly below.

// ─── Match tolerance (settings) ──────────────────────────────────────

export async function getMatchToleranceAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUPPLIER_INVOICE_READ);
  if (denied) return denied;

  const setting = await db.matchToleranceSetting.findUnique({
    where: { schoolId: ctx.schoolId },
  });
  return { data: setting };
}

export async function updateMatchToleranceAction(input: UpdateMatchToleranceInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.MATCH_TOLERANCE_MANAGE);
  if (denied) return denied;
  const parsed = updateMatchToleranceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const row = await db.matchToleranceSetting.upsert({
    where: { schoolId: ctx.schoolId },
    create: { schoolId: ctx.schoolId, ...data, updatedBy: ctx.session.user.id },
    update: { ...data, updatedBy: ctx.session.user.id },
  });
  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "MatchToleranceSetting",
    entityId: row.id,
    module: "inventory",
    description: "Updated 3-way match tolerance settings",
    metadata: data as unknown as Record<string, unknown>,
  });
  revalidatePath("/inventory/supplier-invoices");
  return { data: row };
}

// ─── Invoices ────────────────────────────────────────────────────────

export async function listSupplierInvoicesAction(filters?: {
  status?: string;
  supplierId?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUPPLIER_INVOICE_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.status) where.status = filters.status;
  if (filters?.supplierId) where.supplierId = filters.supplierId;

  const [invoices, total] = await Promise.all([
    db.supplierInvoice.findMany({
      where,
      include: {
        matches: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.supplierInvoice.count({ where }),
  ]);
  return { data: { invoices, pagination: { page, pageSize, total } } };
}

export async function getSupplierInvoiceAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUPPLIER_INVOICE_READ);
  if (denied) return denied;
  const invoice = await db.supplierInvoice.findFirst({
    where: { id, schoolId: ctx.schoolId },
    include: { items: true, matches: true },
  });
  if (!invoice) return { error: "Invoice not found" };
  return { data: invoice };
}

export async function createSupplierInvoiceAction(input: CreateSupplierInvoiceInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUPPLIER_INVOICE_CREATE);
  if (denied) return denied;
  const parsed = createSupplierInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  // Sanity: total == subTotal + taxAmount (allow small rounding)
  const computed = data.subTotal + data.taxAmount;
  if (Math.abs(computed - data.totalAmount) > 0.05) {
    return {
      error: `subTotal + taxAmount (${computed.toFixed(2)}) does not match totalAmount (${data.totalAmount.toFixed(2)})`,
    };
  }

  if (data.purchaseOrderId) {
    const po = await db.purchaseOrder.findUnique({ where: { id: data.purchaseOrderId } });
    if (!po) return { error: "Purchase order not found" };
    if (po.supplierId !== data.supplierId) {
      return { error: "Purchase order does not belong to this supplier" };
    }
  }

  const created = await db.$transaction(async (tx) => {
    const invoice = await tx.supplierInvoice.create({
      data: {
        schoolId: ctx.schoolId,
        supplierId: data.supplierId,
        purchaseOrderId: data.purchaseOrderId ?? null,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate ?? null,
        subTotal: data.subTotal,
        taxAmount: data.taxAmount,
        totalAmount: data.totalAmount,
        currency: data.currency ?? "GHS",
        status: "RECEIVED",
        notes: data.notes ?? null,
        documentUrl: data.documentUrl ?? null,
        receivedBy: ctx.session.user.id,
      },
    });
    await tx.supplierInvoiceItem.createMany({
      data: data.items.map((i) => ({
        supplierInvoiceId: invoice.id,
        schoolId: ctx.schoolId,
        storeItemId: i.storeItemId ?? null,
        purchaseOrderItemId: i.purchaseOrderItemId ?? null,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
        taxRate: i.taxRate ?? null,
      })),
    });
    return invoice;
  });

  // Run the 3-way match immediately if a PO is linked.
  if (created.purchaseOrderId) {
    try {
      const outcome = await runThreeWayMatch({
        schoolId: ctx.schoolId,
        supplierInvoiceId: created.id,
      });
      await persistMatchOutcome(ctx.schoolId, created.id, outcome);
    } catch {
      // fall through; operator can rerun from the UI
    }
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "SupplierInvoice",
    entityId: created.id,
    module: "inventory",
    description: `Captured supplier invoice ${data.invoiceNumber}`,
    metadata: { totalAmount: data.totalAmount, currency: data.currency },
  });

  revalidatePath("/inventory/supplier-invoices");
  return { data: created };
}

export async function rerunMatchAction(invoiceId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUPPLIER_INVOICE_READ);
  if (denied) return denied;

  const exists = await db.supplierInvoice.findFirst({
    where: { id: invoiceId, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (!exists) return { error: "Invoice not found" };

  try {
    const outcome = await runThreeWayMatch({ schoolId: ctx.schoolId, supplierInvoiceId: invoiceId });
    await persistMatchOutcome(ctx.schoolId, invoiceId, outcome, ctx.session.user.id);
    await audit({
      userId: ctx.session.user.id,
      action: "UPDATE",
      entity: "ThreeWayMatch",
      entityId: invoiceId,
      module: "inventory",
      description: `Re-ran 3-way match: ${outcome.result}`,
      metadata: {
        priceVariance: outcome.priceVariance,
        quantityVariance: outcome.quantityVariance,
      },
    });
    revalidatePath("/inventory/supplier-invoices");
    return { data: outcome };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Match failed" };
  }
}

export async function approveSupplierInvoiceAction(input: ApproveInvoiceInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUPPLIER_INVOICE_APPROVE);
  if (denied) return denied;
  const parsed = approveInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const invoice = await db.supplierInvoice.findFirst({
    where: { id: data.invoiceId, schoolId: ctx.schoolId },
    include: { matches: { take: 1, orderBy: { updatedAt: "desc" } } },
  });
  if (!invoice) return { error: "Invoice not found" };
  if (invoice.status === "APPROVED" || invoice.status === "PAID") {
    return { error: "Invoice already approved" };
  }
  if (invoice.status === "REJECTED" || invoice.status === "VOIDED") {
    return { error: "Cannot approve a rejected or voided invoice" };
  }

  const latest = invoice.matches[0];
  if (latest && latest.result !== "CLEAN" && !data.override) {
    return {
      error:
        "Match shows variances; approve requires 'override=true' and a justification note.",
    };
  }

  const updated = await db.supplierInvoice.update({
    where: { id: invoice.id },
    data: {
      status: "APPROVED",
      approvedBy: ctx.session.user.id,
      approvedAt: new Date(),
      notes: data.notes ? `${invoice.notes ?? ""}\nApproval: ${data.notes}`.trim() : invoice.notes,
    },
  });

  if (latest) {
    await db.threeWayMatch.update({
      where: { id: latest.id },
      data: {
        reviewedBy: ctx.session.user.id,
        reviewedAt: new Date(),
        reviewNotes: data.notes ?? null,
      },
    });
  }

  await audit({
    userId: ctx.session.user.id,
    action: "APPROVE",
    entity: "SupplierInvoice",
    entityId: invoice.id,
    module: "inventory",
    description: `Approved supplier invoice ${invoice.invoiceNumber}${data.override ? " (override)" : ""}`,
    metadata: { override: data.override, notes: data.notes },
  });

  revalidatePath("/inventory/supplier-invoices");
  return { data: updated };
}

export async function recordInvoicePaymentAction(input: {
  invoiceId: string;
  paymentRef: string;
  paidAt?: Date;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SUPPLIER_INVOICE_PAY);
  if (denied) return denied;

  const invoice = await db.supplierInvoice.findFirst({
    where: { id: input.invoiceId, schoolId: ctx.schoolId },
  });
  if (!invoice) return { error: "Invoice not found" };
  if (invoice.status !== "APPROVED") return { error: "Only approved invoices may be paid" };

  const updated = await db.supplierInvoice.update({
    where: { id: invoice.id },
    data: {
      status: "PAID",
      paidAt: input.paidAt ?? new Date(),
      paymentRef: input.paymentRef,
    },
  });
  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "SupplierInvoice",
    entityId: invoice.id,
    module: "inventory",
    description: `Marked invoice ${invoice.invoiceNumber} as paid (${input.paymentRef})`,
  });
  revalidatePath("/inventory/supplier-invoices");
  return { data: updated };
}
