import { PrismaClient } from "@prisma/client";
import type { NotificationChannel } from "@prisma/client";
import { getQueue, QUEUE_NAMES, type SmsJobData, type EmailJobData, type WhatsAppJobData } from "@/lib/queue";
import { renderHandlebarsLike } from "@/lib/notifications/templates";
import { logger } from "@/lib/logger";

const db = new PrismaClient();
const log = logger.child({ worker: "campaign-dispatch" });

/**
 * Campaign dispatcher.
 *
 * Polls the CommunicationCampaign table every 60s for SCHEDULED rows whose
 * scheduledAt has passed. For each due row:
 *   1. Flip status to DISPATCHING (claims it, prevents double-fire if multiple
 *      worker instances race).
 *   2. Resolve the audienceQuery JSON into a concrete list of recipients.
 *   3. Render the body per-recipient via the shared template renderer so
 *      {{guardianName}} / {{studentName}} etc. substitute correctly.
 *   4. Enqueue one job per recipient on the appropriate delivery queue.
 *   5. Update counts and flip to COMPLETED (or FAILED on audience error).
 *
 * Audience shapes are defined in createCampaignAction's discriminated union
 * and the resolution here mirrors those shapes one-for-one.
 */

interface AudienceQuery {
  kind: "CLASS_ARM" | "HOSTEL" | "ALL_GUARDIANS" | "ALL_STAFF" | "CUSTOM_USER_IDS";
  classArmId?: string;
  hostelId?: string;
  userIds?: string[];
}

interface Recipient {
  userId?: string;
  phone?: string;
  email?: string;
  name?: string;
  data: Record<string, unknown>;
}

export async function runCampaignDispatch(now: Date = new Date()): Promise<{
  claimed: number;
  dispatched: number;
  failed: number;
}> {
  const due = await db.communicationCampaign.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    take: 25,
  });

  let claimed = 0;
  let dispatched = 0;
  let failed = 0;

  for (const campaign of due) {
    // Claim with a conditional update so concurrent runs can't double-fire.
    const claim = await db.communicationCampaign.updateMany({
      where: { id: campaign.id, status: "SCHEDULED" },
      data: { status: "DISPATCHING" },
    });
    if (claim.count === 0) continue; // lost the race
    claimed++;

    try {
      const recipients = await resolveAudience(
        campaign.schoolId,
        campaign.audienceQuery as unknown as AudienceQuery,
      );
      const counts = await enqueueForRecipients(
        campaign.schoolId,
        campaign.channel,
        campaign.subject,
        campaign.body,
        recipients,
      );

      await db.communicationCampaign.update({
        where: { id: campaign.id },
        data: {
          status: "COMPLETED",
          dispatchedAt: new Date(),
          sentCount: counts.sent,
          failedCount: counts.failed,
        },
      });
      dispatched += counts.sent;
      failed += counts.failed;
      log.info("campaign dispatched", {
        campaignId: campaign.id,
        sent: counts.sent,
        failed: counts.failed,
      });
    } catch (err) {
      await db.communicationCampaign.update({
        where: { id: campaign.id },
        data: { status: "FAILED" },
      });
      log.error("campaign failed", { campaignId: campaign.id, error: err });
    }
  }

  return { claimed, dispatched, failed };
}

