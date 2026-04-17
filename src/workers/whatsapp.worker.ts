import { createWorker, QUEUE_NAMES, type WhatsAppJobData } from "@/lib/queue";
import { getWhatsAppProvider } from "@/lib/messaging/whatsapp";
import { logger } from "@/lib/logger";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const log = logger.child({ worker: "whatsapp" });

/**
 * WhatsApp Delivery Worker
 * Mirrors the SMS worker pattern. If `smsLogId` is provided the same SmsLog
 * row is updated with the provider result so both channels share one audit.
 * Otherwise this is a fire-and-forget send (e.g. transactional OTP where the
 * SMS path already has its own log).
 */
export function startWhatsAppWorker() {
  const provider = getWhatsAppProvider();

  const worker = createWorker<WhatsAppJobData>(
    QUEUE_NAMES.WHATSAPP,
    async (job) => {
      const { smsLogId, to, message, templateName, templateParams } = job.data;

      const result = await provider.send({
        to,
        message,
        templateName,
        templateParams,
      });

      if (smsLogId) {
        await db.smsLog.update({
          where: { id: smsLogId },
          data: {
            status: result.success ? "SENT" : "FAILED",
            provider: "whatsapp",
            providerMessageId: result.providerMessageId ?? null,
            sentAt: result.success ? new Date() : null,
          },
        });
      }

      if (!result.success) {
        throw new Error(result.error ?? "WhatsApp delivery failed");
      }
    },
    { concurrency: 10 },
  );

  worker.on("completed", (job) => {
    log.info("whatsapp delivered", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    log.error("whatsapp failed", { jobId: job?.id, error: err });
  });

  return worker;
}
