import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payment/registry";
import { db } from "@/lib/db";
import { generateOnlineReceiptNumber } from "@/lib/receipt";
import { toNum } from "@/lib/decimal";

/**
 * MTN Mobile Money Webhook Handler
 * Receives payment callback notifications from MTN MoMo Collections API.
 * Endpoint: POST /api/webhooks/mtn-momo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-callback-signature") || "";
    const provider = getPaymentProvider("mtn_momo")!;

    if (!provider.verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.status === "SUCCESSFUL") {
      await handleSuccessfulPayment(event);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[MTN MoMo Webhook] Error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handleSuccessfulPayment(data: {
  externalId: string;
  amount: string;
  currency: string;
  financialTransactionId?: string;
  payer?: { partyId: string };
}) {
  const reference = data.externalId;
  const provider = getPaymentProvider("mtn_momo")!;

  // Look up the online payment transaction
  const onlineTxn = await db.onlinePaymentTransaction.findUnique({
    where: { reference },
  });

  if (!onlineTxn) {
    console.warn(`[MTN MoMo Webhook] No transaction found for reference ${reference}`);
    return;
  }

  if (onlineTxn.status === "SUCCESSFUL") {
    return; // Idempotency: already processed
  }

  const verified = await provider.verifyPayment(reference);
  if (!verified.success) {
    console.error(`[MTN MoMo Webhook] Verification failed for ${reference}`);
    return;
  }

  const amount = provider.fromSmallestUnit(verified.amount ?? 0);

  await db.$transaction(async (tx) => {
    // Update online transaction status
    await tx.onlinePaymentTransaction.update({
      where: { reference },
      data: {
        status: "SUCCESSFUL",
        providerReference: data.financialTransactionId,
        channel: "mobile_money",
        completedAt: new Date(),
      },
    });

    // Create payment record
    const bill = await tx.studentBill.findUnique({ where: { id: onlineTxn.studentBillId } });
    if (!bill) return;

    const payment = await tx.payment.create({
      data: {
        schoolId: bill.schoolId,
        studentBillId: bill.id,
        studentId: onlineTxn.studentId,
        amount,
        paymentMethod: "MOBILE_MONEY",
        referenceNumber: reference,
        receivedBy: "system",
        notes: `MTN MoMo payment (${data.payer?.partyId ?? "unknown"})`,
      },
    });

    // Generate receipt
    const receiptNumber = await generateOnlineReceiptNumber(tx);

    await tx.receipt.create({
      data: {
        schoolId: bill.schoolId,
        paymentId: payment.id,
        receiptNumber,
      },
    });

    // Update bill amounts
    const newPaidAmount = toNum(bill.paidAmount) + amount;
    const newBalance = toNum(bill.totalAmount) - newPaidAmount;

    await tx.studentBill.update({
      where: { id: bill.id },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: Math.max(0, newBalance),
        status: newBalance <= 0 ? (newBalance < 0 ? "OVERPAID" : "PAID") : newPaidAmount > 0 ? "PARTIAL" : "UNPAID",
      },
    });
  });
}
