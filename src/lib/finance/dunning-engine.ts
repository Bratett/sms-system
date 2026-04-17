import { db } from "@/lib/db";
import { toNum } from "@/lib/decimal";
import { logger } from "@/lib/logger";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import type {
  DunningPolicy,
  DunningStage,
  StudentBill,
} from "@prisma/client";

const log = logger.child({ mod: "dunning-engine" });

export interface DunningRunResult {
  runId: string;
  totalBills: number;
  casesCreated: number;
  casesEscalated: number;
  casesResolved: number;
  eventsSent: number;
  errors: number;
  perStage: Record<number, number>;
}

type PolicyWithStages = DunningPolicy & { stages: DunningStage[] };

interface ExecuteOptions {
  triggeredBy: string;
  triggerType?: "MANUAL" | "SCHEDULED" | "WEBHOOK";
  dryRun?: boolean;
  now?: Date;
}

/**
 * Core dunning engine. For a given policy, walks all StudentBills matching
 * the policy scope and advances each one through the stage ladder.
 *
 * Each bill becomes a DunningCase the first time a stage fires, and every
 * stage execution writes a DunningEvent (immutable audit row). Suppression
 * rules (active installment, approved aid) halt escalation without closing
 * the case — so if the installment plan falls behind, the next run picks
 * up where it left off.
 *
 * Safe under re-run: stage execution is gated by `stagesCleared` on the
 * case, and the case's unique key (studentBillId+policyId) prevents double-
 * opens across concurrent runs.
 */
export async function executeDunningRun(
  policyId: string,
  opts: ExecuteOptions,
): Promise<DunningRunResult> {
  const now = opts.now ?? new Date();
  const policy = (await db.dunningPolicy.findUnique({
    where: { id: policyId },
    include: { stages: { orderBy: { order: "asc" } } },
  })) as PolicyWithStages | null;
  if (!policy) throw new Error("Dunning policy not found");
  if (!policy.isActive) throw new Error("Dunning policy is inactive");
  if (policy.stages.length === 0) throw new Error("Dunning policy has no stages");

  const run = await db.dunningRun.create({
    data: {
      schoolId: policy.schoolId,
      policyId: policy.id,
      triggeredBy: opts.triggeredBy,
      triggerType: opts.triggerType ?? "MANUAL",
      status: "RUNNING",
    },
  });

  const perStage: Record<number, number> = {};
  let casesCreated = 0;
  let casesEscalated = 0;
  let casesResolved = 0;
  let eventsSent = 0;
  let errors = 0;

  const bills = await selectBillsForPolicy(policy, now);

  for (const bill of bills) {
    try {
      const daysOverdue = daysBetween(bill.dueDate ?? bill.generatedAt, now);

      // Determine target stage: the highest stage whose daysOverdue <= current
      const targetStage = policy.stages
        .slice()
        .reverse()
        .find((s) => daysOverdue >= s.daysOverdue);
      if (!targetStage) continue; // not yet overdue enough for any stage

      if (await isSuppressed(policy, bill)) {
        continue;
      }

      // Upsert case
      const caseRow = await db.dunningCase.upsert({
        where: {
          studentBillId_policyId: { studentBillId: bill.id, policyId: policy.id },
        },
        create: {
          schoolId: policy.schoolId,
          policyId: policy.id,
          studentBillId: bill.id,
          studentId: bill.studentId,
          currentStageId: targetStage.id,
          stagesCleared: 0,
          status: "OPEN",
        },
        update: {},
      });
      if (caseRow.stagesCleared === 0 && caseRow.currentStageId === targetStage.id) {
        casesCreated++;
      }

      // Fire every stage from (stagesCleared + 1) up through targetStage.order
      const stagesToFire = policy.stages.filter(
        (s) => s.order > caseRow.stagesCleared && s.order <= targetStage.order,
      );
      if (stagesToFire.length === 0) continue;

      for (const stage of stagesToFire) {
        perStage[stage.order] = (perStage[stage.order] ?? 0) + 1;
        if (stage.escalateToRole) casesEscalated++;

        if (opts.dryRun) {
          eventsSent++;
          continue;
        }

        // Emit an event per channel + penalty + escalation
        const outcome = await fireStage({
          schoolId: policy.schoolId,
          runId: run.id,
          caseId: caseRow.id,
          stage,
          bill,
        });
        eventsSent += outcome.eventCount;
        if (outcome.errors) errors += outcome.errors;
      }

      // Update case progression
      if (!opts.dryRun) {
        await db.dunningCase.update({
          where: { id: caseRow.id },
          data: {
            currentStageId: targetStage.id,
            stagesCleared: targetStage.order,
            status: targetStage.escalateToRole ? "ESCALATED" : "OPEN",
            lastActionAt: now,
          },
        });
      }
    } catch (err) {
      errors++;
      log.error("bill dunning failed", { billId: bill.id, policyId, err });
    }
  }

  // Auto-resolve cases whose underlying bill has cleared
  if (!opts.dryRun) {
    const cleared = await db.dunningCase.updateMany({
      where: {
        policyId: policy.id,
        status: { in: ["OPEN", "ESCALATED", "PAUSED"] },
        studentBillId: {
          in: await db.studentBill
            .findMany({
              where: {
                schoolId: policy.schoolId,
                OR: [{ balanceAmount: { lte: 0 } }, { status: "PAID" }, { status: "WAIVED" }],
              },
              select: { id: true },
            })
            .then((r) => r.map((x) => x.id)),
        },
      },
      data: { status: "RESOLVED", resolvedAt: now, resolution: "PAID" },
    });
    casesResolved = cleared.count;
  }

  const completedAt = new Date();
  await db.dunningRun.update({
    where: { id: run.id },
    data: {
      status: errors > 0 ? "FAILED" : "COMPLETED",
      completedAt,
      totalBills: bills.length,
      casesCreated,
      casesEscalated,
      casesResolved,
      eventsSent,
      errors,
      summary: { perStage, dryRun: !!opts.dryRun },
    },
  });

  log.info("dunning run finished", {
    runId: run.id,
    policyId,
    totalBills: bills.length,
    eventsSent,
    errors,
  });

  return {
    runId: run.id,
    totalBills: bills.length,
    casesCreated,
    casesEscalated,
    casesResolved,
    eventsSent,
    errors,
    perStage,
  };
}

