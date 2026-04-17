import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";
import { executeDunningRun } from "@/lib/finance/dunning-engine";

const db = new PrismaClient();
const log = logger.child({ worker: "dunning-scheduler" });

/**
 * Dunning scheduler.
 *
 * Walks every active DunningPolicy once a day. Each policy's engine will
 * evaluate its own bill scope, fire the appropriate stages, and persist
 * events. Errors on one policy never block the rest.
 */
export async function runDueDunningPolicies() {
  const active = await db.dunningPolicy.findMany({
    where: { isActive: true },
    select: { id: true, schoolId: true, name: true },
  });
  log.info("dunning sweep", { activePolicies: active.length });
  for (const policy of active) {
    try {
      const result = await executeDunningRun(policy.id, {
        triggeredBy: "system:scheduler",
        triggerType: "SCHEDULED",
      });
      log.info("policy run completed", {
        policyId: policy.id,
        schoolId: policy.schoolId,
        ...result,
      });
    } catch (err) {
      log.error("policy run failed", {
        policyId: policy.id,
        err: err instanceof Error ? err.message : err,
      });
    }
  }
}

const DAILY_MS = 24 * 60 * 60 * 1000;

export function startDunningSchedule() {
  // Nudge once on boot so brand-new deployments see a run within minutes,
  // then daily afterwards. If you want a specific time-of-day trigger, swap
  // in node-cron here — kept interval-based to match the rest of workers/.
  runDueDunningPolicies().catch((err) => log.error("initial dunning sweep failed", { err }));
  setInterval(() => {
    runDueDunningPolicies().catch((err) => log.error("dunning sweep failed", { err }));
  }, DAILY_MS);
}