async function resolveAudience(
  schoolId: string,
  audience: AudienceQuery,
): Promise<Recipient[]> {
  switch (audience.kind) {
    case "CLASS_ARM": {
      if (!audience.classArmId) return [];
      const enrollments = await db.enrollment.findMany({
        where: { classArmId: audience.classArmId, schoolId },
        select: { studentId: true },
      });
      return await guardiansForStudents(
        schoolId,
        enrollments.map((e) => e.studentId),
      );
    }
    case "HOSTEL": {
      if (!audience.hostelId) return [];
      // Students whose current bed is in this hostel (via BedAllocation -> Bed -> Dormitory -> Hostel).
      const allocations = await db.bedAllocation.findMany({
        where: {
          schoolId,
          status: "ACTIVE",
          bed: { dormitory: { hostelId: audience.hostelId } },
        },
        select: { studentId: true },
      });
      return await guardiansForStudents(
        schoolId,
        allocations.map((a) => a.studentId),
      );
    }
    case "ALL_GUARDIANS": {
      const guardians = await db.guardian.findMany({
        where: { schoolId },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true, userId: true },
      });
      return guardians.map((g) => ({
        userId: g.userId ?? undefined,
        phone: g.phone ?? undefined,
        email: g.email ?? undefined,
        name: `${g.firstName} ${g.lastName}`,
        data: { guardianName: g.firstName },
      }));
    }
    case "ALL_STAFF": {
      const staff = await db.staff.findMany({
        where: { schoolId, status: "ACTIVE" },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true, userId: true },
      });
      return staff.map((s) => ({
        userId: s.userId ?? undefined,
        phone: s.phone ?? undefined,
        email: s.email ?? undefined,
        name: `${s.firstName} ${s.lastName}`,
        data: { staffName: s.firstName },
      }));
    }
    case "CUSTOM_USER_IDS": {
      if (!audience.userIds?.length) return [];
      const users = await db.user.findMany({
        where: { id: { in: audience.userIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      return users.map((u) => ({
        userId: u.id,
        email: u.email ?? undefined,
        name: `${u.firstName} ${u.lastName}`,
        data: { recipientName: u.firstName },
      }));
    }
    default:
      return [];
  }
}

async function guardiansForStudents(
  schoolId: string,
  studentIds: string[],
): Promise<Recipient[]> {
  if (studentIds.length === 0) return [];
  const links = await db.studentGuardian.findMany({
    where: { studentId: { in: studentIds }, schoolId, isPrimary: true },
    select: {
      student: { select: { firstName: true, lastName: true } },
      guardian: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          userId: true,
        },
      },
    },
  });
  return links.map((l) => ({
    userId: l.guardian.userId ?? undefined,
    phone: l.guardian.phone ?? undefined,
    email: l.guardian.email ?? undefined,
    name: `${l.guardian.firstName} ${l.guardian.lastName}`,
    data: {
      guardianName: l.guardian.firstName,
      studentName: `${l.student.firstName} ${l.student.lastName}`,
    },
  }));
}

async function enqueueForRecipients(
  schoolId: string,
  channel: NotificationChannel,
  subject: string | null,
  body: string,
  recipients: Recipient[],
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    const rendered = renderHandlebarsLike(body, {
      recipientName: r.name ?? "User",
      ...r.data,
    });

    try {
      switch (channel) {
        case "SMS": {
          if (!r.phone) {
            failed++;
            break;
          }
          const log = await db.smsLog.create({
            data: {
              schoolId,
              recipientPhone: r.phone,
              recipientName: r.name ?? null,
              message: rendered,
              status: "QUEUED",
            },
          });
          await getQueue<SmsJobData>(QUEUE_NAMES.SMS).add("sms-send", {
            smsLogId: log.id,
            phone: r.phone,
            message: rendered,
          });
          sent++;
          break;
        }
        case "WHATSAPP": {
          if (!r.phone) {
            failed++;
            break;
          }
          const log = await db.smsLog.create({
            data: {
              schoolId,
              recipientPhone: r.phone,
              recipientName: r.name ?? null,
              message: rendered,
              status: "QUEUED",
            },
          });
          await getQueue<WhatsAppJobData>(QUEUE_NAMES.WHATSAPP).add("whatsapp-send", {
            smsLogId: log.id,
            to: r.phone,
            message: rendered,
          });
          sent++;
          break;
        }
        case "EMAIL": {
          if (!r.email) {
            failed++;
            break;
          }
          await getQueue<EmailJobData>(QUEUE_NAMES.EMAIL).add("email-send", {
            to: r.email,
            subject: subject ?? "Notification",
            template: "campaign-raw",
            data: { recipientName: r.name ?? "User", body: rendered },
          });
          sent++;
          break;
        }
        case "IN_APP": {
          if (!r.userId) {
            failed++;
            break;
          }
          await db.notification.create({
            data: {
              userId: r.userId,
              schoolId,
              title: subject ?? "Message",
              message: rendered,
              type: "INFO",
            },
          });
          sent++;
          break;
        }
        default:
          failed++;
      }
    } catch {
      failed++;
    }
  }

  return { sent, failed };
}

/** Start a long-lived scheduler that polls every 60 seconds. */
export function startCampaignDispatchSchedule(intervalMs = 60_000): void {
  runCampaignDispatch().catch((err) =>
    log.error("initial campaign dispatch run failed", { error: err }),
  );
  setInterval(() => {
    runCampaignDispatch().catch((err) =>
      log.error("scheduled campaign dispatch run failed", { error: err }),
    );
  }, intervalMs);
  log.info("campaign dispatch scheduler started", { intervalMs });
}
