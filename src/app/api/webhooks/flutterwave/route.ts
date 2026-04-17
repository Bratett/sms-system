import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payment/registry";
import { db } from "@/lib/db";
import { reconcileWebhookPayment } from "@/lib/payment/reconcile";
import { logger } from "@/lib/logger";

const log = logger.child({ webhook: "flutterwave" });

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("verif-hash") || "";
    const provider = getPaymentProvider("flutterwave");
    if (!provider) return NextResponse.json({ error: "Provider not configured" }, { status: 500 });

    if (!provider.verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);
    if (event.event !== "charge.completed" || event.data?.status !== "successful") {
      return NextResponse.json({ received: true, ignored: event.event });
    }

    const data = event.data as {
      tx_ref: string;
      amount: number;
      currency: string;
      payment_type: string;
      meta?: { studentBillId?: string; studentId?: string; schoolId?: string };
    };

    const verified = await provider.verifyPayment(data.tx_ref);
    if (!verified.success) {
      log.error("re-verification failed", { reference: data.tx_ref });
      return NextResponse.json({ error: "verification failed" }, { status: 400 });
    }

    await ensureTransactionRow(data, provider.name, provider.toSmallestUnit(data.amount));

    const amount = provider.fromSmallestUnit(verified.amount ?? provider.toSmallestUnit(data.amount));
    const result = await reconcileWebhookPayment({
      reference: data.tx_ref,
      amount,
      currency: verified.currency ?? data.currency,
      channel: verified.channel ?? data.payment_type,
      providerName: provider.name,
      providerDisplayName: provider.displayName,
      providerReference: verified.reference ?? null,
      paymentMethod: provider.mapChannel(data.payment_type),
    });

    return NextResponse.json({ received: true, outcome: result.outcome });
  } catch (err) {
    log.error("webhook error", { err: err instanceof Error ? err.message : err });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function ensureTransactionRow(
  data: {
    tx_ref: string;
    amount: number;
    currency: string;
    meta?: { studentBillId?: string; studentId?: string; schoolId?: string };
  },
  providerName: string,
  amountSmallestUnit: number,
): Promise<void> {
  const existing = await db.onlinePaymentTransaction.findUnique({
    where: { reference: data.tx_ref },
  });
  if (existing) return;
  if (!data.meta?.studentBillId || !data.meta?.studentId || !data.meta?.schoolId) {
    log.warn("cannot backfill: missing meta", { reference: data.tx_ref });
    return;
  }
  await db.onlinePaymentTransaction.create({
    data: {
      schoolId: data.meta.schoolId,
      studentBillId: data.meta.studentBillId,
      studentId: data.meta.studentId,
      provider: providerName,
      reference: data.tx_ref,
      amount: amountSmallestUnit / 100,
      currency: data.currency,
      status: "PENDING",
      metadata: { origin: "webhook-backfill" },
    },
  });
}
