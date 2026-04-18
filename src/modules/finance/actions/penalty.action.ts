"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import { PERMISSIONS, requirePermission, assertPermission } from "@/lib/permissions";
import {
  createLatePenaltyRuleSchema,
  updateLatePenaltyRuleSchema,
  type CreateLatePenaltyRuleInput,
  type UpdateLatePenaltyRuleInput,
} from "@/modules/finance/schemas/penalty.schema";
import { postJournalTransaction, reverseJournalTransaction, findAccountByCode, LedgerError } from "@/modules/accounting/lib/ledger";
import { ACCOUNTS } from "@/modules/accounting/lib/account-codes";

export async function getLatePenaltyRulesAction(filters?: { feeStructureId?: string; isActive?: boolean }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.PENALTIES_READ);
  if (permErr) return permErr;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.feeStructureId) where.feeStructureId = filters.feeStructureId;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  const rules = await db.latePenaltyRule.findMany({
    where,
    include: {
      _count: { select: { penalties: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch fee structure names
  const fsIds = rules.map((r) => r.feeStructureId).filter(Boolean) as string[];
  const feeStructures =
    fsIds.length > 0
      ? await db.feeStructure.findMany({
          where: { id: { in: fsIds } },
          select: { id: true, name: true },
        })
      : [];
  const fsMap = new Map(feeStructures.map((fs) => [fs.id, fs.name]));

  const data = rules.map((rule) => ({
    ...rule,
    feeStructureName: rule.feeStructureId ? fsMap.get(rule.feeStructureId) ?? null : null,
    appliedCount: rule._count.penalties,
  }));

  return { data };
}

export async function createLatePenaltyRuleAction(data: CreateLatePenaltyRuleInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.PENALTIES_CREATE);
  if (permErr) return permErr;

  const parsed = createLatePenaltyRuleSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const rule = await db.latePenaltyRule.create({
    data: {
      schoolId: ctx.schoolId,
      name: parsed.data.name,
      feeStructureId: parsed.data.feeStructureId,
      type: parsed.data.type,
      value: parsed.data.value,
      gracePeriodDays: parsed.data.gracePeriodDays ?? 0,
      maxPenalty: parsed.data.maxPenalty,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "LatePenaltyRule",
    entityId: rule.id,
    module: "finance",
    description: `Created late penalty rule "${parsed.data.name}" (${parsed.data.type}: ${parsed.data.value})`,
  });

  return { data: rule };
}

export async function updateLatePenaltyRuleAction(ruleId: string, data: UpdateLatePenaltyRuleInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.PENALTIES_CREATE);
  if (permErr) return permErr;

  const parsed = updateLatePenaltyRuleSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const rule = await db.latePenaltyRule.findFirst({ where: { id: ruleId, schoolId: ctx.schoolId } });
  if (!rule) return { error: "Late penalty rule not found" };

  const updated = await db.latePenaltyRule.update({
    where: { id: ruleId },
    data: parsed.data,
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "LatePenaltyRule",
    entityId: ruleId,
    module: "finance",
    description: `Updated late penalty rule "${updated.name}"`,
  });

  return { data: updated };
}

export async function deleteLatePenaltyRuleAction(ruleId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.PENALTIES_CREATE);
  if (permErr) return permErr;

  const rule = await db.latePenaltyRule.findFirst({
    where: { id: ruleId, schoolId: ctx.schoolId },
    include: { _count: { select: { penalties: true } } },
  });
  if (!rule) return { error: "Late penalty rule not found" };

  if (rule._count.penalties > 0) {
    return { error: "Cannot delete a rule that has applied penalties. Deactivate it instead." };
  }

  await db.latePenaltyRule.deleteMany({ where: { id: ruleId, schoolId: ctx.schoolId } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "LatePenaltyRule",
    entityId: ruleId,
    module: "finance",
    description: `Deleted late penalty rule "${rule.name}"`,
  });

  return { data: { success: true } };
}

export async function applyPenaltiesAction(feeStructureId?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.PENALTIES_APPLY);
  if (permErr) return permErr;

  // Get active penalty rules
  const ruleWhere: Record<string, unknown> = { schoolId: ctx.schoolId, isActive: true };
  if (feeStructureId) ruleWhere.feeStructureId = feeStructureId;

  const rules = await db.latePenaltyRule.findMany({ where: ruleWhere });

  if (rules.length === 0) return { data: { applied: 0, skipped: 0, message: "No active penalty rules found" } };

  // Get overdue bills (unpaid or partial, past due date)
  const now = new Date();
  const billWhere: Record<string, unknown> = {
    status: { in: ["UNPAID", "PARTIAL"] },
    dueDate: { lt: now },
    feeStructure: { schoolId: ctx.schoolId },
  };
  if (feeStructureId) billWhere.feeStructureId = feeStructureId;

  const overdueBills = await db.studentBill.findMany({
    where: billWhere,
    include: { penalties: true, feeStructure: { select: { id: true } } },
  });

  let applied = 0;
  let skipped = 0;

  for (const bill of overdueBills) {
    if (!bill.dueDate) {
      skipped++;
      continue;
    }

    const daysPastDue = Math.floor((now.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24));

    for (const rule of rules) {
      // Rule must apply to this bill's fee structure (or be global)
      if (rule.feeStructureId && rule.feeStructureId !== bill.feeStructureId) continue;

      // Check grace period
      if (daysPastDue <= rule.gracePeriodDays) continue;

      // Existing penalties for this rule+bill (include waived to avoid re-application)
      const existingForRule = bill.penalties.filter((p) => p.latePenaltyRuleId === rule.id);

      // For non-daily types, check if already applied (including waived)
      if (rule.type === "PERCENTAGE" || rule.type === "FIXED_AMOUNT") {
        if (existingForRule.length > 0) {
          skipped++;
          continue;
        }
      }

      // Calculate penalty amount
      let penaltyAmount = 0;
      const outstandingBalance = toNum(bill.balanceAmount);

      switch (rule.type) {
        case "PERCENTAGE":
          penaltyAmount = outstandingBalance * (toNum(rule.value) / 100);
          break;
        case "FIXED_AMOUNT":
          penaltyAmount = toNum(rule.value);
          break;
        case "DAILY_PERCENTAGE": {
          const effectiveDays = daysPastDue - rule.gracePeriodDays;
          // Only compute for days not yet covered by existing penalties
          const newDays = effectiveDays - existingForRule.length;
          if (newDays <= 0) { skipped++; continue; }
          penaltyAmount = outstandingBalance * (toNum(rule.value) / 100) * newDays;
          break;
        }
        case "DAILY_FIXED": {
          const effectiveDays = daysPastDue - rule.gracePeriodDays;
          // Only compute for days not yet covered by existing penalties
          const newDays = effectiveDays - existingForRule.length;
          if (newDays <= 0) { skipped++; continue; }
          penaltyAmount = toNum(rule.value) * newDays;
          break;
        }
      }

      // Apply max penalty cap (include waived penalties in total)
      if (rule.maxPenalty !== null && rule.maxPenalty !== undefined) {
        const existingPenaltyTotal = existingForRule.reduce((sum, p) => sum + toNum(p.amount), 0);

        const remainingAllowance = toNum(rule.maxPenalty) - existingPenaltyTotal;
        if (remainingAllowance <= 0) {
          skipped++;
          continue;
        }
        penaltyAmount = Math.min(penaltyAmount, remainingAllowance);
      }

      penaltyAmount = Math.round(penaltyAmount * 100) / 100;
      if (penaltyAmount <= 0) continue;

      await db.$transaction(async (tx) => {
        const penalty = await tx.appliedPenalty.create({
          data: {
            schoolId: ctx.schoolId,
            studentBillId: bill.id,
            latePenaltyRuleId: rule.id,
            amount: penaltyAmount,
          },
        });

        await tx.studentBill.update({
          where: { id: bill.id },
          data: {
            totalAmount: { increment: penaltyAmount },
            balanceAmount: { increment: penaltyAmount },
          },
        });

        // Double-entry: Dr Student Fees Receivable / Cr Penalty Revenue
        const arAccount = await findAccountByCode(tx, ctx.schoolId, ACCOUNTS.FEES_RECEIVABLE);
        const penaltyRev = await findAccountByCode(tx, ctx.schoolId, ACCOUNTS.PENALTY_REVENUE);
        if (arAccount && penaltyRev) {
          const posted = await postJournalTransaction(tx, {
            schoolId: ctx.schoolId,
            date: new Date(),
            description: `Late payment penalty applied — rule "${rule.name}"`,
            referenceType: "Penalty",
            referenceId: penalty.id,
            createdBy: ctx.session.user.id,
            isAutoGenerated: true,
            lines: [
              { accountId: arAccount.id, side: "DEBIT", amount: penaltyAmount, narration: `Penalty on bill ${bill.id.slice(-8)}` },
              { accountId: penaltyRev.id, side: "CREDIT", amount: penaltyAmount, narration: `Penalty on bill ${bill.id.slice(-8)}` },
            ],
          });
          await tx.appliedPenalty.update({
            where: { id: penalty.id },
            data: { journalTransactionId: posted.journalTransactionId },
          });
        }
      });

      applied++;
    }
  }

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "AppliedPenalty",
    entityId: feeStructureId ?? "all",
    module: "finance",
    description: `Applied late penalties: ${applied} applied, ${skipped} skipped`,
    metadata: { applied, skipped },
  });

  return { data: { applied, skipped } };
}

