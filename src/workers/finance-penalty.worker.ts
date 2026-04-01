import { createWorker, QUEUE_NAMES, type FinancePenaltyJobData } from "@/lib/queue";
import { PrismaClient } from "@prisma/client";
import { toNum } from "@/lib/decimal";

const db = new PrismaClient();

/**
 * Finance Penalty Worker
 * Processes queued late penalty application jobs.
 * Scans overdue bills and applies active penalty rules.
 */
export function startFinancePenaltyWorker() {
  const worker = createWorker<FinancePenaltyJobData>(
    QUEUE_NAMES.FINANCE_PENALTIES,
    async (job) => {
      const { schoolId, feeStructureId, dryRun } = job.data;

      // Get active penalty rules
      const ruleWhere: Record<string, unknown> = { schoolId, isActive: true };
      if (feeStructureId) ruleWhere.feeStructureId = feeStructureId;

      const rules = await db.latePenaltyRule.findMany({ where: ruleWhere });
      if (rules.length === 0) return;

      const now = new Date();

      // Get overdue bills
      const billWhere: Record<string, unknown> = {
        status: { in: ["UNPAID", "PARTIAL"] },
        dueDate: { lt: now },
        feeStructure: { schoolId },
      };
      if (feeStructureId) billWhere.feeStructureId = feeStructureId;

      const overdueBills = await db.studentBill.findMany({
        where: billWhere,
        include: { penalties: true },
      });

      let applied = 0;

      for (const bill of overdueBills) {
        if (!bill.dueDate) continue;
        const daysPastDue = Math.floor((now.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24));

        for (const rule of rules) {
          if (rule.feeStructureId && rule.feeStructureId !== bill.feeStructureId) continue;
          if (daysPastDue <= rule.gracePeriodDays) continue;

          // Calculate penalty
          let penaltyAmount = 0;
          switch (rule.type) {
            case "PERCENTAGE":
              penaltyAmount = toNum(bill.balanceAmount) * (toNum(rule.value) / 100);
              break;
            case "FIXED_AMOUNT":
              penaltyAmount = toNum(rule.value);
              break;
            case "DAILY_PERCENTAGE":
              penaltyAmount = toNum(bill.balanceAmount) * (toNum(rule.value) / 100) * (daysPastDue - rule.gracePeriodDays);
              break;
            case "DAILY_FIXED":
              penaltyAmount = toNum(rule.value) * (daysPastDue - rule.gracePeriodDays);
              break;
          }

          // Apply max penalty cap
          if (rule.maxPenalty !== null) {
            const existingTotal = bill.penalties
              .filter((p) => p.latePenaltyRuleId === rule.id && !p.waived)
              .reduce((sum, p) => sum + toNum(p.amount), 0);
            const remaining = toNum(rule.maxPenalty) - existingTotal;
            if (remaining <= 0) continue;
            penaltyAmount = Math.min(penaltyAmount, remaining);
          }

          // Skip if one-time penalty already applied
          if ((rule.type === "PERCENTAGE" || rule.type === "FIXED_AMOUNT") &&
            bill.penalties.some((p) => p.latePenaltyRuleId === rule.id && !p.waived)) {
            continue;
          }

          penaltyAmount = Math.round(penaltyAmount * 100) / 100;
          if (penaltyAmount <= 0) continue;

          if (!dryRun) {
            await db.$transaction(async (tx) => {
              await tx.appliedPenalty.create({
                data: { studentBillId: bill.id, latePenaltyRuleId: rule.id, amount: penaltyAmount },
              });
              await tx.studentBill.update({
                where: { id: bill.id },
                data: { totalAmount: { increment: penaltyAmount }, balanceAmount: { increment: penaltyAmount } },
              });
            });
          }

          applied++;
        }
      }

      console.log(`[Penalty Worker] ${dryRun ? "Dry run:" : "Applied"} ${applied} penalties across ${overdueBills.length} overdue bills`);
    },
    { concurrency: 1 },
  );

  worker.on("completed", (job) => {
    console.log(`[Penalty Worker] Job completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Penalty Worker] Job failed: ${job?.id}`, err.message);
  });

  return worker;
}
