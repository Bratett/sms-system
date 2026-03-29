import { db } from "@/lib/db";
import { getQueue, QUEUE_NAMES, type SmsJobData, type EmailJobData } from "@/lib/queue";
import { type NotificationEvent, EVENT_CHANNELS } from "./events";

/**
 * Notification Dispatcher
 * Central fan-out system that routes events to in-app, SMS, and email channels.
 */

interface NotificationRecipient {
  userId?: string;
  phone?: string;
  email?: string;
  name?: string;
}

interface DispatchOptions {
  event: NotificationEvent;
  title: string;
  message: string;
  recipients: NotificationRecipient[];
  schoolId: string;
  /** Optional email template name (defaults to event name) */
  emailTemplate?: string;
  /** Additional data for email/SMS templates */
  templateData?: Record<string, unknown>;
  /** Override default channel routing */
  channels?: ("in_app" | "sms" | "email")[];
}

export async function dispatch(opts: DispatchOptions): Promise<void> {
  const channels = opts.channels || EVENT_CHANNELS[opts.event] || ["in_app"];

  const promises: Promise<void>[] = [];

  if (channels.includes("in_app")) {
    promises.push(dispatchInApp(opts));
  }

  if (channels.includes("sms")) {
    promises.push(dispatchSms(opts));
  }

  if (channels.includes("email")) {
    promises.push(dispatchEmail(opts));
  }

  await Promise.allSettled(promises);
}

// ─── In-App Notifications ──────────────────────────────────────────

async function dispatchInApp(opts: DispatchOptions): Promise<void> {
  const notifications = opts.recipients
    .filter((r) => r.userId)
    .map((r) => ({
      userId: r.userId!,
      schoolId: opts.schoolId,
      title: opts.title,
      message: opts.message,
      type: "INFO" as const,
    }));

  if (notifications.length > 0) {
    await db.notification.createMany({ data: notifications });
  }
}

// ─── SMS Notifications ─────────────────────────────────────────────

async function dispatchSms(opts: DispatchOptions): Promise<void> {
  const smsQueue = getQueue<SmsJobData>(QUEUE_NAMES.SMS);
  const recipientsWithPhone = opts.recipients.filter((r) => r.phone);

  for (const recipient of recipientsWithPhone) {
    // Create SmsLog record first
    const smsLog = await db.smsLog.create({
      data: {
        schoolId: opts.schoolId,
        recipientPhone: recipient.phone!,
        recipientName: recipient.name || null,
        message: opts.message,
        status: "QUEUED",
      },
    });

    // Enqueue for delivery
    await smsQueue.add("sms-send", {
      smsLogId: smsLog.id,
      phone: recipient.phone!,
      message: opts.message,
    });
  }
}

// ─── Email Notifications ───────────────────────────────────────────

async function dispatchEmail(opts: DispatchOptions): Promise<void> {
  const emailQueue = getQueue<EmailJobData>(QUEUE_NAMES.EMAIL);
  const recipientsWithEmail = opts.recipients.filter((r) => r.email);

  for (const recipient of recipientsWithEmail) {
    await emailQueue.add("email-send", {
      to: recipient.email!,
      subject: opts.title,
      template: opts.emailTemplate || opts.event,
      data: {
        recipientName: recipient.name || "User",
        ...opts.templateData,
      },
    });
  }
}
