import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { parseInvoiceText } from "@/lib/inventory/invoice-parser";
import { logger } from "@/lib/logger";
import { runThreeWayMatch, persistMatchOutcome } from "@/lib/inventory/three-way-match";

const log = logger.child({ route: "invoice-intake" });

/**
 * POST /api/inventory/invoice-intake
 *
 * Public-ish endpoint called by external mail forwarders (Mailgun Routes,
 * SendGrid Inbound Parse, Cloudflare Email Workers) or document-scan
 * services. The caller must present a shared-secret HMAC — we never
 * accept unauthenticated invoice bodies because the resulting
 * SupplierInvoice row is trusted by 3-way-match and payment authorisation.
 *
 * Body:
 *   {
 *     "schoolId": "cuid",
 *     "supplierId": "cuid",          // operator preconfigures mailbox→supplier map
 *     "purchaseOrderId": "cuid|null",
 *     "raw": "…pre-extracted plain text…",
 *     "autoApproveClean": true
 *   }
 *
 * The header `x-intake-signature` is HMAC-SHA256(body, INVENTORY_INTAKE_SECRET).
 *
 * Response:
 *   { ok: true, invoiceId, confidence, warnings }
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.INVENTORY_INTAKE_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Intake not configured" }, { status: 503 });
    }

    const body = await request.text();
    const sig = request.headers.get("x-intake-signature") || "";
    if (!verifySignature(body, sig, secret)) {
      log.warn("intake signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(body) as {
      schoolId?: string;
      supplierId?: string;
      purchaseOrderId?: string | null;
      raw?: string;
      autoApproveClean?: boolean;
    };
    if (!payload.schoolId || !payload.supplierId || !payload.raw) {
      return NextResponse.json(
        { error: "Missing required fields (schoolId, supplierId, raw)" },
        { status: 400 },
      );
    }

    const supplier = await db.supplier.findFirst({
      where: { id: payload.supplierId, schoolId: payload.schoolId },
    });
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    const parsed = parseInvoiceText(payload.raw);
    if (!parsed.invoiceNumber || !parsed.invoiceDate || !parsed.totalAmount) {
      return NextResponse.json(
        {
          error:
            "Unable to parse required fields — the forwarded body lacks invoice number, date, or total.",
          parsed,
        },
        { status: 422 },
      );
    }

    const duplicate = await db.supplierInvoice.findUnique({
      where: {
        supplierId_invoiceNumber: {
          supplierId: supplier.id,
          invoiceNumber: parsed.invoiceNumber,
        },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { ok: false, duplicate: true, invoiceId: duplicate.id },
        { status: 200 },
      );
    }

    const subTotal = parsed.subTotal ?? parsed.totalAmount - (parsed.taxAmount ?? 0);
    const taxAmount = parsed.taxAmount ?? 0;

    const created = await db.$transaction(async (tx) => {
      const invoice = await tx.supplierInvoice.create({
        data: {
          schoolId: payload.schoolId!,
          supplierId: supplier.id,
          purchaseOrderId: payload.purchaseOrderId ?? null,
          invoiceNumber: parsed.invoiceNumber!,
          invoiceDate: parsed.invoiceDate!,
          dueDate: parsed.dueDate,
          subTotal,
          taxAmount,
          totalAmount: parsed.totalAmount!,
          currency: parsed.currency,
          status: "RECEIVED",
          notes: `Inbound intake (confidence ${parsed.confidence.toFixed(2)})`,
          receivedBy: "system:intake",
        },
      });
      if (parsed.items.length > 0) {
        await tx.supplierInvoiceItem.createMany({
          data: parsed.items.map((i) => ({
            supplierInvoiceId: invoice.id,
            schoolId: payload.schoolId!,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
          })),
        });
      }
      return invoice;
    });

    if (created.purchaseOrderId) {
      try {
        const outcome = await runThreeWayMatch({
          schoolId: payload.schoolId,
          supplierInvoiceId: created.id,
        });
        await persistMatchOutcome(payload.schoolId, created.id, outcome);
      } catch (err) {
        log.error("intake match failed", { invoiceId: created.id, err });
      }
    }

    log.info("intake invoice captured", {
      invoiceId: created.id,
      supplierId: supplier.id,
      confidence: parsed.confidence,
    });

    return NextResponse.json({
      ok: true,
      invoiceId: created.id,
      confidence: parsed.confidence,
      warnings: parsed.warnings,
    });
  } catch (err) {
    log.error("intake error", { err: err instanceof Error ? err.message : err });
    return NextResponse.json({ error: "Intake failed" }, { status: 500 });
  }
}

function verifySignature(body: string, sig: string, secret: string): boolean {
  if (!sig) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
