import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payment/registry";
import { reconcileWebhookPayment } from "@/lib/payment/reconcile";
import { logger } from "@/lib/logger";

const log = logger.child({ webhook: "telecel-cash" });

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-webhook-signature") || "";
    const provider = getPaymentProvider("telecel_cash");
    if (!provider) return NextResponse.json({ error: "Provider not configured" }, { status: 500 });

    if (!provider.verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);
    if (event.status !== "SUCCESSFUL" && event.status !== "COMPLETED") {
      return NextResponse.json({ received: true, ignored: event.status });
    }

    const data = event as {
      reference: string;
      amount: number;
      transactionId?: string;
    };
    const verified = await provider.verifyPayment(data.reference);
    if (!verified.success) {
      log.error("re-verification failed", { reference: data.reference });
      return NextResponse.json({ error: "verification failed" }, { status: 400 });
    }

    const amount = provider.fromSmallestUnit(verified.amount ?? 0);
    const result = await reconcileWebhookPayment({
      reference: data.reference,
      amount,
      currency: verified.currency,
      channel: "mobile_money",
      providerName: provider.name,
      providerDisplayName: provider.displayName,
      providerReference: data.transactionId ?? verified.reference ?? null,
      paymentMethod: "MOBILE_MONEY",
      notes: "Telecel Cash payment",
    });
    return NextResponse.json({ received: true, outcome: result.outcome });
  } catch (err) {
    log.error("webhook error", { err: err instanceof Error ? err.message : err });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
