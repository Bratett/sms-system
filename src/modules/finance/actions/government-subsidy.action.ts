"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import { PERMISSIONS, requirePermission, assertPermission } from "@/lib/permissions";
import {
  createGovernmentSubsidySchema,
  updateGovernmentSubsidySchema,
  recordDisbursementSchema,
  type CreateGovernmentSubsidyInput,
  type UpdateGovernmentSubsidyInput,
  type RecordDisbursementInput,
} from "@/modules/finance/schemas/government-subsidy.schema";
import { postJournalTransaction, findAccountByCode, LedgerError } from "@/modules/accounting/lib/ledger";
import { ACCOUNTS } from "@/modules/accounting/lib/account-codes";

export async function getGovernmentSubsidiesAction(filters?: {
  academicYearId?: string;
  subsidyType?: string;
  status?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.SUBSIDIES_READ);
  if (permErr) return permErr;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters?.subsidyType) where.subsidyType = filters.subsidyType;
  if (filters?.status) where.status = filters.status;

  const subsidies = await db.governmentSubsidy.findMany({
    where,
    include: {
      disbursements: { orderBy: { receivedAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Resolve academic year and term names
  const ayIds = [...new Set(subsidies.map((s) => s.academicYearId))];
  const termIds = subsidies.map((s) => s.termId).filter(Boolean) as string[];

  const [academicYears, terms] = await Promise.all([
    db.academicYear.findMany({
      where: { id: { in: ayIds } },
      select: { id: true, name: true },
    }),
    termIds.length > 0
      ? db.term.findMany({
          where: { id: { in: termIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const ayMap = new Map(academicYears.map((ay) => [ay.id, ay.name]));
  const termMap = new Map(terms.map((t) => [t.id, t.name]));

  const data = subsidies.map((s) => ({
    ...s,
    academicYearName: ayMap.get(s.academicYearId) ?? "Unknown",
    termName: s.termId ? termMap.get(s.termId) ?? null : null,
    variance: toNum(s.expectedAmount) - toNum(s.receivedAmount),
    disbursementCount: s.disbursements.length,
  }));

  return { data };
}

export async function getGovernmentSubsidyAction(subsidyId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const subsidy = await db.governmentSubsidy.findUnique({
    where: { id: subsidyId },
    include: {
      disbursements: { orderBy: { receivedAt: "desc" } },
    },
  });

  if (!subsidy) return { error: "Subsidy not found" };

  // Resolve user names for disbursement recorders
  const userIds = [...new Set(subsidy.disbursements.map((d) => d.recordedBy))];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  return {
    data: {
      ...subsidy,
      disbursements: subsidy.disbursements.map((d) => ({
        ...d,
        recordedByName: userMap.get(d.recordedBy) ?? "Unknown",
      })),
    },
  };
}

export async function createGovernmentSubsidyAction(data: CreateGovernmentSubsidyInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.SUBSIDIES_CREATE);
  if (permErr) return permErr;

  const parsed = createGovernmentSubsidySchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const subsidy = await db.governmentSubsidy.create({
    data: {
      schoolId: ctx.schoolId,
      name: parsed.data.name,
      subsidyType: parsed.data.subsidyType,
      academicYearId: parsed.data.academicYearId,
      termId: parsed.data.termId,
      expectedAmount: parsed.data.expectedAmount,
      referenceNumber: parsed.data.referenceNumber,
      notes: parsed.data.notes,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "GovernmentSubsidy",
    entityId: subsidy.id,
    module: "finance",
    description: `Created ${parsed.data.subsidyType} subsidy "${parsed.data.name}" (expected: GHS ${parsed.data.expectedAmount})`,
  });

  return { data: subsidy };
}

export async function updateGovernmentSubsidyAction(subsidyId: string, data: UpdateGovernmentSubsidyInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.SUBSIDIES_UPDATE);
  if (permErr) return permErr;

  const parsed = updateGovernmentSubsidySchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const subsidy = await db.governmentSubsidy.findUnique({ where: { id: subsidyId } });
  if (!subsidy) return { error: "Subsidy not found" };

  const updated = await db.governmentSubsidy.update({
    where: { id: subsidyId },
    data: parsed.data,
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "GovernmentSubsidy",
    entityId: subsidyId,
    module: "finance",
    description: `Updated subsidy "${updated.name}"`,
  });

  return { data: updated };
}

export async function recordDisbursementAction(data: RecordDisbursementInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.SUBSIDIES_RECORD_DISBURSEMENT);
  if (permErr) return permErr;

  const parsed = recordDisbursementSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const subsidy = await db.governmentSubsidy.findUnique({
    where: { id: parsed.data.governmentSubsidyId },
  });
  if (!subsidy) return { error: "Subsidy not found" };

  let ledgerError: string | null = null;
  const updated = await db.$transaction(async (tx) => {
    const disbursement = await tx.subsidyDisbursement.create({
      data: {
        schoolId: ctx.schoolId,
        governmentSubsidyId: subsidy.id,
        amount: parsed.data.amount,
        receivedAt: parsed.data.receivedAt,
        bankReference: parsed.data.bankReference,
        recordedBy: ctx.session.user.id,
        notes: parsed.data.notes,
      },
    });

    const updatedSubsidy = await tx.governmentSubsidy.update({
      where: { id: subsidy.id },
      data: {
        receivedAmount: { increment: parsed.data.amount },
        receivedAt: new Date(),
      },
    });

    const newStatus = toNum(updatedSubsidy.receivedAmount) >= toNum(subsidy.expectedAmount)
      ? "RECEIVED"
      : "PARTIALLY_RECEIVED";

    let finalSubsidy = updatedSubsidy;
    if (updatedSubsidy.status !== newStatus) {
      finalSubsidy = await tx.governmentSubsidy.update({
        where: { id: subsidy.id },
        data: { status: newStatus },
      });
    }

    // Double-entry: Dr Bank / Cr Grant Revenue (unconditional) OR Deferred Inflow (conditional, IPSAS 23)
    try {
      const bank = await findAccountByCode(tx, ctx.schoolId, ACCOUNTS.BANK_GCB);
      const creditCode = subsidy.isConditional ? ACCOUNTS.DEFERRED_GRANTS : ACCOUNTS.GRANT_REVENUE_UNCONDITIONAL;
      const creditAcc = await findAccountByCode(tx, ctx.schoolId, creditCode);
      if (bank && creditAcc) {
        const posted = await postJournalTransaction(tx, {
          schoolId: ctx.schoolId,
          date: parsed.data.receivedAt,
          description: `Government subsidy received — ${subsidy.name}${subsidy.isConditional ? " (deferred, conditional)" : ""}`,
          referenceType: "Subsidy",
          referenceId: disbursement.id,
          createdBy: ctx.session.user.id,
          isAutoGenerated: true,
          lines: [
            { accountId: bank.id, side: "DEBIT", amount: parsed.data.amount, narration: parsed.data.bankReference ?? undefined, fundId: subsidy.fundId ?? undefined },
            { accountId: creditAcc.id, side: "CREDIT", amount: parsed.data.amount, narration: subsidy.name, fundId: subsidy.fundId ?? undefined },
          ],
        });
        await tx.subsidyDisbursement.update({
          where: { id: disbursement.id },
          data: { journalTransactionId: posted.journalTransactionId },
        });
      }
    } catch (err) {
      if (err instanceof LedgerError) ledgerError = err.message;
      else throw err;
    }

    return finalSubsidy;
  });

  if (ledgerError) return { error: `Ledger posting failed: ${ledgerError}` };

  const newReceivedTotal = toNum(updated.receivedAmount);

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "SubsidyDisbursement",
    entityId: subsidy.id,
    module: "finance",
    description: `Recorded disbursement of GHS ${parsed.data.amount} for "${subsidy.name}" (total received: GHS ${newReceivedTotal})`,
  });

  return { data: { newReceivedTotal, remainingAmount: toNum(subsidy.expectedAmount) - newReceivedTotal } };
}

export async function deleteGovernmentSubsidyAction(subsidyId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const subsidy = await db.governmentSubsidy.findUnique({
    where: { id: subsidyId },
    include: { _count: { select: { disbursements: true } } },
  });
  if (!subsidy) return { error: "Subsidy not found" };

  if (subsidy._count.disbursements > 0) {
    return { error: "Cannot delete a subsidy that has recorded disbursements" };
  }

  await db.governmentSubsidy.delete({ where: { id: subsidyId } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "GovernmentSubsidy",
    entityId: subsidyId,
    module: "finance",
    description: `Deleted subsidy "${subsidy.name}"`,
  });

  return { data: { success: true } };
}

export async function getSubsidySummaryAction(academicYearId?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (academicYearId) where.academicYearId = academicYearId;

  const subsidies = await db.governmentSubsidy.findMany({ where });

  const totalExpected = subsidies.reduce((sum, s) => sum + toNum(s.expectedAmount), 0);
  const totalReceived = subsidies.reduce((sum, s) => sum + toNum(s.receivedAmount), 0);
  const totalVariance = totalExpected - totalReceived;

  const byType = new Map<string, { type: string; expected: number; received: number; count: number }>();
  for (const s of subsidies) {
    const entry = byType.get(s.subsidyType) ?? { type: s.subsidyType, expected: 0, received: 0, count: 0 };
    entry.expected += toNum(s.expectedAmount);
    entry.received += toNum(s.receivedAmount);
    entry.count++;
    byType.set(s.subsidyType, entry);
  }

  return {
    data: {
      totalExpected,
      totalReceived,
      totalVariance,
      receiptRate: totalExpected > 0 ? (totalReceived / totalExpected) * 100 : 0,
      count: subsidies.length,
      byType: Array.from(byType.values()),
      overdueCount: subsidies.filter((s) => s.status === "OVERDUE").length,
    },
  };
}