async function selectBillsForPolicy(
  policy: PolicyWithStages,
  now: Date,
): Promise<StudentBill[]> {
  const where: Record<string, unknown> = {
    schoolId: policy.schoolId,
    status: { in: ["UNPAID", "PARTIAL"] },
    balanceAmount: { gt: toNum(policy.minBalance) },
  };

  switch (policy.scope) {
    case "FEE_STRUCTURE":
      if (policy.feeStructureId) where.feeStructureId = policy.feeStructureId;
      break;
    case "PROGRAMME":
      // bills don't carry programmeId; resolve via feeStructure
      where.feeStructure = { programmeId: policy.programmeId };
      break;
    case "BOARDING_ONLY":
      where.feeStructure = { boardingStatus: "BOARDING" };
      break;
    case "DAY_ONLY":
      where.feeStructure = { boardingStatus: "DAY" };
      break;
    case "ALL_OUTSTANDING":
    default:
      break;
  }

  // Only bills that are past the earliest stage's threshold
  const earliestDays = Math.min(...policy.stages.map((s) => s.daysOverdue));
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - earliestDays);
  where.OR = [
    { dueDate: { lte: cutoff } },
    { AND: [{ dueDate: null }, { generatedAt: { lte: cutoff } }] },
  ];

  return db.studentBill.findMany({ where, take: 2000 });
}

async function isSuppressed(
  policy: PolicyWithStages,
  bill: StudentBill,
): Promise<boolean> {
  if (policy.suppressOnInstallment) {
    const activeInstallments = await db.studentInstallment.count({
      where: {
        studentBillId: bill.id,
        status: { in: ["PENDING", "PARTIAL"] },
      },
    });
    if (activeInstallments > 0) return true;
  }
  if (policy.suppressOnAid) {
    const approvedAid = await db.financialAidApplication.count({
      where: {
        studentId: bill.studentId,
        schoolId: policy.schoolId,
        status: "APPROVED",
      },
    });
    if (approvedAid > 0) return true;
  }
  return false;
}

interface FireStageArgs {
  schoolId: string;
  runId: string;
  caseId: string;
  stage: DunningStage;
  bill: StudentBill;
}

