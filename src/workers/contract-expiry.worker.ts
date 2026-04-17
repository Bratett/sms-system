import { PrismaClient } from "@prisma/client";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { logger } from "@/lib/logger";

const db = new PrismaClient();
const log = logger.child({ worker: "contract-expiry" });

/**
 * Contract Expiry Worker
 * Runs daily to:
 * 1. Auto-expire contracts past their end date
 * 2. Send notifications for contracts expiring in 30, 14, and 7 days
 */
export async function processContractExpiry() {
  const now = new Date();

  const schools = await db.school.findMany({ select: { id: true, name: true } });

  for (const school of schools) {
    // 1. Auto-expire past-due contracts
    const expired = await db.staffContract.updateMany({
      where: {
        schoolId: school.id,
        status: "ACTIVE",
        endDate: { lt: now },
      },
      data: { status: "EXPIRED" },
    });

    if (expired.count > 0) {
      log.info("contracts auto-expired", { count: expired.count, schoolId: school.id });
    }

    // 2. Send notifications for contracts expiring at key thresholds
    for (const daysAhead of [30, 14, 7]) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysAhead);

      // Find contracts expiring on exactly this target date (±1 day to avoid timezone issues)
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const expiring = await db.staffContract.findMany({
        where: {
          schoolId: school.id,
          status: "ACTIVE",
          endDate: { gte: dayStart, lte: dayEnd },
        },
        include: {
          staff: {
            select: { id: true, firstName: true, lastName: true, userId: true, staffId: true },
          },
        },
      });

      for (const contract of expiring) {
        const recipients: { userId?: string; name?: string }[] = [];

        // Notify the staff member if they have a user account
        if (contract.staff.userId) {
          recipients.push({
            userId: contract.staff.userId,
            name: `${contract.staff.firstName} ${contract.staff.lastName}`,
          });
        }

        if (recipients.length > 0) {
          await dispatch({
            event: NOTIFICATION_EVENTS.CONTRACT_EXPIRING,
            title: `Contract Expiring in ${daysAhead} Days`,
            message: `The ${contract.type.replace("_", " ")} contract for ${contract.staff.firstName} ${contract.staff.lastName} (${contract.staff.staffId}) expires on ${contract.endDate?.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}. Please arrange renewal or take appropriate action.`,
            recipients,
            schoolId: school.id,
          });
        }
      }

      if (expiring.length > 0) {
        log.info("expiry notifications sent", {
          daysAhead,
          count: expiring.length,
          schoolId: school.id,
        });
      }
    }
  }
}

/**
 * Start the contract expiry worker as a scheduled task.
 * Call this from your worker entry point or startup script.
 */
export function startContractExpirySchedule() {
  // Run immediately on startup
  processContractExpiry().catch((err) =>
    log.error("initial run failed", { error: err }),
  );

  // Then run daily at 6:00 AM
  const DAILY_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    processContractExpiry().catch((err) =>
      log.error("scheduled run failed", { error: err }),
    );
  }, DAILY_MS);

  log.info("scheduled daily contract expiry checks");
}
