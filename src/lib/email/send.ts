import { getQueue, QUEUE_NAMES, type EmailJobData } from "@/lib/queue";
import { getEmailTransport, getEmailFrom } from "./transport";
import { renderTemplate } from "./templates";

/**
 * Queue an email for delivery via the background worker.
 */
export async function queueEmail(data: EmailJobData): Promise<void> {
  const queue = getQueue<EmailJobData>(QUEUE_NAMES.EMAIL);
  await queue.add("send-email", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}

/**
 * Send an email directly (used by the email worker).
 */
export async function sendEmail(data: EmailJobData): Promise<void> {
  const transport = getEmailTransport();
  const html = renderTemplate(data.template, data.data);

  await transport.sendMail({
    from: getEmailFrom(),
    to: Array.isArray(data.to) ? data.to.join(", ") : data.to,
    subject: data.subject,
    html,
  });
}
