import { db } from "@/lib/db";
import { toNum } from "@/lib/decimal";
import { generateOnlineReceiptNumber } from "@/lib/receipt";
import { logger } from "@/lib/logger";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import type { PaymentMethod } from "@prisma/client";

const log = logger.child({ mod: "payment-reconcile" });

export interface ReconcileInput {
  reference: string;
  amount: number; // already in major units (GHS)
  currency?: string;
  channel?: string | null;
  providerName: string;
  providerDisplayName: string;
  providerReference?: string | null;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface ReconcileResult {
  outcome:
    | "applied"
    | "already-applied"
    | "bill-missing"
    | "transaction-missing";
  paymentId?: string;
  receiptNumber?: string;
  billId?: string;
  studentId?: string;
  schoolId?: string;
  newBalance?: number;
}

/**
 * Single point of truth for webhook-driven payment reconciliation.
 *
 * Guarantees, in order:
 *   1. Idempotent — a second call with the same `reference` is a no-op.
 *   2. Atomic — Payment + Receipt + StudentBill update + OnlinePaymentTransaction
 *      flip into SUCCESSFUL happen in the same DB transaction.
 *   3. Fail-open notifications — PAYMENT_RECEIVED dispatch + dunning-case
 *      resolution run outside the tx so a notifier outage never dangles a
 *      payment.
 *
 * The webhook route is responsible for verifying the provider signature and
 * (ideally) re-verifying the transaction with the provider before calling
 * here. That separation keeps provider-specific decoding out of this module.
 */
export async function reconcileWebhookPayment(
  input: ReconcileInput,
): Promise<ReconcileResult> {
  // 1. Short-circuit idempotency via OnlinePaymentTransaction (portal flow)
  //    OR via Payment.referenceNumber (dashboard-initiated flow).
  const existingPayment = await db.payment.findFirst({
    where: { referenceNumber: input.reference },
    select: { id: true },
  });
  if (existingPayment) {
    return { outcome: "already-applied", paymentId: existingPayment.id };
  }

  const onlineTxn = await db.onlinePaymentTransaction.findUnique({
    where: { reference: input.reference },
  });

  // No txn row *and* no payment → we don't know which bill. Providers SHOULD
  // attach metadata.studentBillId but not all do; caller should have resolved
  // the bill and filled `onlineTxn` via metadata fallback before calling here.
  if (!onlineTxn) {
    return { outcome: "transaction-missing" };
  }

  const bill = await db.studentBill.findUnique({
    where: { id: onlineTxn.studentBillId },
  });
  if (!bill) {
    log.warn("webhook references missing bill", {
      reference: input.reference,
      billId: onlineTxn.studentBillId,
    });
    return { outcome: "bill-missing" };
  }

  let paymentId = "";
  let receiptNumber = "";
  let newBalance = 0;

  await db.$transaction(async (tx) => {
    // Atomic: create payment, receipt, update bill, flip txn status.
    const payment = await tx.payment.create({
      data: {
        schoolId: bill.schoolId,
        studentBillId: bill.id,
        studentId: bill.studentId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        referenceNumber: input.reference,
        receivedBy: "system",
        status: "CONFIRMED",
        notes:
          input.notes ??
          `Online payment via ${input.providerDisplayName} (${input.channel ?? "unknown channel"})`,
      },
    });

    const number = await generateOnlineReceiptNumber(tx, bill.schoolId);
    const receipt = await tx.receipt.create({
      data: { schoolId: bill.schoolId, paymentId: payment.id, receiptNumber: number },
    });

    const newPaid = toNum(bill.paidAmount) + input.amount;
    const balance = toNum(bill.totalAmount) - newPaid;
    const status: "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID" =
      balance < 0 ? "OVERPAID" : balance === 0 ? "PAID" : newPaid > 0 ? "PARTIAL" : "UNPAID";

    await tx.studentBill.update({
      where: { id: bill.id },
      data: {
        paidAmount: newPaid,
        balanceAmount: Math.max(balance, 0),
        status,
      },
    });

    await tx.onlinePaymentTransaction.update({
      where: { reference: input.reference },
      data: {
        status: "SUCCESSFUL",
        providerReference: input.providerReference ?? undefined,
        channel: input.channel ?? undefined,
        completedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: "system",
        action: "CREATE",
        entity: "Payment",
        entityId: payment.id,
        module: "finance",
        description: `Webhook payment ${(input.currency ?? "GHS")} ${input.amount.toFixed(2)} via ${input.providerDisplayName} (${input.reference})`,
        newData: { paymentId: payment.id, reference: input.reference, amount: input.amount },
      },
    });

    paymentId = payment.id;
    receiptNumber = receipt.receiptNumber;
    newBalance = Math.max(balance, 0);
  });

  // 2. Post-transaction side-effects — ordered by priority, wrapped so one
  //    failure never undoes the applied payment.
  try {
    await resolveDunningIfPaid(bill.id);
  } catch (err) {
    log.error("dunning auto-resolve failed", { reference: input.reference, err });
  }

  try {
    await notifyGuardian({
      schoolId: bill.schoolId,
      studentId: bill.studentId,
      amount: input.amount,
      receiptNumber,
      newBalance,
    });
  } catch (err) {
    log.error("payment-received notification failed", { reference: input.reference, err });
  }

  log.info("webhook payment reconciled", {
    provider: input.providerName,
    reference: input.reference,
    amount: input.amount,
    billId: bill.id,
  });

  return {
    outcome: "applied",
    paymentId,
    receiptNumber,
    billId: bill.id,
    studentId: bill.studentId,
    schoolId: bill.schoolId,
    newBalance,
  };
}

async function resolveDunningIfPaid(billId: string): Promise<void> {
  const bill = await db.studentBill.findUnique({ where: { id: billId } });
  if (!bill) return;
  const balance = toNum(bill.balanceAmount);
  if (balance > 0) return;
  // Close every OPEN/ESCALATED/PAUSED case tied to this bill across all
  // policies — the underlying bill is now fully settled.
  await db.dunningCase.updateMany({
    where: {
      studentBillId: billId,
      status: { in: ["OPEN", "ESCALATED", "PAUSED"] },
    },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolution: "PAID",
    },
  });
}

async function notifyGuardian(args: {
  schoolId: string;
  studentId: string;
  amount: number;
  receiptNumber: string;
  newBalance: number;
}): Promise<void> {
  const student = await db.student.findUnique({
    where: { id: args.studentId },
    select: {
      firstName: true,
      lastName: true,
      guardians: {
        where: { isPrimary: true },
        select: {
          guardian: { select: { id: true, firstName: true, phone: true, email: true } },
        },
        take: 1,
      },
    },
  });
  const guardian = student?.guardians[0]?.guardian;
  if (!guardian) return;
  await dispatch({
    event: NOTIFICATION_EVENTS.PAYMENT_RECEIVED,
    title: "Payment received",
    message:
      `Dear ${guardian.firstName ?? "parent"}, we've received GHS ${args.amount.toFixed(2)} ` +
      `towards ${student?.firstName ?? "your ward"}'s school fees. ` +
      `Receipt: ${args.receiptNumber}. Outstanding balance: GHS ${args.newBalance.toFixed(2)}.`,
    recipients: [
      {
        userId: guardian.id,
        phone: guardian.phone ?? undefined,
        email: guardian.email ?? undefined,
        name: guardian.firstName ?? undefined,
      },
    ],
    schoolId: args.schoolId,
  });
}
