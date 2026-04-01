import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payment/registry";
import { db } from "@/lib/db";
import { generateOnlineReceiptNumber } from "@/lib/receipt";
import { toNum } from "@/lib/decimal";

/**
 * Flutterwave Webhook Handler
 * Endpoint: POST /api/webhooks/flutterwave
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("verif-hash") || "";
    const provider = getPaymentProvider("flutterwave")!;

    if (!provider.verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.event === "charge.completed" && event.data.status === "successful") {
      await handleChargeCompleted(event.data);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Flutterwave Webhook] Error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handleChargeCompleted(data: {
  tx_ref: string;
  amount: number;
  currency: string;
  payment_type: string;
  created_at: string;
  meta?: {
    studentBillId?: string;
    studentId?: string;
    schoolId?: string;
  };
}) {
  const reference = data.tx_ref;
  const provider = getPaymentProvider("flutterwave")!;

  const metadata = data.meta;
  if (!metadata?.studentBillId) {
    console.warn(`[Flutterwave Webhook] No studentBillId in meta for ref ${reference}`);
    return;
  }

  // Verify with Flutterwave
  const verified = await provider.verifyPayment(reference);
  if (!verified.success) {
    console.error(`[Flutterwave Webhook] Verification failed for ${reference}`);
    return;
  }

  const amount = provider.fromSmallestUnit(verified.amount || provider.toSmallestUnit(data.amount));

  // Idempotency check
  const existing = await db.payment.findFirst({ where: { referenceNumber: reference } });
  if (existing) return;

  const bill = await db.studentBill.findUnique({ where: { id: metadata.studentBillId } });
  if (!bill) return;

  const paymentMethod = provider.mapChannel(data.payment_type);

  await db.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        studentBillId: bill.id,
        studentId: bill.studentId,
        amount,
        paymentMethod,
        referenceNumber: reference,
        receivedBy: "system",
        status: "CONFIRMED",
        notes: `Online payment via ${provider.displayName} (${data.payment_type})`,
      },
    });

    const newPaidAmount = toNum(bill.paidAmount) + amount;
    const newBalanceAmount = toNum(bill.totalAmount) - newPaidAmount;

    let newStatus: "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID";
    if (newBalanceAmount <= 0 && newPaidAmount > toNum(bill.totalAmount)) newStatus = "OVERPAID";
    else if (newBalanceAmount <= 0) newStatus = "PAID";
    else if (newPaidAmount > 0) newStatus = "PARTIAL";
    else newStatus = "UNPAID";

    await tx.studentBill.update({
      where: { id: bill.id },
      data: { paidAmount: newPaidAmount, balanceAmount: Math.max(0, newBalanceAmount), status: newStatus },
    });

    const receiptNumber = await generateOnlineReceiptNumber(tx);
    await tx.receipt.create({
      data: { paymentId: payment.id, receiptNumber },
    });

    await tx.auditLog.create({
      data: {
        userId: "system",
        action: "CREATE",
        entity: "Payment",
        entityId: payment.id,
        module: "finance",
        description: `Online payment ${data.currency} ${amount.toFixed(2)} via Flutterwave (${reference})`,
        newData: { paymentId: payment.id, reference, amount },
      },
    });
  });
}
