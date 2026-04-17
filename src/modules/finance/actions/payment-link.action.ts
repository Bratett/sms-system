"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  createPaymentLinkSchema,
  type CreatePaymentLinkInput,
} from "@/modules/finance/schemas/payment-link.schema";
import { randomBytes } from "crypto";

function generateLinkCode(): string {
  return randomBytes(6).toString("base64url");
}

export async function getPaymentLinksAction(filters?: {
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PAYMENT_LINKS_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  const [links, total] = await Promise.all([
    db.paymentLink.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.paymentLink.count({ where }),
  ]);

  // Resolve bill and student info
  const billIds = [...new Set(links.map((l) => l.studentBillId))];
  const bills = await db.studentBill.findMany({
    where: { id: { in: billIds } },
    select: { id: true, studentId: true, totalAmount: true, balanceAmount: true },
  });
  const billMap = new Map(bills.map((b) => [b.id, b]));

  const studentIds = [...new Set(bills.map((b) => b.studentId))];
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentId: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const data = links.map((link) => {
    const bill = billMap.get(link.studentBillId);
    const student = bill ? studentMap.get(bill.studentId) : null;
    return {
      ...link,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown",
      studentIdNumber: student?.studentId ?? "Unknown",
      billTotal: bill?.totalAmount ?? 0,
      billBalance: bill?.balanceAmount ?? 0,
      isExpired: link.expiresAt ? new Date(link.expiresAt) < new Date() : false,
    };
  });

  return {
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function createPaymentLinkAction(data: CreatePaymentLinkInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PAYMENT_LINKS_CREATE);
  if (denied) return denied;

  const parsed = createPaymentLinkSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const bill = await db.studentBill.findUnique({
    where: { id: parsed.data.studentBillId },
  });
  if (!bill) return { error: "Student bill not found" };
  if (bill.status === "PAID" || bill.status === "OVERPAID") {
    return { error: "Bill is already fully paid" };
  }

  const code = generateLinkCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (parsed.data.expiresInDays ?? 30));

  const link = await db.paymentLink.create({
    data: {
      schoolId: ctx.schoolId,
      studentBillId: bill.id,
      code,
      amount: parsed.data.amount,
      description: parsed.data.description,
      expiresAt,
      isOneTime: parsed.data.isOneTime ?? true,
      createdBy: ctx.session.user.id,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "PaymentLink",
    entityId: link.id,
    module: "finance",
    description: `Created payment link (code: ${code})`,
  });

  return { data: { ...link, url: `/pay/${code}` } };
}

export async function deactivatePaymentLinkAction(linkId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PAYMENT_LINKS_CREATE);
  if (denied) return denied;

  const link = await db.paymentLink.findUnique({ where: { id: linkId } });
  if (!link) return { error: "Payment link not found" };

  await db.paymentLink.update({
    where: { id: linkId },
    data: { isActive: false },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "PaymentLink",
    entityId: linkId,
    module: "finance",
    description: `Deactivated payment link (code: ${link.code})`,
  });

  return { data: { success: true } };
}
