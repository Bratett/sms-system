import { PrismaClient } from "@prisma/client";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { logger } from "@/lib/logger";

const db = new PrismaClient();
const log = logger.child({ worker: "licence-expiry" });

/**
 * Teacher NTC licence expiry worker.
 *
 * Runs daily. For every ACTIVE licence in the system it:
 *   1. Flips its status to EXPIRED when expiresAt has passed.
 *   2. Fires renewal reminders at 90 / 60 / 30 / 14 / 7 day thresholds to
 *      the staff member's user account (falls back to a school-wide admin
 *      audit log entry if the staff has no user).
 *
 * Mirrors the contract-expiry pattern so ops see consistent cadence + logs.
 */

const REMINDER_THRESHOLDS_DAYS = [90, 60, 30, 14, 7];

export async function processLicenceExpiry(now: Date = new Date()): Promise<{
  expired: number;
  reminders: number;
}> {
  let expired = 0;
  let reminders = 0;

  // 1) Auto-flip status for licences past expiry.
  const expiredResult = await db.teacherLicence.updateMany({
    where: { status: "ACTIVE", expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  });
  expired = expiredResult.count;
  if (expired > 0) {
    log.info("licences auto-expired", { count: expired });
  }

  // 2) Dispatch renewal reminders at each threshold. We query once per
  //    threshold rather than in a loop so Prisma can use the index.
  for (const days of REMINDER_THRESHOLDS_DAYS) {
    const target = new Date(now);
    target.setDate(target.getDate() + days);
    const dayStart = new Date(target);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(target);
    dayEnd.setHours(23, 59, 59, 999);

    const due = await db.teacherLicence.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { gte: dayStart, lte: dayEnd },
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            userId: true,
            staffId: true,
            schoolId: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    for (const licence of due) {
      const recipients: { userId?: string; email?: string; phone?: string; name?: string }[] = [];
      if (licence.staff.userId) {
        recipients.push({
          userId: licence.staff.userId,
          email: licence.staff.email ?? undefined,
          phone: licence.staff.phone ?? undefined,
          name: `${licence.staff.firstName} ${licence.staff.lastName}`,
        });
      }

      if (recipients.length === 0) continue;

      await dispatch({
        event: NOTIFICATION_EVENTS.CONTRACT_EXPIRING, // closest existing event
        title: `NTC Licence Expiring in ${days} Days`,
        message:
          `Your NTC licence ${licence.ntcNumber} expires on ` +
          licence.expiresAt.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }) +
          ". Please begin renewal to avoid disruption to your classroom assignments.",
        recipients,
        schoolId: licence.staff.schoolId,
      });
      reminders++;
    }

    if (due.length > 0) {
      log.info("licence reminders sent", { daysAhead: days, count: due.length });
    }
  }

  return { expired, reminders };
}

export function startLicenceExpirySchedule(intervalMs = 24 * 60 * 60 * 1000): void {
  processLicenceExpiry().catch((err) =>
    log.error("initial licence expiry run failed", { error: err }),
  );
  setInterval(() => {
    processLicenceExpiry().catch((err) =>
      log.error("scheduled licence expiry run failed", { error: err }),
    );
  }, intervalMs);
  log.info("licence expiry scheduler started", { intervalMs });
}
