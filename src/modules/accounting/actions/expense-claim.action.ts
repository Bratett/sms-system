"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  submitExpenseClaimSchema,
  type SubmitExpenseClaimInput,
} from "@/modules/accounting/schemas/expense-claim.schema";

export async function getExpenseClaimsAction(filters?: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: school.id };
  if (filters?.status) where.status = filters.status;

  const [claims, total] = await Promise.all([
    db.expenseClaim.findMany({
      where,
      include: { items: true },
      orderBy: { submittedAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.expenseClaim.count({ where }),
  ]);

  const userIds = [...new Set([...claims.map((c) => c.claimantId), ...claims.map((c) => c.approvedBy).filter(Boolean) as string[]])];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } });
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = claims.map((c) => ({
    ...c,
    claimantName: userMap.get(c.claimantId) ?? "Unknown",
    approvedByName: c.approvedBy ? userMap.get(c.approvedBy) ?? null : null,
    itemCount: c.items.length,
  }));

  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function submitExpenseClaimAction(data: SubmitExpenseClaimInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = submitExpenseClaimSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const totalAmount = parsed.data.items.reduce((sum, item) => sum + item.amount, 0);

  const claim = await db.$transaction(async (tx) => {
    const created = await tx.expenseClaim.create({
      data: {
        schoolId: school.id,
        claimantId: session.user.id!,
        description: parsed.data.description,
        totalAmount,
      },
    });

    await tx.expenseClaimItem.createMany({
      data: parsed.data.items.map((item) => ({
        expenseClaimId: created.id,
        description: item.description,
        amount: item.amount,
        date: item.date,
        receiptUrl: item.receiptUrl,
        expenseCategoryId: item.expenseCategoryId,
      })),
    });

    return created;
  });

  await audit({ userId: session.user.id!, action: "CREATE", entity: "ExpenseClaim", entityId: claim.id, module: "accounting", description: `Submitted expense claim (GHS ${totalAmount})` });

  return { data: claim };
}

export async function approveExpenseClaimAction(claimId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const claim = await db.expenseClaim.findUnique({ where: { id: claimId } });
  if (!claim) return { error: "Expense claim not found" };
  if (claim.status !== "SUBMITTED") return { error: "Only submitted claims can be approved" };

  await db.expenseClaim.update({
    where: { id: claimId },
    data: { status: "APPROVED", approvedBy: session.user.id!, approvedAt: new Date() },
  });

  await audit({ userId: session.user.id!, action: "UPDATE", entity: "ExpenseClaim", entityId: claimId, module: "accounting", description: `Approved expense claim (GHS ${claim.totalAmount})` });

  return { data: { success: true } };
}

export async function rejectExpenseClaimAction(claimId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const claim = await db.expenseClaim.findUnique({ where: { id: claimId } });
  if (!claim) return { error: "Expense claim not found" };
  if (claim.status !== "SUBMITTED") return { error: "Only submitted claims can be rejected" };

  await db.expenseClaim.update({ where: { id: claimId }, data: { status: "REJECTED" } });

  return { data: { success: true } };
}

export async function markClaimPaidAction(claimId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const claim = await db.expenseClaim.findUnique({ where: { id: claimId } });
  if (!claim) return { error: "Expense claim not found" };
  if (claim.status !== "APPROVED") return { error: "Only approved claims can be marked as paid" };

  await db.expenseClaim.update({
    where: { id: claimId },
    data: { status: "PAID", paidAt: new Date() },
  });

  await audit({ userId: session.user.id!, action: "UPDATE", entity: "ExpenseClaim", entityId: claimId, module: "accounting", description: `Marked expense claim as paid (GHS ${claim.totalAmount})` });

  return { data: { success: true } };
}
