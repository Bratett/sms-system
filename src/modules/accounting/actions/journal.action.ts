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
import {
  LedgerError,
  postJournalTransaction,
  recomputeAccountBalances,
  reverseJournalTransaction,
} from "@/modules/accounting/lib/ledger";

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
            account: { select: { code: true, name: true, normalBalance: true } },
            fund: { select: { code: true, name: true } },
          },
          orderBy: { lineOrder: "asc" },
        },
        fiscalPeriod: { select: { name: true, status: true } },
      },
      orderBy: { date: "desc" },
      skip,
      take: pageSize,
    }),
    db.journalTransaction.count({ where }),
  ]);

  const userIds = [
    ...new Set([
      ...transactions.map((t) => t.createdBy),
      ...(transactions.map((t) => t.postedBy).filter(Boolean) as string[]),
      ...(transactions.map((t) => t.reversedBy).filter(Boolean) as string[]),
    ]),
  ];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } });
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = transactions.map((t) => ({
    ...t,
    createdByName: userMap.get(t.createdBy) ?? "Unknown",
    postedByName: t.postedBy ? userMap.get(t.postedBy) ?? null : null,
    reversedByName: t.reversedBy ? userMap.get(t.reversedBy) ?? null : null,
    totalDebits: t.entries.filter((e) => e.side === "DEBIT").reduce((s, e) => s + toNum(e.amount), 0),
    totalCredits: t.entries.filter((e) => e.side === "CREDIT").reduce((s, e) => s + toNum(e.amount), 0),
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

  try {
    const result = await db.$transaction(async (tx) => {
      return postJournalTransaction(tx, {
        schoolId: ctx.schoolId,
        date: parsed.data.date,
        description: parsed.data.description,
        referenceType: parsed.data.referenceType ?? "Manual",
        referenceId: parsed.data.referenceId,
        createdBy: ctx.session.user.id,
        lines: parsed.data.lines.map((l) => ({
          accountId: l.accountId,
          side: l.side,
          amount: l.amount,
          narration: l.narration,
          fundId: l.fundId,
        })),
      });
    });

    await audit({
      userId: ctx.session.user.id,
      action: "CREATE",
      entity: "JournalTransaction",
      entityId: result.journalTransactionId,
      module: "accounting",
      description: `Created and posted journal ${result.transactionNumber}`,
      newData: { journalTransactionId: result.journalTransactionId },
    });

    return { data: { id: result.journalTransactionId, transactionNumber: result.transactionNumber } };
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }
}

/**
 * Kept for backwards compatibility. Under the new model every journal is posted
 * atomically with creation via `createJournalTransactionAction`, so this just
 * validates and no-ops for already-posted entries, or posts any lingering DRAFT.
 */
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
  if (txn.schoolId !== ctx.schoolId) return { error: "Access denied" };
  if (txn.status === "POSTED") return { data: { success: true, alreadyPosted: true } };
  if (txn.status === "REVERSED") return { error: "Cannot post a reversed transaction" };

  // DRAFT entries created before the refactor — repost them via the helper
  // after deleting their existing entries so balances are applied correctly.
  try {
    await db.$transaction(async (tx) => {
      await tx.journalEntry.deleteMany({ where: { journalTransactionId: transactionId } });
      await tx.journalTransaction.delete({ where: { id: transactionId } });
      await postJournalTransaction(tx, {
        schoolId: txn.schoolId,
        date: txn.date,
        description: txn.description,
        referenceType: txn.referenceType,
        referenceId: txn.referenceId,
        createdBy: txn.createdBy,
        postedBy: ctx.session.user.id,
        isAutoGenerated: txn.isAutoGenerated,
        lines: txn.entries.map((e) => ({
          accountId: e.accountId,
          side: e.side,
          amount: toNum(e.amount),
          narration: e.narration ?? undefined,
          fundId: e.fundId,
        })),
      });
    });

    await audit({ userId: ctx.session.user.id, action: "UPDATE", entity: "JournalTransaction", entityId: transactionId, module: "accounting", description: `Posted journal ${txn.transactionNumber}` });
    return { data: { success: true } };
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }
}

export async function reverseJournalTransactionAction(transactionId: string, reason?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.JOURNAL_REVERSE);
  if (denied) return denied;

  try {
    const result = await db.$transaction(async (tx) => {
      return reverseJournalTransaction(tx, transactionId, {
        schoolId: ctx.schoolId,
        reversedBy: ctx.session.user.id,
        description: reason,
      });
    });

    await audit({
      userId: ctx.session.user.id,
      action: "UPDATE",
      entity: "JournalTransaction",
      entityId: transactionId,
      module: "accounting",
      description: `Reversed journal, reversal=${result.transactionNumber}`,
    });
    return { data: { success: true, reversalTransactionNumber: result.transactionNumber } };
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }
}

