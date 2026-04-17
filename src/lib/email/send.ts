import { getQueue, QUEUE_NAMES, type EmailJobData } from "@/lib/queue";
import { getEmailTransport, getEmailFrom } from "./transport";
import { renderTemplate } from "./templates";
import { resolveAndRender } from "@/lib/notifications/templates";
import { logger } from "@/lib/logger";

const log = logger.child({ component: "email" });

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
 *
 * Template resolution:
 *   1. If a DB template exists for (template, EMAIL, schoolId?, locale?), use it.
 *   2. Otherwise fall back to the file-based template in src/lib/email/templates.
 * This keeps parity with the pre-DB path while letting tenants override copy.
 */
export async function sendEmail(
  data: EmailJobData & { schoolId?: string | null; locale?: string },
): Promise<void> {
  const transport = getEmailTransport();

  let html: string;
  let subject = data.subject;
  try {
    const resolved = await resolveAndRender({
      key: data.template,
      channel: "EMAIL",
      schoolId: data.schoolId ?? null,
      locale: data.locale,
      data: data.data,
    });
    if (resolved.source === "db") {
      html = resolved.body;
      if (resolved.subject) subject = resolved.subject;
    } else {
      html = renderTemplate(data.template, data.data);
    }
  } catch (err) {
    // If DB lookup fails (e.g. connection blip) don't drop the email — use
    // the file fallback and log for ops visibility.
    log.warn("db template resolve failed, using file fallback", {
      template: data.template,
      error: err,
    });
    html = renderTemplate(data.template, data.data);
  }

  await transport.sendMail({
    from: getEmailFrom(),
    to: Array.isArray(data.to) ? data.to.join(", ") : data.to,
    subject,
    html,
  });
}
