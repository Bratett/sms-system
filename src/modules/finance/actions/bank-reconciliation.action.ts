"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  uploadBankStatementSchema,
  type UploadBankStatementInput,
} from "@/modules/finance/schemas/payment-link.schema";
import { toNum } from "@/lib/decimal";
import { postJournalTransaction, findAccountByCode, LedgerError } from "@/modules/accounting/lib/ledger";
import { ACCOUNTS } from "@/modules/accounting/lib/account-codes";

export async function getBankReconciliationsAction(filters?: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.BANK_RECONCILIATION_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.status) where.status = filters.status;

  const [reconciliations, total] = await Promise.all([
    db.bankReconciliation.findMany({
      where,
      orderBy: { uploadedAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.bankReconciliation.count({ where }),
  ]);

  // Resolve user names
  const userIds = [...new Set(reconciliations.map((r) => r.uploadedBy))];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = reconciliations.map((r) => ({
    ...r,
    uploadedByName: userMap.get(r.uploadedBy) ?? "Unknown",
    matchRate: r.totalEntries > 0 ? (r.matchedEntries / r.totalEntries) * 100 : 0,
  }));

  return {
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getReconciliationEntriesAction(reconciliationId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.BANK_RECONCILIATION_READ);
  if (denied) return denied;

  const entries = await db.bankStatementEntry.findMany({
    where: { bankReconciliationId: reconciliationId },
    orderBy: { transactionDate: "desc" },
  });

  return { data: entries };
}

export async function uploadBankStatementAction(data: UploadBankStatementInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.BANK_RECONCILIATION_CREATE);
  if (denied) return denied;

  const parsed = uploadBankStatementSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const reconciliation = await db.$transaction(async (tx) => {
    const recon = await tx.bankReconciliation.create({
      data: {
        schoolId: ctx.schoolId,
        bankName: parsed.data.bankName,
        accountNumber: parsed.data.accountNumber,
        statementDate: parsed.data.statementDate,
        uploadedBy: ctx.session.user.id,
        totalEntries: parsed.data.entries.length,
      },
    });

    await tx.bankStatementEntry.createMany({
      data: parsed.data.entries.map((entry) => ({
        schoolId: ctx.schoolId,
        bankReconciliationId: recon.id,
        transactionDate: entry.transactionDate,
        description: entry.description,
        reference: entry.reference,
        debitAmount: entry.debitAmount,
        creditAmount: entry.creditAmount,
        balance: entry.balance,
      })),
    });

    return recon;
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "BankReconciliation",
    entityId: reconciliation.id,
    module: "finance",
    description: `Uploaded bank statement from ${parsed.data.bankName} with ${parsed.data.entries.length} entries`,
  });

  return { data: reconciliation };
}

export async function autoMatchEntriesAction(reconciliationId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.BANK_RECONCILIATION_MATCH);
  if (denied) return denied;

  const entries = await db.bankStatementEntry.findMany({
    where: { bankReconciliationId: reconciliationId, matchStatus: "UNMATCHED" },
  });

  let matched = 0;

  for (const entry of entries) {
    if (!entry.reference && !entry.creditAmount) continue;

    // Try to match by reference number
    let payment = null;
    if (entry.reference) {
      payment = await db.payment.findFirst({
        where: {
          referenceNumber: entry.reference,
          status: "CONFIRMED",
        },
      });
    }

    // Try to match by amount + date if no reference match
    if (!payment && entry.creditAmount) {
      payment = await db.payment.findFirst({
        where: {
          amount: entry.creditAmount,
          receivedAt: {
            gte: new Date(new Date(entry.transactionDate).setHours(0, 0, 0, 0)),
            lte: new Date(new Date(entry.transactionDate).setHours(23, 59, 59, 999)),
          },
          status: "CONFIRMED",
        },
      });
    }

    if (payment) {
      await db.bankStatementEntry.update({
        where: { id: entry.id },
        data: {
          matchedPaymentId: payment.id,
          matchStatus: "AUTO_MATCHED",
          matchedAt: new Date(),
          matchedBy: ctx.session.user.id,
        },
      });
      matched++;
    }
  }

  // Update reconciliation counts
  const counts = await db.bankStatementEntry.groupBy({
    by: ["matchStatus"],
    where: { bankReconciliationId: reconciliationId },
    _count: true,
  });

  const matchedCount = counts
    .filter((c) => c.matchStatus === "AUTO_MATCHED" || c.matchStatus === "MANUALLY_MATCHED")
    .reduce((sum, c) => sum + c._count, 0);
  const unmatchedCount = counts
    .filter((c) => c.matchStatus === "UNMATCHED" || c.matchStatus === "NO_MATCH")
    .reduce((sum, c) => sum + c._count, 0);

  await db.bankReconciliation.update({
    where: { id: reconciliationId },
    data: {
      matchedEntries: matchedCount,
      unmatchedEntries: unmatchedCount,
      status: unmatchedCount === 0 ? "COMPLETED" : "IN_PROGRESS",
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "BankReconciliation",
    entityId: reconciliationId,
    module: "finance",
    description: `Auto-matched ${matched} of ${entries.length} bank statement entries`,
  });

  return { data: { matched, total: entries.length } };
}

export async function manualMatchEntryAction(entryId: string, paymentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.BANK_RECONCILIATION_MATCH);
  if (denied) return denied;

  const entry = await db.bankStatementEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: "Bank statement entry not found" };

  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { error: "Payment not found" };

  await db.bankStatementEntry.update({
    where: { id: entryId },
    data: {
      matchedPaymentId: paymentId,
      matchStatus: "MANUALLY_MATCHED",
      matchedAt: new Date(),
      matchedBy: ctx.session.user.id,
    },
  });

  // Update reconciliation counts
  const reconId = entry.bankReconciliationId;
  const counts = await db.bankStatementEntry.groupBy({
    by: ["matchStatus"],
    where: { bankReconciliationId: reconId },
    _count: true,
  });

  const matchedCount = counts
    .filter((c) => c.matchStatus === "AUTO_MATCHED" || c.matchStatus === "MANUALLY_MATCHED")
    .reduce((sum, c) => sum + c._count, 0);
  const unmatchedCount = counts
    .filter((c) => c.matchStatus === "UNMATCHED" || c.matchStatus === "NO_MATCH")
    .reduce((sum, c) => sum + c._count, 0);

  await db.bankReconciliation.update({
    where: { id: reconId },
    data: {
      matchedEntries: matchedCount,
      unmatchedEntries: unmatchedCount,
      status: unmatchedCount === 0 ? "COMPLETED" : "IN_PROGRESS",
    },
  });

  await audit({
    userId: ctx.session.user.id,
    schoolId: ctx.schoolId,
    action: "UPDATE",
    entity: "BankStatementEntry",
    entityId: entryId,
    module: "finance",
    description: "Manually matched bank statement entry to payment",
    newData: { matchedPaymentId: paymentId, matchStatus: "MANUALLY_MATCHED" },
  });

  return { data: { success: true } };
}

