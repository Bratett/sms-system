"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import { postJournalTransaction, reverseJournalTransaction, findAccountByCode, LedgerError } from "@/modules/accounting/lib/ledger";
import { ACCOUNTS } from "@/modules/accounting/lib/account-codes";

async function nextCommitmentNumber(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `COM/${year}/`;
  const last = await db.budgetCommitment.findFirst({
    where: { schoolId, commitmentNumber: { startsWith: prefix } },
    orderBy: { commitmentNumber: "desc" },
    select: { commitmentNumber: true },
  });
  const next = last ? parseInt(last.commitmentNumber.split("/").pop()!, 10) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

type CreateCommitmentInput = {
  vendorName: string;
  vendorContact?: string;
  budgetLineId?: string | null;
  fundId?: string | null;
  description?: string;
  commitmentDate: Date;
  expectedDate?: Date;
  lines: Array<{
    description: string;
    quantity?: number;
    unitPrice: number;
    expenseCategoryId?: string;
  }>;
};

export async function getBudgetCommitmentsAction(filters?: { status?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.JOURNAL_READ);
  if (denied) return denied;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.status) where.status = filters.status;

  const commitments = await db.budgetCommitment.findMany({
    where,
    include: { lines: true, budgetLine: { include: { expenseCategory: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return { data: commitments };
}

export async function createBudgetCommitmentAction(data: CreateCommitmentInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PO_CREATE);
  if (denied) return denied;

  if (data.lines.length === 0) return { error: "At least one line is required" };

  const computedLines = data.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity ?? 1,
    unitPrice: l.unitPrice,
    amount: Math.round((l.quantity ?? 1) * l.unitPrice * 100) / 100,
    expenseCategoryId: l.expenseCategoryId,
  }));
  const total = computedLines.reduce((s, l) => s + l.amount, 0);

  const commitmentNumber = await nextCommitmentNumber(ctx.schoolId);

  const commitment = await db.budgetCommitment.create({
    data: {
      schoolId: ctx.schoolId,
      commitmentNumber,
      vendorName: data.vendorName,
      vendorContact: data.vendorContact,
      budgetLineId: data.budgetLineId,
      fundId: data.fundId,
      description: data.description,
      totalAmount: total,
      commitmentDate: data.commitmentDate,
      expectedDate: data.expectedDate,
      createdBy: ctx.session.user.id,
      lines: {
        create: computedLines.map((l) => ({
          schoolId: ctx.schoolId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
          expenseCategoryId: l.expenseCategoryId,
        })),
      },
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "BudgetCommitment",
    entityId: commitment.id,
    module: "accounting",
    description: `Created budget commitment ${commitmentNumber} (${data.vendorName}, GHS ${total})`,
  });

  return { data: commitment };
}

/**
 * Approve a commitment — posts the encumbrance journal (Dr 9100 / Cr 9200) and
 * increments the budget line's committed amount. If the commitment would cause
 * the budget line to exceed its allocation, we reject (hard block).
 */
export async function approveBudgetCommitmentAction(commitmentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PO_APPROVE);
  if (denied) return denied;

  const commitment = await db.budgetCommitment.findUnique({
    where: { id: commitmentId },
    include: { budgetLine: true },
  });
  if (!commitment) return { error: "Commitment not found" };
  if (commitment.schoolId !== ctx.schoolId) return { error: "Access denied" };
  if (commitment.status !== "DRAFT") return { error: "Only DRAFT commitments can be approved" };

  if (commitment.budgetLine) {
    const available =
      toNum(commitment.budgetLine.allocatedAmount) -
      toNum(commitment.budgetLine.committedAmount) -
      toNum(commitment.budgetLine.spentAmount);
    if (toNum(commitment.totalAmount) > available) {
      return {
        error: `Commitment exceeds remaining budget authority on this line. Available: GHS ${available.toFixed(2)}, requested: GHS ${toNum(commitment.totalAmount).toFixed(2)}.`,
      };
    }
  }

  try {
    await db.$transaction(async (tx) => {
      const encumbrance = await findAccountByCode(tx, ctx.schoolId, ACCOUNTS.ENCUMBRANCES);
      const reserve = await findAccountByCode(tx, ctx.schoolId, ACCOUNTS.RESERVE_FOR_ENCUMBRANCES);
      let journalId: string | null = null;
      if (encumbrance && reserve) {
        const posted = await postJournalTransaction(tx, {
          schoolId: ctx.schoolId,
          date: commitment.commitmentDate,
          description: `Encumbrance established — commitment ${commitment.commitmentNumber} (${commitment.vendorName})`,
          referenceType: "Encumbrance",
          referenceId: commitment.id,
          createdBy: ctx.session.user.id,
          isAutoGenerated: true,
          lines: [
            { accountId: encumbrance.id, side: "DEBIT", amount: toNum(commitment.totalAmount), narration: commitment.commitmentNumber, fundId: commitment.fundId ?? undefined },
            { accountId: reserve.id, side: "CREDIT", amount: toNum(commitment.totalAmount), narration: commitment.commitmentNumber, fundId: commitment.fundId ?? undefined },
          ],
        });
        journalId = posted.journalTransactionId;

        await tx.encumbrance.create({
          data: {
            schoolId: ctx.schoolId,
            budgetCommitmentId: commitment.id,
            budgetLineId: commitment.budgetLineId,
            amount: commitment.totalAmount,
            journalTransactionId: journalId,
          },
        });
      }

      await tx.budgetCommitment.update({
        where: { id: commitmentId },
        data: {
          status: "APPROVED",
          approvedBy: ctx.session.user.id,
          approvedAt: new Date(),
          encumbranceJournalId: journalId,
        },
      });

      if (commitment.budgetLineId) {
        await tx.budgetLine.update({
          where: { id: commitment.budgetLineId },
          data: { committedAmount: { increment: commitment.totalAmount } },
        });
      }
    });

    await audit({
      userId: ctx.session.user.id,
      action: "UPDATE",
      entity: "BudgetCommitment",
      entityId: commitmentId,
      module: "accounting",
      description: `Approved commitment ${commitment.commitmentNumber}`,
    });

    return { data: { success: true } };
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }
}

/**
 * Cancel a commitment — reverses the encumbrance journal and releases budget authority.
 */
export async function cancelBudgetCommitmentAction(commitmentId: string, reason: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PO_APPROVE);
  if (denied) return denied;

  const commitment = await db.budgetCommitment.findUnique({
    where: { id: commitmentId },
    include: { encumbrances: { where: { status: "ACTIVE" } } },
  });
  if (!commitment) return { error: "Commitment not found" };
  if (commitment.schoolId !== ctx.schoolId) return { error: "Access denied" };
  if (commitment.status === "CANCELLED" || commitment.status === "LIQUIDATED") {
    return { error: "Commitment already cancelled or fully liquidated" };
  }

  try {
    await db.$transaction(async (tx) => {
      for (const enc of commitment.encumbrances) {
        if (enc.journalTransactionId) {
          const reversal = await reverseJournalTransaction(tx, enc.journalTransactionId, {
            schoolId: ctx.schoolId,
            reversedBy: ctx.session.user.id,
            description: `Encumbrance cancelled — ${commitment.commitmentNumber}: ${reason}`,
          });
          await tx.encumbrance.update({
            where: { id: enc.id },
            data: { status: "CANCELLED", cancelledAt: new Date(), liquidationJournalId: reversal.journalTransactionId },
          });
        } else {
          await tx.encumbrance.update({
            where: { id: enc.id },
            data: { status: "CANCELLED", cancelledAt: new Date() },
          });
        }
      }

      await tx.budgetCommitment.update({
        where: { id: commitmentId },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: reason },
      });

      if (commitment.budgetLineId) {
        const outstanding = toNum(commitment.totalAmount) - toNum(commitment.liquidatedAmount);
        await tx.budgetLine.update({
          where: { id: commitment.budgetLineId },
          data: { committedAmount: { decrement: outstanding } },
        });
      }
    });

    await audit({
      userId: ctx.session.user.id,
      action: "UPDATE",
      entity: "BudgetCommitment",
      entityId: commitmentId,
      module: "accounting",
      description: `Cancelled commitment ${commitment.commitmentNumber}: ${reason}`,
    });

    return { data: { success: true } };
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }
}
