import { createWorker, QUEUE_NAMES, type SmsJobData } from "@/lib/queue";
import { getSmsProvider } from "@/lib/sms/provider";
import { logger } from "@/lib/logger";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const log = logger.child({ worker: "sms" });

/**
 * SMS Delivery Worker
 * Processes queued SMS messages and updates their status in the database.
 */
export function startSmsWorker() {
  const provider = getSmsProvider();

  const worker = createWorker<SmsJobData>(
    QUEUE_NAMES.SMS,
    async (job) => {
      const { smsLogId, phone, message, senderId } = job.data;

      const result = await provider.send(phone, message, senderId);

      await db.smsLog.update({
        where: { id: smsLogId },
        data: {
          status: result.success ? "SENT" : "FAILED",
          provider: process.env.SMS_PROVIDER || "mock",
          providerMessageId: result.providerMessageId || null,
          cost: result.cost ?? null,
          sentAt: result.success ? new Date() : null,
        },
      });

      if (!result.success) {
        throw new Error(result.error || "SMS delivery failed");
      }
    },
    { concurrency: 10 },
  );

  worker.on("completed", (job) => {
    log.info("sms delivered", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    log.error("sms failed", { jobId: job?.id, error: err });
  });

  return worker;
}
