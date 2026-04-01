import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payment/registry";
import { db } from "@/lib/db";
import { generateOnlineReceiptNumber } from "@/lib/receipt";
import { toNum } from "@/lib/decimal";

/**
 * AirtelTigo Money Webhook Handler
 * Endpoint: POST /api/webhooks/airteltigo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-webhook-signature") || "";
    const provider = getPaymentProvider("airteltigo")!;

    if (!provider.verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.status === "SUCCESSFUL") {
      await handleSuccessfulPayment(event);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[AirtelTigo Webhook] Error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handleSuccessfulPayment(data: {
  reference: string;
  amount: number;
  transactionId?: string;
}) {
  const provider = getPaymentProvider("airteltigo")!;

  const onlineTxn = await db.onlinePaymentTransaction.findUnique({
    where: { reference: data.reference },
  });

  if (!onlineTxn || onlineTxn.status === "SUCCESSFUL") return;

  const verified = await provider.verifyPayment(data.reference);
  if (!verified.success) return;

  const amount = provider.fromSmallestUnit(verified.amount ?? 0);

  await db.$transaction(async (tx) => {
    await tx.onlinePaymentTransaction.update({
      where: { reference: data.reference },
      data: {
        status: "SUCCESSFUL",
        providerReference: data.transactionId,
        channel: "mobile_money",
        completedAt: new Date(),
      },
    });

    const bill = await tx.studentBill.findUnique({ where: { id: onlineTxn.studentBillId } });
    if (!bill) return;

    const payment = await tx.payment.create({
      data: {
        studentBillId: bill.id,
        studentId: onlineTxn.studentId,
        amount,
        paymentMethod: "MOBILE_MONEY",
        referenceNumber: data.reference,
        receivedBy: "system",
        notes: "AirtelTigo Money payment",
      },
    });

    const receiptNumber = await generateOnlineReceiptNumber(tx);
    await tx.receipt.create({
      data: {
        paymentId: payment.id,
        receiptNumber,
      },
    });

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
