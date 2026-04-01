import { PrismaClient } from "@prisma/client";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";

const db = new PrismaClient();

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
      console.log(`[Contract Worker] Auto-expired ${expired.count} contracts for school ${school.id}`);
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
        console.log(
          `[Contract Worker] Sent ${daysAhead}-day expiry notifications for ${expiring.length} contracts (school: ${school.id})`,
        );
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
    console.error("[Contract Worker] Initial run failed:", err),
  );

  // Then run daily at 6:00 AM
  const DAILY_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    processContractExpiry().catch((err) =>
      console.error("[Contract Worker] Scheduled run failed:", err),
    );
  }, DAILY_MS);

  console.log("[Contract Worker] Scheduled daily contract expiry checks.");
}