async function fireStage(args: FireStageArgs): Promise<{ eventCount: number; errors: number }> {
  const { schoolId, runId, caseId, stage, bill } = args;
  let eventCount = 0;
  let errors = 0;

  // Penalty leg
  if (stage.applyPenaltyId) {
    try {
      const rule = await db.latePenaltyRule.findUnique({ where: { id: stage.applyPenaltyId } });
      if (rule && rule.isActive) {
        const already = await db.appliedPenalty.count({
          where: {
            studentBillId: bill.id,
            latePenaltyRuleId: rule.id,
          },
        });
        if (already === 0) {
          const amount = computePenaltyAmount(rule, bill);
          const applied = await db.appliedPenalty.create({
            data: {
              schoolId,
              studentBillId: bill.id,
              latePenaltyRuleId: rule.id,
              amount,
            },
          });
          await db.dunningEvent.create({
            data: {
              schoolId,
              runId,
              caseId,
              stageId: stage.id,
              stageOrder: stage.order,
              studentBillId: bill.id,
              studentId: bill.studentId,
              channel: "penalty",
              status: "SENT",
              templateKey: stage.templateKey,
              externalRef: applied.id,
              payload: { amount: toNum(amount) },
            },
          });
          eventCount++;
        }
      }
    } catch (err) {
      errors++;
      log.error("penalty leg failed", { err, stageId: stage.id });
    }
  }

  // Notification legs (one event per channel for traceability)
  const student = await db.student.findUnique({
    where: { id: bill.studentId },
    select: {
      firstName: true,
      lastName: true,
      guardians: {
        where: { isPrimary: true },
        select: {
          guardian: { select: { id: true, firstName: true, phone: true, email: true } },
        },
        take: 1,
      },
    },
  });
  const guardian = student?.guardians[0]?.guardian ?? null;

  for (const channel of stage.channels) {
    try {
      if (!guardian) {
        await db.dunningEvent.create({
          data: {
            schoolId,
            runId,
            caseId,
            stageId: stage.id,
            stageOrder: stage.order,
            studentBillId: bill.id,
            studentId: bill.studentId,
            channel,
            status: "SKIPPED",
            templateKey: stage.templateKey,
            errorMessage: "No primary guardian contact",
          },
        });
        continue;
      }

      const studentName = student ? `${student.firstName} ${student.lastName}` : "student";
      const amount = `GHS ${toNum(bill.balanceAmount).toFixed(2)}`;
      const dueDate = bill.dueDate
        ? new Date(bill.dueDate).toLocaleDateString("en-GH")
        : "not set";
      const title = `Outstanding school fees — ${stage.name}`;
      const body =
        `Dear ${guardian.firstName}, ${studentName}'s school fees balance of ${amount} ` +
        `was due on ${dueDate}. Stage: ${stage.name}. Please settle the balance to avoid ` +
        `further action.`;

      await dispatch({
        event: NOTIFICATION_EVENTS.FEE_REMINDER,
        title,
        message: body,
        recipients: [
          {
            userId: guardian.id,
            phone: guardian.phone ?? undefined,
            email: guardian.email ?? undefined,
            name: guardian.firstName ?? undefined,
          },
        ],
        schoolId,
        templateData: {
          dunningStage: stage.name,
          dunningOrder: stage.order,
          studentName,
          balance: toNum(bill.balanceAmount),
          dueDate,
          templateKey: stage.templateKey,
        },
        channels: [channel as "sms" | "email" | "in_app"],
      });

      await db.dunningEvent.create({
        data: {
          schoolId,
          runId,
          caseId,
          stageId: stage.id,
          stageOrder: stage.order,
          studentBillId: bill.id,
          studentId: bill.studentId,
          channel,
          status: "SENT",
          templateKey: stage.templateKey,
          payload: { title, to: channel === "sms" ? guardian.phone : guardian.email },
        },
      });
      eventCount++;
    } catch (err) {
      errors++;
      await db.dunningEvent.create({
        data: {
          schoolId,
          runId,
          caseId,
          stageId: stage.id,
          stageOrder: stage.order,
          studentBillId: bill.id,
          studentId: bill.studentId,
          channel,
          status: "FAILED",
          templateKey: stage.templateKey,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  if (stage.escalateToRole) {
    await db.dunningEvent.create({
      data: {
        schoolId,
        runId,
        caseId,
        stageId: stage.id,
        stageOrder: stage.order,
        studentBillId: bill.id,
        studentId: bill.studentId,
        channel: "escalation",
        status: "SENT",
        payload: { role: stage.escalateToRole },
      },
    });
    eventCount++;
  }

  return { eventCount, errors };
}

function computePenaltyAmount(
  rule: { type: string; value: unknown; maxPenalty: unknown },
  bill: StudentBill,
): number {
  const value = toNum(rule.value as Parameters<typeof toNum>[0]);
  const balance = toNum(bill.balanceAmount);
  let amount = 0;
  switch (rule.type) {
    case "PERCENTAGE":
      amount = Math.round(balance * (value / 100) * 100) / 100;
      break;
    case "FIXED_AMOUNT":
      amount = value;
      break;
    case "DAILY_PERCENTAGE":
    case "DAILY_FIXED":
      // Dunning-stage penalties fire once per stage; rely on finance-penalty.worker.ts
      // for daily accrual logic.
      amount = value;
      break;
    default:
      amount = value;
  }
  const cap = rule.maxPenalty ? toNum(rule.maxPenalty as Parameters<typeof toNum>[0]) : null;
  if (cap !== null && amount > cap) amount = cap;
  return amount;
}

function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * Exposed for testing only — wraps the internal helper.
 */
export const __test__ = { selectBillsForPolicy, computePenaltyAmount, daysBetween };
