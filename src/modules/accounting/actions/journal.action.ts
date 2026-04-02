"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import {
  createJournalTransactionSchema,
  type CreateJournalTransactionInput,
} from "@/modules/accounting/schemas/journal.schema";

async function generateTransactionNumber(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `JRN/${year}/`;
  const lastTxn = await db.journalTransaction.findFirst({
    where: { schoolId, transactionNumber: { startsWith: prefix } },
    orderBy: { transactionNumber: "desc" },
  });
  const nextNum = lastTxn ? parseInt(lastTxn.transactionNumber.split("/").pop()!) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

export async function getJournalTransactionsAction(filters?: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.JOURNAL_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.status) where.status = filters.status;
  if (filters?.dateFrom || filters?.dateTo) {
    where.date = {};
    if (filters?.dateFrom) (where.date as Record<string, unknown>).gte = new Date(filters.dateFrom);
    if (filters?.dateTo) (where.date as Record<string, unknown>).lte = new Date(filters.dateTo);
  }

  const [transactions, total] = await Promise.all([
    db.journalTransaction.findMany({
      where,
      include: {
        entries: {
          include: {
            debitAccount: { select: { code: true, name: true } },
            creditAccount: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
      skip,
      take: pageSize,
    }),
    db.journalTransaction.count({ where }),
  ]);

  // Resolve user names
  const userIds = [...new Set([...transactions.map((t) => t.createdBy), ...transactions.map((t) => t.approvedBy).filter(Boolean) as string[]])];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } });
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = transactions.map((t) => ({
    ...t,
    createdByName: userMap.get(t.createdBy) ?? "Unknown",
    approvedByName: t.approvedBy ? userMap.get(t.approvedBy) ?? null : null,
    totalAmount: t.entries.reduce((sum, e) => sum + toNum(e.amount), 0),
  }));

  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function createJournalTransactionAction(data: CreateJournalTransactionInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.JOURNAL_CREATE);
  if (denied) return denied;

  const parsed = createJournalTransactionSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  const transactionNumber = await generateTransactionNumber(ctx.schoolId);

  const txn = await db.$transaction(async (tx) => {
    const created = await tx.journalTransaction.create({
      data: {
        schoolId: ctx.schoolId,
        transactionNumber,
        date: parsed.data.date,
        description: parsed.data.description,
        referenceType: parsed.data.referenceType,
        referenceId: parsed.data.referenceId,
        createdBy: ctx.session.user.id,
      },
    });

    await tx.journalEntry.createMany({
      data: parsed.data.entries.map((e) => ({
        schoolId: ctx.schoolId,
        journalTransactionId: created.id,
        debitAccountId: e.debitAccountId,
        creditAccountId: e.creditAccountId,
        amount: e.amount,
        narration: e.narration,
      })),
    });

    return created;
  });

  await audit({ userId: ctx.session.user.id, action: "CREATE", entity: "JournalTransaction", entityId: txn.id, module: "accounting", description: `Created journal ${transactionNumber}` });

  return { data: txn };
}

export async function postJournalTransactionAction(transactionId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.JOURNAL_POST);
  if (denied) return denied;

  const txn = await db.journalTransaction.findUnique({
    where: { id: transactionId },
    include: { entries: true },
  });
  if (!txn) return { error: "Journal transaction not found" };
  if (txn.status !== "DRAFT") return { error: "Only DRAFT transactions can be posted" };

  await db.$transaction(async (tx) => {
    // Post the transaction
    await tx.journalTransaction.update({
      where: { id: transactionId },
      data: { status: "POSTED", approvedBy: ctx.session.user.id, approvedAt: new Date() },
    });

    // Update account balances
    for (const entry of txn.entries) {
      // Debit account: increase for DEBIT-normal accounts, decrease for CREDIT-normal
      await tx.account.update({
        where: { id: entry.debitAccountId },
        data: { currentBalance: { increment: entry.amount } },
      });

      // Credit account: decrease for DEBIT-normal accounts, increase for CREDIT-normal
      await tx.account.update({
        where: { id: entry.creditAccountId },
        data: { currentBalance: { decrement: entry.amount } },
      });
    }
  });

  await audit({ userId: ctx.session.user.id, action: "UPDATE", entity: "JournalTransaction", entityId: transactionId, module: "accounting", description: `Posted journal ${txn.transactionNumber}` });

  return { data: { success: true } };
}

export async function reverseJournalTransactionAction(transactionId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.JOURNAL_REVERSE);
  if (denied) return denied;

  const txn = await db.journalTransaction.findUnique({
    where: { id: transactionId },
    include: { entries: true },
  });
  if (!txn) return { error: "Journal transaction not found" };
  if (txn.status !== "POSTED") return { error: "Only POSTED transactions can be reversed" };
  const reversalNumber = await generateTransactionNumber(ctx.schoolId);

  await db.$transaction(async (tx) => {
    // Mark original as reversed
    await tx.journalTransaction.update({
      where: { id: transactionId },
      data: { status: "REVERSED" },
    });

    // Create reversal transaction with swapped debit/credit
    const reversal = await tx.journalTransaction.create({
      data: {
        schoolId: ctx.schoolId,
        transactionNumber: reversalNumber,
        date: new Date(),
        description: `Reversal of ${txn.transactionNumber}: ${txn.description}`,
        referenceType: "Reversal",
        referenceId: transactionId,
        isAutoGenerated: true,
        createdBy: ctx.session.user.id,
        status: "POSTED",
        approvedBy: ctx.session.user.id,
        approvedAt: new Date(),
      },
    });

    // Create reversed entries (swap debit and credit)
    for (const entry of txn.entries) {
      await tx.journalEntry.create({
        data: {
          schoolId: ctx.schoolId,
          journalTransactionId: reversal.id,
          debitAccountId: entry.creditAccountId,
          creditAccountId: entry.debitAccountId,
          amount: entry.amount,
          narration: `Reversal: ${entry.narration ?? ""}`,
        },
      });

      // Reverse account balance changes
      await tx.account.update({
        where: { id: entry.debitAccountId },
        data: { currentBalance: { decrement: entry.amount } },
      });
      await tx.account.update({
        where: { id: entry.creditAccountId },
        data: { currentBalance: { increment: entry.amount } },
      });
    }
  });

  await audit({ userId: ctx.session.user.id, action: "UPDATE", entity: "JournalTransaction", entityId: transactionId, module: "accounting", description: `Reversed journal ${txn.transactionNumber}` });

  return { data: { success: true } };
}

export async function getGeneralLedgerAction(accountId: string, filters?: { dateFrom?: string; dateTo?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const account = await db.account.findUnique({
    where: { id: accountId },
    include: { category: { select: { type: true } } },
  });
  if (!account) return { error: "Account not found" };

  const dateFilter: Record<string, unknown> = {};
  if (filters?.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
  if (filters?.dateTo) dateFilter.lte = new Date(filters.dateTo);

  const entries = await db.journalEntry.findMany({
    where: {
      OR: [{ debitAccountId: accountId }, { creditAccountId: accountId }],
      journalTransaction: {
        status: "POSTED",
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
    },
    include: {
      journalTransaction: { select: { transactionNumber: true, date: true, description: true } },
      debitAccount: { select: { code: true, name: true } },
      creditAccount: { select: { code: true, name: true } },
    },
    orderBy: { journalTransaction: { date: "asc" } },
  });

  return { data: { account, entries } };
}
