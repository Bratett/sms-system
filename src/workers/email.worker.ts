import { createWorker, QUEUE_NAMES, type EmailJobData } from "@/lib/queue";
import { sendEmail } from "@/lib/email/send";

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
    console.log(`[Email Worker] Sent: ${job.id} to ${job.data.to}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Email Worker] Failed: ${job?.id}`, err.message);
  });

  return worker;
}
