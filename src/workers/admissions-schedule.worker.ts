import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";
import {
  expireOffersCore,
  listOverdueConditionsCore,
  sendOfferExpiryWarningsCore,
} from "@/modules/admissions/schedule/core";

const db = new PrismaClient();
const log = logger.child({ worker: "admissions-schedule" });

const HOURLY_MS = 60 * 60 * 1000;
const SYSTEM_ACTOR = "SYSTEM_WORKER";

/**
 * Nightly/hourly admissions sweep: expire stale offers, warn about imminent
 * expiry, and surface any overdue conditional-accept conditions for staff.
 *
 * Iterates all schools so the worker can serve a multi-tenant deployment
 * with a single process. Per-school failures are logged and skipped; one
 * school's bad state never blocks another.
 */
export async function runAdmissionsSchedule() {
  const schools = await db.school.findMany({ select: { id: true, name: true } });
  log.info("admissions schedule sweep", { schools: schools.length });

  for (const school of schools) {
    try {
      const expired = await expireOffersCore({
        schoolId: school.id,
        actorId: SYSTEM_ACTOR,
      });
      const warned = await sendOfferExpiryWarningsCore({ schoolId: school.id });
      const overdue = await listOverdueConditionsCore({ schoolId: school.id });

      log.info("school sweep completed", {
        schoolId: school.id,
        schoolName: school.name,
        expired: expired.expiredCount,
        expiredConsidered: expired.considered,
        expiredErrors: expired.errors.length,
        warnedOffers: warned.warnedCount,
        overdueConditions: overdue.length,
      });
    } catch (err) {
      log.error("school sweep failed", {
        schoolId: school.id,
        err: err instanceof Error ? err.message : err,
      });
    }
  }
}

export function startAdmissionsSchedule() {
  // Run once on boot so deployments see a first sweep within seconds,
  // then hourly afterwards. Kept interval-based to match the rest of workers/.
  runAdmissionsSchedule().catch((err) =>
    log.error("initial admissions sweep failed", { err }),
  );
  setInterval(() => {
    runAdmissionsSchedule().catch((err) =>
      log.error("admissions sweep failed", { err }),
    );
  }, HOURLY_MS);
}
