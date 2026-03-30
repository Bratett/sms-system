import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payment/registry";
import { db } from "@/lib/db";

/**
 * Paystack Webhook Handler
 * Receives payment events from Paystack and updates the system accordingly.
 * Endpoint: POST /api/webhooks/paystack
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-paystack-signature") || "";
    const provider = getPaymentProvider("paystack")!;

    if (!provider.verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.event === "charge.success") {
      await handleChargeSuccess(event.data);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Paystack Webhook] Error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handleChargeSuccess(data: {
  reference: string;
  amount: number;
  currency: string;
  channel: string;
  paid_at: string;
  metadata?: {
    studentBillId?: string;
    studentId?: string;
    schoolId?: string;
    provider?: string;
  };
}) {
  const { reference, metadata } = data;
  const provider = getPaymentProvider("paystack")!;

  if (!metadata?.studentBillId) {
    console.warn(`[Paystack Webhook] No studentBillId in metadata for reference ${reference}`);
    return;
  }

  // Verify the payment with the provider
  const verified = await provider.verifyPayment(reference);
  if (!verified.success) {
    console.error(`[Paystack Webhook] Payment verification failed for ${reference}`);
    return;
  }

  const amount = provider.fromSmallestUnit(verified.amount || data.amount);

  // Idempotency check
  const existingPayment = await db.payment.findFirst({
    where: { referenceNumber: reference },
  });

  if (existingPayment) {
    console.log(`[Paystack Webhook] Payment ${reference} already processed`);
    return;
  }

  const bill = await db.studentBill.findUnique({
    where: { id: metadata.studentBillId },
  });

  if (!bill) {
    console.error(`[Paystack Webhook] Bill ${metadata.studentBillId} not found`);
    return;
  }

  const paymentMethod = provider.mapChannel(verified.channel || data.channel);

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
        notes: `Online payment via ${provider.displayName} (${verified.channel || data.channel})`,
      },
    });

    const newPaidAmount = bill.paidAmount + amount;
    const newBalanceAmount = bill.totalAmount - newPaidAmount;

    let newStatus: "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID";
    if (newBalanceAmount <= 0 && newPaidAmount > bill.totalAmount) {
      newStatus = "OVERPAID";
    } else if (newBalanceAmount <= 0) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIAL";
    } else {
      newStatus = "UNPAID";
    }

    await tx.studentBill.update({
      where: { id: bill.id },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: Math.max(0, newBalanceAmount),
        status: newStatus,
      },
    });

    const year = new Date().getFullYear();
    const count = await tx.receipt.count({
      where: { receiptNumber: { startsWith: `RCP/${year}/` } },
    });
    const receiptNumber = `RCP/${year}/ON/${String(count + 1).padStart(4, "0")}`;

    await tx.receipt.create({
      data: {
        paymentId: payment.id,
        receiptNumber,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: "system",
        action: "CREATE",
        entity: "Payment",
        entityId: payment.id,
        module: "finance",
        description: `Online payment ${verified.currency || "GHS"} ${amount.toFixed(2)} via ${provider.displayName} (${reference})`,
        newData: { paymentId: payment.id, reference, amount },
      },
    });
  });

  console.log(`[Paystack Webhook] Payment processed: ${reference}, ${amount}`);
}