/**
 * Post an adjusting journal for a bank statement entry that doesn't correspond
 * to an existing Payment record — bank charges, interest earned, direct
 * deposits from unknown payers, reversed cheques, etc.
 *
 * Direction:
 *   - DEBIT bank entry (money in) → Dr Bank / Cr chosen offsetting account
 *   - CREDIT bank entry (money out) → Dr chosen offsetting account / Cr Bank
 *
 * The caller picks the offsetting account (accountCode); common examples:
 *   - Bank charges: 5310 (Bank Charges expense)
 *   - Interest income: 4510 (Investment Income)
 *   - Unidentified deposits pending investigation: 2110 (Accrued Expenses,
 *     as a suspense account) or a custom suspense account
 */
export async function postBankAdjustmentAction(input: {
  bankStatementEntryId: string;
  bankAccountCode: string; // e.g. ACCOUNTS.BANK_GCB
  offsettingAccountCode: string; // e.g. ACCOUNTS.EXPENSE_BANK_CHARGES
  description: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.JOURNAL_CREATE);
  if (denied) return denied;

  const entry = await db.bankStatementEntry.findUnique({
    where: { id: input.bankStatementEntryId },
    include: { bankReconciliation: { select: { schoolId: true } } },
  });
  if (!entry) return { error: "Bank statement entry not found" };
  if (entry.bankReconciliation.schoolId !== ctx.schoolId) return { error: "Access denied" };
  if (entry.matchStatus !== "UNMATCHED" && entry.matchStatus !== "NO_MATCH") {
    return { error: "Entry is already matched or posted" };
  }

  const isInflow = entry.debitAmount != null && toNum(entry.debitAmount) > 0;
  const amount = isInflow ? toNum(entry.debitAmount) : toNum(entry.creditAmount);
  if (!(amount > 0)) return { error: "Entry has no amount" };

  try {
    await db.$transaction(async (tx) => {
      const bank = await findAccountByCode(tx, ctx.schoolId, input.bankAccountCode);
      const offset = await findAccountByCode(tx, ctx.schoolId, input.offsettingAccountCode);
      if (!bank || !offset) {
        throw new LedgerError({ code: "ACCOUNT_NOT_FOUND", message: `Account ${!bank ? input.bankAccountCode : input.offsettingAccountCode} not found`, accountId: "" });
      }
      // Convention: statement "debit" column = money INTO the bank (Dr Bank).
      //             "credit" column = money OUT (Cr Bank).
      const lines = isInflow
        ? [
            { accountId: bank.id, side: "DEBIT" as const, amount, narration: input.description },
            { accountId: offset.id, side: "CREDIT" as const, amount, narration: input.description },
          ]
        : [
            { accountId: offset.id, side: "DEBIT" as const, amount, narration: input.description },
            { accountId: bank.id, side: "CREDIT" as const, amount, narration: input.description },
          ];
      await postJournalTransaction(tx, {
        schoolId: ctx.schoolId,
        date: entry.transactionDate,
        description: `Bank adjustment: ${input.description}`,
        referenceType: "BankAdjustment",
        referenceId: entry.id,
        createdBy: ctx.session.user.id,
        isAutoGenerated: false,
        isAdjusting: true,
        lines,
      });

      await tx.bankStatementEntry.update({
        where: { id: entry.id },
        data: { matchStatus: "MANUALLY_MATCHED", matchedAt: new Date(), matchedBy: ctx.session.user.id },
      });
    });

    await audit({
      userId: ctx.session.user.id,
      action: "CREATE",
      entity: "BankStatementEntry",
      entityId: entry.id,
      module: "finance",
      description: `Posted bank adjustment (${isInflow ? "inflow" : "outflow"} of GHS ${amount}) — ${input.description}`,
    });
    return { data: { success: true } };
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }
}
