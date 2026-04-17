import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payment/registry";
import { db } from "@/lib/db";
import { reconcileWebhookPayment } from "@/lib/payment/reconcile";
import { logger } from "@/lib/logger";

const log = logger.child({ webhook: "paystack" });

/**
 * Paystack webhook.
 * Endpoint: POST /api/webhooks/paystack
 *
 * Decodes the event, verifies the signature, ensures an OnlinePaymentTransaction
 * row exists (backfilling one from event.metadata when the payment was
 * dashboard-initiated and skipped the portal), and hands over to the shared
 * reconciliation helper for the actual DB work.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-paystack-signature") || "";
    const provider = getPaymentProvider("paystack");
    if (!provider) return NextResponse.json({ error: "Provider not configured" }, { status: 500 });

    if (!provider.verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);
    if (event.event !== "charge.success") {
      return NextResponse.json({ received: true, ignored: event.event });
    }

    const data = event.data as {
      reference: string;
      amount: number;
      currency: string;
      channel: string;
      metadata?: { studentBillId?: string; studentId?: string; schoolId?: string };
    };

    // Re-verify with Paystack before acting.
    const verified = await provider.verifyPayment(data.reference);
    if (!verified.success) {
      log.error("re-verification failed", { reference: data.reference });
      return NextResponse.json({ error: "verification failed" }, { status: 400 });
    }

    // Ensure an OnlinePaymentTransaction row exists (dashboard-initiated
    // payments may not have one).
    await ensureTransactionRow(data, provider.name);

    const amount = provider.fromSmallestUnit(verified.amount ?? data.amount);
    const result = await reconcileWebhookPayment({
      reference: data.reference,
      amount,
      currency: verified.currency ?? data.currency,
      channel: verified.channel ?? data.channel,
      providerName: provider.name,
      providerDisplayName: provider.displayName,
      providerReference: verified.reference ?? null,
      paymentMethod: provider.mapChannel(verified.channel ?? data.channel),
    });

    return NextResponse.json({ received: true, outcome: result.outcome });
  } catch (err) {
    log.error("webhook error", { err: err instanceof Error ? err.message : err });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function ensureTransactionRow(
  data: {
    reference: string;
    amount: number;
    currency: string;
    metadata?: { studentBillId?: string; studentId?: string; schoolId?: string };
  },
  providerName: string,
): Promise<void> {
  const existing = await db.onlinePaymentTransaction.findUnique({
    where: { reference: data.reference },
  });
  if (existing) return;

  if (!data.metadata?.studentBillId || !data.metadata?.studentId || !data.metadata?.schoolId) {
    log.warn("cannot backfill transaction row: missing metadata", { reference: data.reference });
    return;
  }

  await db.onlinePaymentTransaction.create({
    data: {
      schoolId: data.metadata.schoolId,
      studentBillId: data.metadata.studentBillId,
      studentId: data.metadata.studentId,
      provider: providerName,
      reference: data.reference,
      amount: data.amount / 100,
      currency: data.currency,
      status: "PENDING",
      metadata: { origin: "webhook-backfill" },
    },
  });
}