export async function getGeneralLedgerAction(accountId: string, filters?: { dateFrom?: string; dateTo?: string; fundId?: string }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.JOURNAL_READ);
  if (denied) return denied;

  const account = await db.account.findUnique({
    where: { id: accountId },
    include: { category: { select: { name: true, type: true } } },
  });
  if (!account) return { error: "Account not found" };
  if (account.schoolId !== ctx.schoolId) return { error: "Access denied" };

  const dateFrom = filters?.dateFrom ? new Date(filters.dateFrom) : null;
  const dateTo = filters?.dateTo ? new Date(filters.dateTo) : null;

  // Opening balance: sum all entries strictly before dateFrom (respecting fund filter).
  // When no dateFrom is supplied, opening = 0 and the running balance starts from nothing.
  let openingBalance = 0;
  if (dateFrom) {
    const priorEntries = await db.journalEntry.findMany({
      where: {
        accountId,
        ...(filters?.fundId ? { fundId: filters.fundId } : {}),
        journalTransaction: {
          status: { in: ["POSTED", "REVERSED"] },
          date: { lt: dateFrom },
        },
      },
      select: { side: true, amount: true },
    });
    for (const e of priorEntries) {
      const delta = e.side === account.normalBalance ? toNum(e.amount) : -toNum(e.amount);
      openingBalance += delta;
    }
    openingBalance = Math.round(openingBalance * 100) / 100;
  }

  const dateFilter: Record<string, unknown> = {};
  if (dateFrom) dateFilter.gte = dateFrom;
  if (dateTo) dateFilter.lte = dateTo;

  const entries = await db.journalEntry.findMany({
    where: {
      accountId,
      ...(filters?.fundId ? { fundId: filters.fundId } : {}),
      journalTransaction: {
        // Include POSTED + REVERSED so the running balance ties to currentBalance.
        status: { in: ["POSTED", "REVERSED"] },
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
    },
    include: {
      journalTransaction: {
        select: {
          id: true,
          transactionNumber: true,
          date: true,
          description: true,
          referenceType: true,
          referenceId: true,
          status: true,
          // Include ALL entries of the transaction for drill-through; the UI
          // renders them in a modal without needing another round trip.
          entries: {
            select: {
              id: true,
              side: true,
              amount: true,
              narration: true,
              account: { select: { code: true, name: true, normalBalance: true } },
              fund: { select: { code: true, name: true } },
            },
            orderBy: [{ side: "asc" }, { lineOrder: "asc" }],
          },
        },
      },
      fund: { select: { code: true, name: true } },
    },
    orderBy: [{ journalTransaction: { date: "asc" } }, { journalTransaction: { transactionNumber: "asc" } }, { lineOrder: "asc" }],
  });

  // Compute running balance using normalBalance direction, starting from openingBalance.
  let running = openingBalance;
  let periodDebits = 0;
  let periodCredits = 0;
  const rows = entries.map((e) => {
    const debit = e.side === "DEBIT" ? toNum(e.amount) : 0;
    const credit = e.side === "CREDIT" ? toNum(e.amount) : 0;
    const delta = e.side === account.normalBalance ? toNum(e.amount) : -toNum(e.amount);
    running += delta;
    periodDebits += debit;
    periodCredits += credit;
    return {
      id: e.id,
      date: e.journalTransaction.date,
      transactionNumber: e.journalTransaction.transactionNumber,
      transactionId: e.journalTransaction.id,
      description: e.journalTransaction.description,
      referenceType: e.journalTransaction.referenceType,
      referenceId: e.journalTransaction.referenceId,
      status: e.journalTransaction.status,
      side: e.side,
      debit,
      credit,
      narration: e.narration,
      fund: e.fund,
      runningBalance: Math.round(running * 100) / 100,
      allEntries: e.journalTransaction.entries.map((l) => ({
        id: l.id,
        side: l.side,
        amount: toNum(l.amount),
        narration: l.narration,
        accountCode: l.account.code,
        accountName: l.account.name,
        fund: l.fund,
      })),
    };
  });

  const closingBalance = Math.round(running * 100) / 100;

  return {
    data: {
      account,
      openingBalance,
      periodDebits: Math.round(periodDebits * 100) / 100,
      periodCredits: Math.round(periodCredits * 100) / 100,
      netMovement: Math.round((periodDebits - periodCredits) * 100) / 100,
      closingBalance,
      entries: rows,
      filters: {
        dateFrom: dateFrom?.toISOString() ?? null,
        dateTo: dateTo?.toISOString() ?? null,
        fundId: filters?.fundId ?? null,
      },
    },
  };
}

/**
 * Admin utility: recompute every account's currentBalance from POSTED journal
 * entries. Run after schema migrations or when data drift is suspected.
 */
export async function recomputeAccountBalancesAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.JOURNAL_POST);
  if (denied) return denied;

  const diffs = await db.$transaction(async (tx) => recomputeAccountBalances(tx, ctx.schoolId));

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "Account",
    entityId: ctx.schoolId,
    module: "accounting",
    description: `Recomputed account balances (${diffs.length} accounts corrected)`,
    newData: { diffs: diffs.slice(0, 20) },
  });

  return { data: { corrected: diffs.length, diffs } };
}
