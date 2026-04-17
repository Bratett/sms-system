"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-context";
import { toNum } from "@/lib/decimal";
import { audit } from "@/lib/audit";
import { getPaymentProvider, getProviderForCurrency } from "@/lib/payment/registry";
import { CURRENCIES } from "@/lib/payment/types";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";

/**
 * Portal-side fee payment flows. Unlike the dashboard payment actions which
 * require PAYMENTS_CREATE, these are usable by any logged-in guardian (or
 * student with a linked account) so long as they demonstrate access to the
 * target bill via StudentGuardian / self-link.
 *
 * The actual provider call delegates to the shared payment registry so the
 * behaviour (Paystack / MoMo / etc.) matches staff-initiated payments.
 * Recording of the Payment row happens in the verification path, inside a
 * transaction with the bill update so balances never diverge.
 */

async function resolveAccessibleStudent(userId: string, studentId: string): Promise<boolean> {
  // Guardian link
  const guardian = await db.guardian.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (guardian) {
    const link = await db.studentGuardian.findFirst({
      where: { guardianId: guardian.id, studentId },
      select: { id: true },
    });
    if (link) return true;
  }
  // Student linked to this user directly
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { userId: true },
  });
  if (student?.userId && student.userId === userId) return true;
  return false;
}

// ─── Statement: bills + payments for a specific child ────────────────

export async function getPortalStatementAction(studentId: string) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;
  const ok = await resolveAccessibleStudent(ctx.session.user.id, studentId);
  if (!ok) return { error: "You do not have access to this student's statement." };

  const [student, bills] = await Promise.all([
    db.student.findUnique({
      where: { id: studentId },
      select: { id: true, studentId: true, firstName: true, lastName: true, schoolId: true },
    }),
    db.studentBill.findMany({
      where: { studentId },
      include: {
        feeStructure: { select: { name: true, termId: true, academicYearId: true } },
        payments: {
          where: { status: "CONFIRMED" },
          orderBy: { receivedAt: "desc" },
          include: { receipt: { select: { receiptNumber: true } } },
        },
        installments: {
          orderBy: { installmentNumber: "asc" },
          select: {
            id: true,
            installmentNumber: true,
            amount: true,
            paidAmount: true,
            dueDate: true,
            status: true,
          },
        },
        penalties: {
          where: { waived: false },
          select: { id: true, amount: true, appliedAt: true },
        },
      },
      orderBy: { generatedAt: "desc" },
    }),
  ]);

  if (!student) return { error: "Student not found" };

  const totalBilled = bills.reduce((s, b) => s + toNum(b.totalAmount), 0);
  const totalPaid = bills.reduce((s, b) => s + toNum(b.paidAmount), 0);
  const totalBalance = bills.reduce((s, b) => s + toNum(b.balanceAmount), 0);

  return {
    data: {
      student: {
        id: student.id,
        studentId: student.studentId,
        name: `${student.firstName} ${student.lastName}`,
      },
      summary: { totalBilled, totalPaid, totalBalance },
      bills: bills.map((b) => ({
        id: b.id,
        feeStructure: b.feeStructure.name,
        termId: b.feeStructure.termId,
        total: toNum(b.totalAmount),
        paid: toNum(b.paidAmount),
        balance: toNum(b.balanceAmount),
        status: b.status,
        dueDate: b.dueDate,
        generatedAt: b.generatedAt,
        payments: b.payments.map((p) => ({
          id: p.id,
          amount: toNum(p.amount),
          method: p.paymentMethod,
          reference: p.referenceNumber,
          receivedAt: p.receivedAt,
          receiptNumber: p.receipt?.receiptNumber ?? null,
        })),
        installments: b.installments.map((i) => ({
          ...i,
          amount: toNum(i.amount),
          paidAmount: toNum(i.paidAmount),
        })),
        penalties: b.penalties.map((p) => ({
          ...p,
          amount: toNum(p.amount),
        })),
      })),
    },
  };
}

// ─── Initiate from portal ─────────────────────────────────────────────

