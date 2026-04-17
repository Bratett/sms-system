import { createWorker, QUEUE_NAMES, type EmailJobData } from "@/lib/queue";
import { sendEmail } from "@/lib/email/send";
import { logger } from "@/lib/logger";

const log = logger.child({ worker: "email" });

/**
 * Email Delivery Worker
 * Processes queued emails and sends via Nodemailer.
 */
export function startEmailWorker() {
  const worker = createWorker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    async (job) => {
      await sendEmail(job.data);
    },
    { concurrency: 5 },
  );

  worker.on("completed", (job) => {
    log.info("email sent", { jobId: job.id, to: job.data.to });
  });

  worker.on("failed", (job, err) => {
    log.error("email failed", { jobId: job?.id, error: err });
  });

  return worker;
}
