"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { initializePayment, verifyPayment } from "@/lib/payment/paystack";

// ─── Initiate Online Payment ───────────────────────────────────────

export async function initiateOnlinePaymentAction(data: {
  studentBillId: string;
  amount: number;
  email: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  if (data.amount <= 0) return { error: "Amount must be greater than zero" };

  const bill = await db.studentBill.findUnique({
    where: { id: data.studentBillId },
  });

  if (!bill) return { error: "Bill not found" };

  if (bill.status === "PAID" || bill.status === "OVERPAID") {
    return { error: "This bill is already fully paid" };
  }

  if (data.amount > bill.balanceAmount) {
    return { error: `Amount exceeds outstanding balance of GHS ${bill.balanceAmount.toFixed(2)}` };
  }

  // Generate unique reference
  const reference = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const result = await initializePayment({
    email: data.email,
    amount: Math.round(data.amount * 100), // Convert GHS to pesewas
    currency: "GHS",
    reference,
    callbackUrl: `${baseUrl}/parent/fees?payment=success&ref=${reference}`,
    metadata: {
      studentBillId: bill.id,
      studentId: bill.studentId,
      schoolId: school.id,
      custom_fields: [
        { display_name: "School", variable_name: "school", value: school.name },
        { display_name: "Bill ID", variable_name: "bill_id", value: bill.id },
      ],
    },
    channels: ["mobile_money", "card"],
  });

  if (!result.success) {
    return { error: result.error || "Failed to initialize payment" };
  }

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Payment",
    module: "finance",
    description: `Initiated online payment of GHS ${data.amount.toFixed(2)} via Paystack. Ref: ${reference}`,
    metadata: { reference, amount: data.amount, studentBillId: bill.id },
  });

  return {
    data: {
      authorizationUrl: result.authorizationUrl,
      accessCode: result.accessCode,
      reference: result.reference,
    },
  };
}

// ─── Verify Online Payment (callback handler) ──────────────────────

export async function verifyOnlinePaymentAction(reference: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const result = await verifyPayment(reference);

  if (result.success) {
    return {
      data: {
        status: "success",
        amount: (result.amount || 0) / 100, // Convert pesewas to GHS
        reference: result.reference,
        channel: result.channel,
        paidAt: result.paidAt,
      },
    };
  }

  return {
    data: {
      status: result.status || "failed",
      reference,
      error: result.error,
    },
  };
}
