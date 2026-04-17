import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payment/registry";
import { reconcileWebhookPayment } from "@/lib/payment/reconcile";
import { logger } from "@/lib/logger";

const log = logger.child({ webhook: "mtn-momo" });

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-callback-signature") || "";
    const provider = getPaymentProvider("mtn_momo");
    if (!provider) return NextResponse.json({ error: "Provider not configured" }, { status: 500 });

    if (!provider.verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);
    if (event.status !== "SUCCESSFUL") {
      return NextResponse.json({ received: true, ignored: event.status });
    }

    const data = event as {
      externalId: string;
      amount: string;
      currency: string;
      financialTransactionId?: string;
      payer?: { partyId?: string };
    };

    const verified = await provider.verifyPayment(data.externalId);
    if (!verified.success) {
      log.error("re-verification failed", { reference: data.externalId });
      return NextResponse.json({ error: "verification failed" }, { status: 400 });
    }

    const amount = provider.fromSmallestUnit(verified.amount ?? 0);
    const result = await reconcileWebhookPayment({
      reference: data.externalId,
      amount,
      currency: verified.currency ?? data.currency,
      channel: "mobile_money",
      providerName: provider.name,
      providerDisplayName: provider.displayName,
      providerReference: data.financialTransactionId ?? verified.reference ?? null,
      paymentMethod: "MOBILE_MONEY",
      notes: `MTN MoMo payment (${data.payer?.partyId ?? "unknown"})`,
    });
    return NextResponse.json({ received: true, outcome: result.outcome });
  } catch (err) {
    log.error("webhook error", { err: err instanceof Error ? err.message : err });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
