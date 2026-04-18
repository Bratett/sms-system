"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import { postJournalTransaction, findAccountByCode, LedgerError } from "@/modules/accounting/lib/ledger";
import { ACCOUNTS } from "@/modules/accounting/lib/account-codes";

type CreateFiscalPeriodInput = {
  name: string;
  startDate: Date;
  endDate: Date;
  isFiscalYear: boolean;
  fiscalYearId?: string | null;
};

export async function getFiscalPeriodsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.JOURNAL_READ);
  if (denied) return denied;

  const periods = await db.fiscalPeriod.findMany({
    where: { schoolId: ctx.schoolId },
    orderBy: [{ startDate: "desc" }],
    include: { subPeriods: { orderBy: { startDate: "asc" } } },
  });
  return { data: periods };
}

export async function createFiscalPeriodAction(data: CreateFiscalPeriodInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PERIOD_CLOSE);
  if (denied) return denied;

  if (!(data.startDate < data.endDate)) return { error: "Start date must be before end date" };

  const overlap = await db.fiscalPeriod.findFirst({
    where: {
      schoolId: ctx.schoolId,
      isFiscalYear: data.isFiscalYear,
      OR: [
        { startDate: { lte: data.endDate }, endDate: { gte: data.startDate } },
      ],
    },
  });
  if (overlap) return { error: `Overlaps existing period "${overlap.name}"` };

  const period = await db.fiscalPeriod.create({
    data: {
      schoolId: ctx.schoolId,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      isFiscalYear: data.isFiscalYear,
      fiscalYearId: data.fiscalYearId ?? null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "FiscalPeriod",
    entityId: period.id,
    module: "accounting",
    description: `Created fiscal period "${data.name}"`,
  });

  return { data: period };
}

export async function setFiscalPeriodStatusAction(periodId: string, status: "OPEN" | "SOFT_CLOSED" | "CLOSED", closingNotes?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PERIOD_CLOSE);
  if (denied) return denied;

  const period = await db.fiscalPeriod.findUnique({ where: { id: periodId } });
  if (!period) return { error: "Fiscal period not found" };
  if (period.schoolId !== ctx.schoolId) return { error: "Access denied" };

  const updated = await db.fiscalPeriod.update({
    where: { id: periodId },
    data: {
      status,
      closedBy: status !== "OPEN" ? ctx.session.user.id : null,
      closedAt: status !== "OPEN" ? new Date() : null,
      closingNotes: closingNotes ?? period.closingNotes,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "FiscalPeriod",
    entityId: periodId,
    module: "accounting",
    description: `Set fiscal period "${period.name}" status to ${status}`,
  });

  return { data: updated };
}

/**
 * Year-end close: post closing entries that zero out Revenue and Expense accounts
 * into the Income Summary, then transfer Income Summary → Accumulated Surplus/Deficit.
 * Marks the fiscal period CLOSED.
 *
 * Pre-conditions:
 *   - Period must have isFiscalYear = true
 *   - All sub-periods must be SOFT_CLOSED or CLOSED (optional — we allow OPEN with a warning)
 *   - COA must be seeded (we require Income Summary 3900 and Accumulated Surplus 3101)
 */
