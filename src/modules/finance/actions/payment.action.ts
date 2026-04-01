"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import {
  recordPaymentSchema,
  initiateReversalSchema,
  type RecordPaymentInput,
  type InitiateReversalInput,
} from "@/modules/finance/schemas/payment.schema";

async function generateReceiptNumber(termId: string): Promise<string> {
  const term = await db.term.findUnique({
    where: { id: termId },
    include: { academicYear: true },
  });

  const year = term
    ? new Date(term.academicYear.startDate).getFullYear()
    : new Date().getFullYear();
  const termNumber = term?.termNumber ?? 1;

  // Count existing receipts for this year/term pattern
  const prefix = `RCP/${year}/T${termNumber}/`;
  const lastReceipt = await db.receipt.findFirst({
    where: { receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: "desc" },
  });

  let nextNumber = 1;
  if (lastReceipt) {
    const parts = lastReceipt.receiptNumber.split("/");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextNumber = lastNum + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

export async function recordPaymentAction(data: RecordPaymentInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = recordPaymentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const bill = await db.studentBill.findUnique({
    where: { id: parsed.data.studentBillId },
  });

  if (!bill) {
    return { error: "Student bill not found" };
  }

  if (parsed.data.amount <= 0) {
    return { error: "Payment amount must be greater than zero" };
  }

  // Require reference number for non-cash payments
  if (parsed.data.paymentMethod !== "CASH" && !parsed.data.referenceNumber?.trim()) {
    return { error: "Reference number is required for non-cash payments" };
  }

  const result = await db.$transaction(async (tx) => {
    // Create payment
    const payment = await tx.payment.create({
      data: {
        studentBillId: bill.id,
        studentId: bill.studentId,
        amount: parsed.data.amount,
        paymentMethod: parsed.data.paymentMethod,
        referenceNumber: parsed.data.referenceNumber || null,
        receivedBy: session.user!.id!,
        status: "CONFIRMED",
        notes: parsed.data.notes || null,
      },
    });

    // Update bill amounts
    const newPaidAmount = toNum(bill.paidAmount) + parsed.data.amount;
    const newBalanceAmount = toNum(bill.totalAmount) - newPaidAmount;

    let newStatus: "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID";
    if (newBalanceAmount <= 0 && newPaidAmount > toNum(bill.totalAmount)) {
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

    // Generate receipt
    const receiptNumber = await generateReceiptNumber(bill.termId);
    const receipt = await tx.receipt.create({
      data: {
        paymentId: payment.id,
        receiptNumber,
      },
    });

    return { payment, receipt };
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Payment",
    entityId: result.payment.id,
    module: "finance",
    description: `Recorded payment of GHS ${parsed.data.amount.toFixed(2)} via ${parsed.data.paymentMethod}. Receipt: ${result.receipt.receiptNumber}`,
    newData: result,
  });

  // Auto-generate journal entry for this payment (best-effort, non-blocking)
  generatePaymentJournalEntry(
    result.payment.id,
    parsed.data.amount,
    parsed.data.paymentMethod,
    session.user.id!,
  ).catch((err) => {
    console.error("[Payment] Auto-journal generation failed:", err);
  });

  return { data: result };
}

/**
 * Auto-generate a double-entry journal entry for a fee payment.
 * Debit: Cash/Bank/MoMo account (based on payment method)
 * Credit: Tuition Fee Revenue account
 */
async function generatePaymentJournalEntry(
  paymentId: string,
  amount: number,
  paymentMethod: string,
  userId: string,
) {
  const school = await db.school.findFirst();
  if (!school) return;

  // Map payment method to debit account code
  const accountCodeMap: Record<string, string> = {
    CASH: "1000",           // Cash on Hand
    BANK_TRANSFER: "1010",  // Bank - GCB
    MOBILE_MONEY: "1030",   // Mobile Money Accounts
    CHEQUE: "1010",         // Bank - GCB
    OTHER: "1000",          // Cash on Hand (fallback)
  };

  const debitCode = accountCodeMap[paymentMethod] ?? "1000";
  const creditCode = "4000"; // Tuition Fees revenue

  const [debitAccount, creditAccount] = await Promise.all([
    db.account.findFirst({ where: { schoolId: school.id, code: debitCode } }),
    db.account.findFirst({ where: { schoolId: school.id, code: creditCode } }),
  ]);

  // Only create journal if Chart of Accounts has been seeded
  if (!debitAccount || !creditAccount) return;

  const year = new Date().getFullYear();
  const prefix = `JRN/${year}/`;
  const lastTxn = await db.journalTransaction.findFirst({
    where: { schoolId: school.id, transactionNumber: { startsWith: prefix } },
    orderBy: { transactionNumber: "desc" },
  });
  const nextNum = lastTxn ? parseInt(lastTxn.transactionNumber.split("/").pop()!) + 1 : 1;
  const transactionNumber = `${prefix}${String(nextNum).padStart(4, "0")}`;

  await db.$transaction(async (tx) => {
    const journal = await tx.journalTransaction.create({
      data: {
        schoolId: school.id,
        transactionNumber,
        date: new Date(),
        description: `Fee payment received via ${paymentMethod.replace("_", " ")}`,
        referenceType: "Payment",
        referenceId: paymentId,
        isAutoGenerated: true,
        createdBy: userId,
        status: "POSTED",
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    await tx.journalEntry.create({
      data: {
        journalTransactionId: journal.id,
        debitAccountId: debitAccount.id,
        creditAccountId: creditAccount.id,
        amount,
        narration: `Payment ${paymentId.slice(-8)}`,
      },
    });

    // Update account balances
    await tx.account.update({
      where: { id: debitAccount.id },
      data: { currentBalance: { increment: amount } },
    });
    await tx.account.update({
      where: { id: creditAccount.id },
      data: { currentBalance: { increment: amount } },
    });
  });
}

export async function getPaymentsAction(filters?: {
  studentId?: string;
  termId?: string;
  date?: string;
  paymentMethod?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (filters?.studentId) where.studentId = filters.studentId;
  if (filters?.paymentMethod) where.paymentMethod = filters.paymentMethod;

  if (filters?.termId) {
    const bills = await db.studentBill.findMany({
      where: { termId: filters.termId },
      select: { id: true },
    });
    where.studentBillId = { in: bills.map((b) => b.id) };
  }

  if (filters?.date) {
    const dateStart = new Date(filters.date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(filters.date);
    dateEnd.setHours(23, 59, 59, 999);
    where.receivedAt = { gte: dateStart, lte: dateEnd };
  }

  const [payments, total] = await Promise.all([
    db.payment.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        receipt: true,
        studentBill: {
          select: { id: true, termId: true, totalAmount: true, balanceAmount: true },
        },
      },
      orderBy: { receivedAt: "desc" },
    }),
    db.payment.count({ where }),
  ]);

  // Fetch student info
  const studentIds = [...new Set(payments.map((p) => p.studentId))];
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // Fetch receiver names
  const receiverIds = [...new Set(payments.map((p) => p.receivedBy))];
  const receivers = await db.user.findMany({
    where: { id: { in: receiverIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const receiverMap = new Map(receivers.map((r) => [r.id, `${r.firstName} ${r.lastName}`]));

  const data = payments.map((payment) => {
    const student = studentMap.get(payment.studentId);
    return {
      ...payment,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
      studentIdNumber: student?.studentId ?? "Unknown",
      receivedByName: receiverMap.get(payment.receivedBy) ?? "Unknown",
      receiptNumber: payment.receipt?.receiptNumber ?? null,
    };
  });

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getPaymentAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const payment = await db.payment.findUnique({
    where: { id },
    include: {
      receipt: true,
      reversal: true,
      studentBill: {
        include: {
          billItems: {
            include: { feeItem: true },
          },
          feeStructure: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!payment) {
    return { error: "Payment not found" };
  }

  // Fetch student info
  const student = await db.student.findUnique({
    where: { id: payment.studentId },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });

  // Fetch receiver name
  const receiver = await db.user.findUnique({
    where: { id: payment.receivedBy },
    select: { id: true, firstName: true, lastName: true },
  });

  return {
    data: {
      ...payment,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
      studentIdNumber: student?.studentId ?? "Unknown",
      receivedByName: receiver ? `${receiver.firstName} ${receiver.lastName}` : "Unknown",
    },
  };
}

export async function getDailyCollectionAction(date: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(date);
  dateEnd.setHours(23, 59, 59, 999);

  const payments = await db.payment.findMany({
    where: {
      receivedAt: { gte: dateStart, lte: dateEnd },
      status: "CONFIRMED",
    },
    include: {
      receipt: true,
    },
  });

  // Fetch student info
  const studentIds = [...new Set(payments.map((p) => p.studentId))];
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // Group by payment method
  const grouped: Record<string, { payments: typeof payments; total: number }> = {};
  let grandTotal = 0;

  for (const payment of payments) {
    const method = payment.paymentMethod;
    if (!grouped[method]) {
      grouped[method] = { payments: [], total: 0 };
    }
    grouped[method].payments.push(payment);
    grouped[method].total += toNum(payment.amount);
    grandTotal += toNum(payment.amount);
  }

  const data = payments.map((p) => {
    const student = studentMap.get(p.studentId);
    return {
      ...p,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
      studentIdNumber: student?.studentId ?? "Unknown",
      receiptNumber: p.receipt?.receiptNumber ?? null,
    };
  });

  return {
    data,
    summary: {
      byMethod: Object.entries(grouped).map(([method, info]) => ({
        method,
        count: info.payments.length,
        total: info.total,
      })),
      grandTotal,
      totalPayments: payments.length,
    },
  };
}

export async function initiateReversalAction(data: InitiateReversalInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = initiateReversalSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const payment = await db.payment.findUnique({
    where: { id: parsed.data.paymentId },
    include: { reversal: true },
  });

  if (!payment) {
    return { error: "Payment not found" };
  }

  if (payment.status === "REVERSED") {
    return { error: "Payment has already been reversed" };
  }

  if (payment.reversal) {
    return { error: "A reversal request already exists for this payment" };
  }

  const reversal = await db.paymentReversal.create({
    data: {
      paymentId: payment.id,
      reason: parsed.data.reason,
      reversedBy: session.user.id!,
      status: "PENDING",
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "PaymentReversal",
    entityId: reversal.id,
    module: "finance",
    description: `Initiated payment reversal for payment ${payment.id}. Reason: ${parsed.data.reason}`,
    newData: reversal,
  });

  return { data: reversal };
}

export async function approveReversalAction(reversalId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const reversal = await db.paymentReversal.findUnique({
    where: { id: reversalId },
    include: {
      payment: {
        include: { studentBill: true },
      },
    },
  });

  if (!reversal) {
    return { error: "Reversal not found" };
  }

  if (reversal.status !== "PENDING") {
    return { error: "Reversal is not in PENDING status" };
  }

  await db.$transaction(async (tx) => {
    // Update reversal status
    await tx.paymentReversal.update({
      where: { id: reversalId },
      data: {
        status: "APPROVED",
        approvedBy: session.user!.id!,
        approvedAt: new Date(),
      },
    });

    // Update payment status
    await tx.payment.update({
      where: { id: reversal.paymentId },
      data: { status: "REVERSED" },
    });

    // Recalculate bill
    const bill = reversal.payment.studentBill;
    const newPaidAmount = toNum(bill.paidAmount) - toNum(reversal.payment.amount);
    const newBalanceAmount = toNum(bill.totalAmount) - newPaidAmount;

    let newStatus: "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID";
    if (newPaidAmount <= 0) {
      newStatus = "UNPAID";
    } else if (newBalanceAmount <= 0) {
      newStatus = "PAID";
    } else {
      newStatus = "PARTIAL";
    }

    await tx.studentBill.update({
      where: { id: bill.id },
      data: {
        paidAmount: Math.max(0, newPaidAmount),
        balanceAmount: Math.max(0, newBalanceAmount),
        status: newStatus,
      },
    });
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "PaymentReversal",
    entityId: reversalId,
    module: "finance",
    description: `Approved payment reversal for payment ${reversal.paymentId}`,
    newData: { status: "APPROVED" },
  });

  return { success: true };
}

export async function rejectReversalAction(reversalId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const reversal = await db.paymentReversal.findUnique({
    where: { id: reversalId },
  });

  if (!reversal) {
    return { error: "Reversal not found" };
  }

  if (reversal.status !== "PENDING") {
    return { error: "Reversal is not in PENDING status" };
  }

  await db.paymentReversal.update({
    where: { id: reversalId },
    data: { status: "REJECTED" },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "PaymentReversal",
    entityId: reversalId,
    module: "finance",
    description: `Rejected payment reversal for payment ${reversal.paymentId}`,
    newData: { status: "REJECTED" },
  });

  return { success: true };
}
