"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  submitExpenseClaimSchema,
  type SubmitExpenseClaimInput,
} from "@/modules/accounting/schemas/expense-claim.schema";
import { toNum } from "@/lib/decimal";
import { postJournalTransaction, findAccountByCode, LedgerError } from "@/modules/accounting/lib/ledger";
import { ACCOUNTS, accountCodeForPaymentMethod } from "@/modules/accounting/lib/account-codes";

export async function getExpenseClaimsAction(filters?: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXPENSE_CLAIMS_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
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
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const parsed = submitExpenseClaimSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  const totalAmount = parsed.data.items.reduce((sum, item) => sum + item.amount, 0);

  const claim = await db.$transaction(async (tx) => {
    const created = await tx.expenseClaim.create({
      data: {
        schoolId: ctx.schoolId,
        claimantId: ctx.session.user.id,
        description: parsed.data.description,
        totalAmount,
      },
    });

    await tx.expenseClaimItem.createMany({
      data: parsed.data.items.map((item) => ({
        schoolId: ctx.schoolId,
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

  await audit({ userId: ctx.session.user.id, action: "CREATE", entity: "ExpenseClaim", entityId: claim.id, module: "accounting", description: `Submitted expense claim (GHS ${totalAmount})` });

  return { data: claim };
}

export async function approveExpenseClaimAction(claimId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXPENSE_CLAIMS_APPROVE);
  if (denied) return denied;

  const claim = await db.expenseClaim.findUnique({ where: { id: claimId } });
  if (!claim) return { error: "Expense claim not found" };
  if (claim.status !== "SUBMITTED") return { error: "Only submitted claims can be approved" };

  await db.expenseClaim.update({
    where: { id: claimId },
    data: { status: "APPROVED", approvedBy: ctx.session.user.id, approvedAt: new Date() },
  });

  await audit({ userId: ctx.session.user.id, action: "UPDATE", entity: "ExpenseClaim", entityId: claimId, module: "accounting", description: `Approved expense claim (GHS ${claim.totalAmount})` });

  return { data: { success: true } };
}

export async function rejectExpenseClaimAction(claimId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXPENSE_CLAIMS_APPROVE);
  if (denied) return denied;

  const claim = await db.expenseClaim.findUnique({ where: { id: claimId } });
  if (!claim) return { error: "Expense claim not found" };
  if (claim.status !== "SUBMITTED") return { error: "Only submitted claims can be rejected" };

  await db.expenseClaim.update({ where: { id: claimId }, data: { status: "REJECTED" } });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "REJECT",
    entity: "ExpenseClaim",
    entityId: claimId,
    module: "accounting",
    description: "Rejected expense claim",
    previousData: { status: claim.status },
    newData: { status: "REJECTED" },
  });

  return { data: { success: true } };
}

export async function markClaimPaidAction(claimId: string, paymentMethod: "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "CHEQUE" = "BANK_TRANSFER") {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.EXPENSE_CLAIMS_APPROVE);
  if (denied) return denied;

  const claim = await db.expenseClaim.findUnique({ where: { id: claimId } });
  if (!claim) return { error: "Expense claim not found" };
  if (claim.status !== "APPROVED") return { error: "Only approved claims can be marked as paid" };

  try {
    await db.$transaction(async (tx) => {
      // Double-entry: Dr Expense (misc fallback — specific categorisation is in ExpenseClaimItem)
      //              / Cr Cash/Bank/MoMo by payment method.
      const expAcc = await findAccountByCode(tx, ctx.schoolId, ACCOUNTS.EXPENSE_MISC);
      const cashAcc = await findAccountByCode(tx, ctx.schoolId, accountCodeForPaymentMethod(paymentMethod));
      let journalId: string | null = null;
      if (expAcc && cashAcc) {
        const posted = await postJournalTransaction(tx, {
          schoolId: ctx.schoolId,
          date: new Date(),
          description: `Staff expense claim paid — ${claim.description}`,
          referenceType: "ExpenseClaim",
          referenceId: claimId,
          createdBy: ctx.session.user.id,
          isAutoGenerated: true,
          lines: [
            { accountId: expAcc.id, side: "DEBIT", amount: toNum(claim.totalAmount), narration: claim.description },
            { accountId: cashAcc.id, side: "CREDIT", amount: toNum(claim.totalAmount), narration: `Via ${paymentMethod}` },
          ],
        });
        journalId = posted.journalTransactionId;
      }

      await tx.expenseClaim.update({
        where: { id: claimId },
        data: { status: "PAID", paidAt: new Date(), journalTransactionId: journalId },
      });
    });

    await audit({ userId: ctx.session.user.id, action: "UPDATE", entity: "ExpenseClaim", entityId: claimId, module: "accounting", description: `Marked expense claim as paid (GHS ${claim.totalAmount}) via ${paymentMethod}` });
    return { data: { success: true } };
  } catch (err) {
    if (err instanceof LedgerError) return { error: `Ledger posting failed: ${err.message}` };
    throw err;
  }
}