export async function closeFiscalYearAction(periodId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.PERIOD_CLOSE);
  if (denied) return denied;

  const period = await db.fiscalPeriod.findUnique({ where: { id: periodId } });
  if (!period) return { error: "Fiscal period not found" };
  if (period.schoolId !== ctx.schoolId) return { error: "Access denied" };
  if (!period.isFiscalYear) return { error: "Only fiscal-year periods can be year-end closed" };
  if (period.status === "CLOSED") return { error: "Period is already closed" };

  try {
    const result = await db.$transaction(async (tx) => {
      const incomeSummary = await findAccountByCode(tx, ctx.schoolId, ACCOUNTS.INCOME_SUMMARY);
      const surplus = await findAccountByCode(tx, ctx.schoolId, ACCOUNTS.ACCUMULATED_SURPLUS);
      if (!incomeSummary || !surplus) {
        throw new LedgerError({ code: "ACCOUNT_NOT_FOUND", message: "Income Summary (3900) or Accumulated Surplus (3101) account missing — seed Chart of Accounts first.", accountId: "" });
      }

      // Build ledger balances as-of period end for REVENUE and EXPENSE accounts
      const entries = await tx.journalEntry.findMany({
        where: {
          schoolId: ctx.schoolId,
          journalTransaction: { status: { in: ["POSTED", "REVERSED"] }, date: { lte: period.endDate, gte: period.startDate } },
          account: { category: { type: { in: ["REVENUE", "EXPENSE"] } } },
        },
        include: { account: { include: { category: { select: { type: true } } } } },
      });

      const net = new Map<string, { code: string; name: string; type: "REVENUE" | "EXPENSE"; normal: "DEBIT" | "CREDIT"; balance: number }>();
      for (const e of entries) {
        const cur = net.get(e.accountId) ?? {
          code: e.account.code,
          name: e.account.name,
          type: e.account.category.type as "REVENUE" | "EXPENSE",
          normal: e.account.normalBalance,
          balance: 0,
        };
        const delta = e.side === e.account.normalBalance ? toNum(e.amount) : -toNum(e.amount);
        cur.balance += delta;
        net.set(e.accountId, cur);
      }

      // Closing entry 1: zero out revenue (Dr each Revenue / Cr Income Summary)
      const revenueLines = [];
      let totalRevenue = 0;
      for (const [accId, info] of net.entries()) {
        if (info.type !== "REVENUE" || Math.abs(info.balance) < 0.005) continue;
        revenueLines.push({ accountId: accId, side: "DEBIT" as const, amount: info.balance, narration: `Close ${info.code}` });
        totalRevenue += info.balance;
      }
      let revenueTxnNumber: string | null = null;
      if (revenueLines.length > 0) {
        const posted = await postJournalTransaction(tx, {
          schoolId: ctx.schoolId,
          date: period.endDate,
          description: `Year-end close: zero out Revenue into Income Summary (${period.name})`,
          referenceType: "FiscalClose",
          referenceId: period.id,
          createdBy: ctx.session.user.id,
          isAutoGenerated: true,
          isClosing: true,
          lines: [
            ...revenueLines,
            { accountId: incomeSummary.id, side: "CREDIT", amount: totalRevenue, narration: "Revenue → Income Summary" },
          ],
        });
        revenueTxnNumber = posted.transactionNumber;
      }

      // Closing entry 2: zero out expenses (Dr Income Summary / Cr each Expense)
      const expenseLines = [];
      let totalExpense = 0;
      for (const [accId, info] of net.entries()) {
        if (info.type !== "EXPENSE" || Math.abs(info.balance) < 0.005) continue;
        expenseLines.push({ accountId: accId, side: "CREDIT" as const, amount: info.balance, narration: `Close ${info.code}` });
        totalExpense += info.balance;
      }
      let expenseTxnNumber: string | null = null;
      if (expenseLines.length > 0) {
        const posted = await postJournalTransaction(tx, {
          schoolId: ctx.schoolId,
          date: period.endDate,
          description: `Year-end close: zero out Expenses into Income Summary (${period.name})`,
          referenceType: "FiscalClose",
          referenceId: period.id,
          createdBy: ctx.session.user.id,
          isAutoGenerated: true,
          isClosing: true,
          lines: [
            { accountId: incomeSummary.id, side: "DEBIT", amount: totalExpense, narration: "Income Summary ← Expenses" },
            ...expenseLines,
          ],
        });
        expenseTxnNumber = posted.transactionNumber;
      }

      // Closing entry 3: transfer net result Income Summary → Accumulated Surplus
      const netResult = totalRevenue - totalExpense;
      let transferTxnNumber: string | null = null;
      if (Math.abs(netResult) >= 0.005) {
        const lines: Array<{ accountId: string; side: "DEBIT" | "CREDIT"; amount: number; narration: string }> = netResult > 0
          ? [
              { accountId: incomeSummary.id, side: "DEBIT", amount: netResult, narration: "Close to Accumulated Surplus" },
              { accountId: surplus.id, side: "CREDIT", amount: netResult, narration: `Surplus for ${period.name}` },
            ]
          : [
              { accountId: surplus.id, side: "DEBIT", amount: -netResult, narration: `Deficit for ${period.name}` },
              { accountId: incomeSummary.id, side: "CREDIT", amount: -netResult, narration: "Close from Accumulated Surplus" },
            ];
        const posted = await postJournalTransaction(tx, {
          schoolId: ctx.schoolId,
          date: period.endDate,
          description: `Year-end close: transfer Income Summary to Accumulated Surplus (${period.name})`,
          referenceType: "FiscalClose",
          referenceId: period.id,
          createdBy: ctx.session.user.id,
          isAutoGenerated: true,
          isClosing: true,
          lines,
        });
        transferTxnNumber = posted.transactionNumber;
      }

      await tx.fiscalPeriod.update({
        where: { id: periodId },
        data: { status: "CLOSED", closedBy: ctx.session.user.id, closedAt: new Date() },
      });

      return { totalRevenue, totalExpense, netResult, revenueTxnNumber, expenseTxnNumber, transferTxnNumber };
    });

    await audit({
      userId: ctx.session.user.id,
      action: "UPDATE",
      entity: "FiscalPeriod",
      entityId: periodId,
      module: "accounting",
      description: `Year-end close completed: surplus=${result.netResult.toFixed(2)}`,
      newData: result,
    });

    return { data: result };
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }
}