export async function initiatePortalPaymentAction(data: {
  studentBillId: string;
  amount: number;
  email: string;
  currency?: string;
  provider?: string;
}) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  if (data.amount <= 0) return { error: "Amount must be greater than zero" };

  const bill = await db.studentBill.findUnique({
    where: { id: data.studentBillId },
    select: {
      id: true,
      studentId: true,
      schoolId: true,
      balanceAmount: true,
      status: true,
    },
  });
  if (!bill) return { error: "Bill not found" };

  const ok = await resolveAccessibleStudent(ctx.session.user.id, bill.studentId);
  if (!ok) return { error: "You do not have access to this bill." };

  if (bill.status === "PAID" || bill.status === "OVERPAID") {
    return { error: "This bill is already fully paid." };
  }
  if (data.amount > toNum(bill.balanceAmount)) {
    return { error: `Amount exceeds outstanding balance of ${toNum(bill.balanceAmount).toFixed(2)}` };
  }

  // Block payments if a dunning stage marked this student as portal-blocked.
  // (Admins may still take payment through the dashboard.)
  const blocked = await db.dunningCase.findFirst({
    where: {
      studentBillId: bill.id,
      status: { in: ["OPEN", "ESCALATED"] },
      policy: {
        stages: {
          some: { blockPortal: true, order: { lte: 99 } },
        },
      },
    },
    select: { id: true, currentStageId: true, stagesCleared: true },
  });
  if (blocked) {
    // Only block if the case has actually reached a portal-blocking stage.
    const stage = blocked.currentStageId
      ? await db.dunningStage.findUnique({ where: { id: blocked.currentStageId } })
      : null;
    if (stage?.blockPortal) {
      return {
        error:
          "Online payment is temporarily disabled for this bill. Please contact the bursar's office.",
      };
    }
  }

  const currency = data.currency || "GHS";
  const currencyConfig = CURRENCIES[currency];
  if (!currencyConfig) return { error: `Unsupported currency: ${currency}` };

  const provider = data.provider
    ? getPaymentProvider(data.provider)
    : getProviderForCurrency(currency);
  if (!provider) return { error: `Payment provider not found: ${data.provider}` };
  if (!provider.supportedCurrencies.includes(currency)) {
    return { error: `${provider.displayName} does not support ${currency}` };
  }

  const reference = `PTL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3000";

  // Persist the in-flight transaction so we can reconcile later
  // even if the caller never hits the callback URL.
  await db.onlinePaymentTransaction.create({
    data: {
      schoolId: bill.schoolId,
      studentBillId: bill.id,
      studentId: bill.studentId,
      provider: provider.name,
      reference,
      amount: data.amount,
      currency,
      status: "INITIATED",
      callbackUrl: `${baseUrl}/parent/fees?payment=success&ref=${reference}`,
      metadata: { origin: "portal", initiatedBy: ctx.session.user.id },
    },
  });

  const result = await provider.initializePayment({
    email: data.email,
    amount: provider.toSmallestUnit(data.amount),
    currency,
    reference,
    callbackUrl: `${baseUrl}/parent/fees?payment=success&ref=${reference}`,
    metadata: {
      studentBillId: bill.id,
      studentId: bill.studentId,
      schoolId: bill.schoolId,
      provider: provider.name,
      origin: "portal",
    },
  });

  if (!result.success) {
    await db.onlinePaymentTransaction.update({
      where: { reference },
      data: { status: "FAILED", failureReason: result.error ?? "init failed" },
    });
    return { error: result.error || "Failed to initialize payment" };
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "OnlinePaymentTransaction",
    module: "portal",
    description: `Portal-initiated payment ${currency} ${data.amount.toFixed(2)} for bill ${bill.id}`,
    metadata: { reference, amount: data.amount, currency, provider: provider.name },
  });

  return {
    data: {
      authorizationUrl: result.authorizationUrl,
      accessCode: result.accessCode,
      reference: result.reference,
      provider: provider.name,
    },
  };
}

// ─── Verify + record on the portal ─────────────────────────────────────

export async function confirmPortalPaymentAction(reference: string) {
  const ctx = await requireAuth();
  if ("error" in ctx) return ctx;

  const txn = await db.onlinePaymentTransaction.findUnique({
    where: { reference },
  });
  if (!txn) return { error: "Unknown payment reference" };

  const ok = await resolveAccessibleStudent(ctx.session.user.id, txn.studentId);
  if (!ok) return { error: "Unauthorised" };

  // If already confirmed, just echo the stored info.
  if (txn.status === "SUCCESSFUL") {
    return { data: { status: "success", reference, alreadyConfirmed: true } };
  }

  const provider = getPaymentProvider(txn.provider);
  if (!provider) return { error: "Unknown payment provider" };

  const verify = await provider.verifyPayment(reference);
  if (!verify.success) {
    await db.onlinePaymentTransaction.update({
      where: { reference },
      data: {
        status: "FAILED",
        failureReason: verify.error ?? "verification failed",
      },
    });
    return { data: { status: "failed", error: verify.error ?? "verification failed" } };
  }

  const paidAmount = provider.fromSmallestUnit(verify.amount ?? 0);

  // Apply payment to bill atomically
  const { bill, receipt } = await db.$transaction(async (tx) => {
    const current = await tx.studentBill.findUnique({ where: { id: txn.studentBillId } });
    if (!current) throw new Error("Bill vanished");

    const payment = await tx.payment.create({
      data: {
        schoolId: txn.schoolId,
        studentBillId: txn.studentBillId,
        studentId: txn.studentId,
        amount: paidAmount,
        paymentMethod: verify.channel?.toUpperCase().includes("MOMO")
          ? "MOBILE_MONEY"
          : verify.channel?.toUpperCase().includes("BANK")
            ? "BANK_TRANSFER"
            : "OTHER",
        referenceNumber: reference,
        receivedBy: ctx.session.user.id,
        status: "CONFIRMED",
        notes: `Online payment via ${provider.displayName}`,
      },
    });

    const receiptNumber = `RCP/${new Date().getFullYear()}/ONL/${payment.id.slice(-6).toUpperCase()}`;
    const rc = await tx.receipt.create({
      data: {
        paymentId: payment.id,
        schoolId: txn.schoolId,
        receiptNumber,
      },
    });

    const newPaid = toNum(current.paidAmount) + paidAmount;
    const newBalance = toNum(current.totalAmount) - newPaid;
    const updated = await tx.studentBill.update({
      where: { id: current.id },
      data: {
        paidAmount: newPaid,
        balanceAmount: Math.max(newBalance, 0),
        status:
          newBalance <= 0
            ? "PAID"
            : newPaid > 0
              ? "PARTIAL"
              : "UNPAID",
      },
    });

    await tx.onlinePaymentTransaction.update({
      where: { reference },
      data: {
        status: "SUCCESSFUL",
        completedAt: new Date(),
        providerReference: verify.reference,
        channel: verify.channel,
      },
    });

    return { bill: updated, receipt: rc };
  });

  // Notify guardian; best-effort, never blocks the confirmation.
  try {
    const student = await db.student.findUnique({
      where: { id: txn.studentId },
      select: {
        firstName: true,
        lastName: true,
        guardians: {
          where: { isPrimary: true },
          select: { guardian: { select: { phone: true, email: true, firstName: true } } },
          take: 1,
        },
      },
    });
    const g = student?.guardians[0]?.guardian;
    if (g) {
      await dispatch({
        event: NOTIFICATION_EVENTS.PAYMENT_RECEIVED,
        title: "Payment received",
        message:
          `Dear ${g.firstName ?? "parent"}, we have received GHS ${paidAmount.toFixed(2)} ` +
          `towards ${student?.firstName ?? "your ward"}'s fees. ` +
          `Receipt: ${receipt.receiptNumber}. New balance: GHS ${toNum(bill.balanceAmount).toFixed(2)}.`,
        recipients: [
          { phone: g.phone ?? undefined, email: g.email ?? undefined, name: g.firstName ?? undefined },
        ],
        schoolId: txn.schoolId,
      });
    }
  } catch {
    // swallow notification errors
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Payment",
    module: "portal",
    description: `Portal payment GHS ${paidAmount.toFixed(2)} applied to bill ${bill.id}`,
    metadata: { reference, amount: paidAmount, receiptNumber: receipt.receiptNumber },
  });

  return {
    data: {
      status: "success",
      reference,
      amount: paidAmount,
      receiptNumber: receipt.receiptNumber,
      newBalance: toNum(bill.balanceAmount),
    },
  };
}
