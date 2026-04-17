import { db } from "@/lib/db";
import { toNum } from "@/lib/decimal";
import type { ThreeWayMatchResult, Prisma } from "@prisma/client";

/**
 * Computes a three-way match between a SupplierInvoice, its PurchaseOrder,
 * and the corresponding GoodsReceived record.
 *
 * Decision tree:
 *   1. If the invoice is not linked to a PO → FAILED (policy: every invoice must cite a PO).
 *   2. If the PO has no GoodsReceived and the tolerance setting requires it → MISSING_GRN.
 *   3. For every invoiced line:
 *        • locate corresponding PO line by purchaseOrderItemId (or by storeItem+unit price fallback)
 *        • compare quantity + unitPrice against both PO and GRN quantities
 *        • accumulate variances
 *   4. If any invoiced item is not on the PO → PO_MISMATCH.
 *   5. Aggregate variances against configured tolerances → CLEAN or PRICE/QUANTITY_VARIANCE.
 *
 * Returns a summary payload ready to persist on the ThreeWayMatch row.
 */

export interface MatchLineSummary {
  description: string;
  invoicedQty: number;
  invoicedUnitPrice: number;
  poQty: number;
  poUnitPrice: number;
  receivedQty: number;
  priceVariance: number;
  quantityVariance: number;
  status: "CLEAN" | "PRICE" | "QUANTITY" | "MISSING_PO" | "MISSING_GRN";
}

export interface MatchOutcome {
  result: ThreeWayMatchResult;
  priceVariance: number;
  quantityVariance: number;
  withinTolerance: boolean;
  lines: MatchLineSummary[];
  goodsReceivedId: string | null;
}

interface RunArgs {
  schoolId: string;
  supplierInvoiceId: string;
}

export async function runThreeWayMatch(args: RunArgs): Promise<MatchOutcome> {
  const invoice = await db.supplierInvoice.findFirst({
    where: { id: args.supplierInvoiceId, schoolId: args.schoolId },
    include: { items: true },
  });
  if (!invoice) throw new Error("Supplier invoice not found");
  if (!invoice.purchaseOrderId) {
    return failedOutcome("FAILED", [], null);
  }

  const tolerance = await db.matchToleranceSetting.findUnique({
    where: { schoolId: args.schoolId },
  });
  const pricePct = tolerance ? toNum(tolerance.priceTolerancePercent) : 0;
  const priceAbs = tolerance ? toNum(tolerance.priceToleranceAbsolute) : 0;
  const qtyPct = tolerance ? toNum(tolerance.quantityTolerancePercent) : 0;
  const requireGrn = tolerance?.requireGoodsReceived ?? true;

  const po = await db.purchaseOrder.findUnique({
    where: { id: invoice.purchaseOrderId },
    include: { items: true, goodsReceived: { include: { items: true }, orderBy: { receivedAt: "desc" } } },
  });
  if (!po) return failedOutcome("FAILED", [], null);

  const latestGrn = po.goodsReceived[0] ?? null;
  if (requireGrn && !latestGrn) {
    return failedOutcome("MISSING_GRN", [], null);
  }

  const receivedMap = new Map<string, number>();
  for (const grn of po.goodsReceived) {
    for (const line of grn.items) {
      receivedMap.set(line.storeItemId, (receivedMap.get(line.storeItemId) ?? 0) + line.quantityReceived);
    }
  }

  const lines: MatchLineSummary[] = [];
  let totalPriceVariance = 0;
  let totalQuantityVariance = 0;
  let hasPoMismatch = false;

  for (const inv of invoice.items) {
    const poItem = inv.purchaseOrderItemId
      ? po.items.find((p) => p.id === inv.purchaseOrderItemId)
      : inv.storeItemId
        ? po.items.find((p) => p.storeItemId === inv.storeItemId)
        : undefined;

    const invQty = toNum(inv.quantity);
    const invPrice = toNum(inv.unitPrice);

    if (!poItem) {
      hasPoMismatch = true;
      lines.push({
        description: inv.description,
        invoicedQty: invQty,
        invoicedUnitPrice: invPrice,
        poQty: 0,
        poUnitPrice: 0,
        receivedQty: inv.storeItemId ? (receivedMap.get(inv.storeItemId) ?? 0) : 0,
        priceVariance: invQty * invPrice,
        quantityVariance: invQty,
        status: "MISSING_PO",
      });
      continue;
    }

    const poQty = poItem.quantity;
    const poPrice = toNum(poItem.unitPrice);
    const recvQty = receivedMap.get(poItem.storeItemId) ?? 0;

    const priceVar = (invPrice - poPrice) * invQty;
    // compare invoice qty against received qty (preferred) or PO qty (fallback)
    const baselineQty = latestGrn ? recvQty : poQty;
    const qtyVar = invQty - baselineQty;

    const priceOutside =
      Math.abs(priceVar) > priceAbs &&
      Math.abs((invPrice - poPrice) / (poPrice || 1)) * 100 > pricePct;
    const qtyOutside =
      Math.abs(qtyVar / (baselineQty || 1)) * 100 > qtyPct;

    totalPriceVariance += priceVar;
    totalQuantityVariance += qtyVar;

    lines.push({
      description: inv.description,
      invoicedQty: invQty,
      invoicedUnitPrice: invPrice,
      poQty,
      poUnitPrice: poPrice,
      receivedQty: recvQty,
      priceVariance: round2(priceVar),
      quantityVariance: round4(qtyVar),
      status: priceOutside ? "PRICE" : qtyOutside ? "QUANTITY" : "CLEAN",
    });
  }

  let result: ThreeWayMatchResult = "CLEAN";
  if (hasPoMismatch) result = "PO_MISMATCH";
  else if (lines.some((l) => l.status === "PRICE")) result = "PRICE_VARIANCE";
  else if (lines.some((l) => l.status === "QUANTITY")) result = "QUANTITY_VARIANCE";

  const withinTolerance =
    result === "CLEAN" ||
    (result === "PRICE_VARIANCE" &&
      Math.abs(totalPriceVariance) <= priceAbs &&
      pricePct >= 100) ||
    false;

  return {
    result,
    priceVariance: round2(totalPriceVariance),
    quantityVariance: round4(totalQuantityVariance),
    withinTolerance,
    lines,
    goodsReceivedId: latestGrn?.id ?? null,
  };
}