export async function waivePenaltyAction(penaltyId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.PENALTIES_WAIVE);
  if (permErr) return permErr;

  const penalty = await db.appliedPenalty.findUnique({
    where: { id: penaltyId },
    include: { studentBill: true },
  });
  if (!penalty) return { error: "Penalty not found" };
  if (penalty.waived) return { error: "Penalty has already been waived" };

  try {
    await db.$transaction(async (tx) => {
      await tx.studentBill.update({
        where: { id: penalty.studentBillId },
        data: {
          totalAmount: { decrement: penalty.amount },
          balanceAmount: { decrement: penalty.amount },
        },
      });

      let waiverJournalId: string | null = null;
      if (penalty.journalTransactionId) {
        const reversalTxn = await reverseJournalTransaction(tx, penalty.journalTransactionId, {
          schoolId: ctx.schoolId,
          reversedBy: ctx.session.user.id,
          description: `Penalty waived on bill ${penalty.studentBillId.slice(-8)}`,
        });
        waiverJournalId = reversalTxn.journalTransactionId;
      }

      await tx.appliedPenalty.update({
        where: { id: penaltyId },
        data: {
          waived: true,
          waivedBy: ctx.session.user.id,
          waivedAt: new Date(),
          waiverJournalId,
        },
      });
    });
  } catch (err) {
    if (err instanceof LedgerError) return { error: `Ledger posting failed: ${err.message}` };
    throw err;
  }

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "AppliedPenalty",
    entityId: penaltyId,
    module: "finance",
    description: `Waived penalty of GHS ${toNum(penalty.amount).toFixed(2)}`,
  });

  return { data: { success: true } };
}

export async function getBillPenaltiesAction(studentBillId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;

  const penalties = await db.appliedPenalty.findMany({
    where: { studentBillId },
    include: {
      latePenaltyRule: { select: { name: true, type: true } },
    },
    orderBy: { appliedAt: "desc" },
  });

  return { data: penalties };
}