function failedOutcome(
  result: ThreeWayMatchResult,
  lines: MatchLineSummary[],
  grnId: string | null,
): MatchOutcome {
  return {
    result,
    priceVariance: 0,
    quantityVariance: 0,
    withinTolerance: false,
    lines,
    goodsReceivedId: grnId,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/**
 * Persists the match outcome, updates the invoice status, and optionally
 * auto-approves when the tolerance setting allows.
 */
export async function persistMatchOutcome(
  schoolId: string,
  supplierInvoiceId: string,
  outcome: MatchOutcome,
  reviewedBy?: string,
): Promise<void> {
  const invoice = await db.supplierInvoice.findFirst({
    where: { id: supplierInvoiceId, schoolId },
    select: { id: true, purchaseOrderId: true },
  });
  if (!invoice || !invoice.purchaseOrderId) return;

  const tolerance = await db.matchToleranceSetting.findUnique({
    where: { schoolId },
  });

  const summaryJson = outcome.lines as unknown as Prisma.InputJsonValue;

  await db.threeWayMatch.upsert({
    where: {
      supplierInvoiceId_purchaseOrderId: {
        supplierInvoiceId,
        purchaseOrderId: invoice.purchaseOrderId,
      },
    },
    create: {
      schoolId,
      supplierInvoiceId,
      purchaseOrderId: invoice.purchaseOrderId,
      goodsReceivedId: outcome.goodsReceivedId,
      result: outcome.result,
      priceVariance: outcome.priceVariance,
      quantityVariance: outcome.quantityVariance,
      withinTolerance: outcome.withinTolerance,
      autoApproved: !!(outcome.result === "CLEAN" && tolerance?.autoApproveClean),
      summary: summaryJson,
      reviewedBy: reviewedBy ?? null,
      reviewedAt: reviewedBy ? new Date() : null,
    },
    update: {
      goodsReceivedId: outcome.goodsReceivedId,
      result: outcome.result,
      priceVariance: outcome.priceVariance,
      quantityVariance: outcome.quantityVariance,
      withinTolerance: outcome.withinTolerance,
      autoApproved: !!(outcome.result === "CLEAN" && tolerance?.autoApproveClean),
      summary: summaryJson,
      reviewedBy: reviewedBy ?? undefined,
      reviewedAt: reviewedBy ? new Date() : undefined,
    },
  });

  const nextStatus =
    outcome.result === "CLEAN"
      ? tolerance?.autoApproveClean
        ? "APPROVED"
        : "MATCHED"
      : "VARIANCE";

  await db.supplierInvoice.update({
    where: { id: supplierInvoiceId },
    data: {
      status: nextStatus,
      approvedBy: nextStatus === "APPROVED" ? reviewedBy ?? "system:auto-match" : undefined,
      approvedAt: nextStatus === "APPROVED" ? new Date() : undefined,
    },
  });
}
