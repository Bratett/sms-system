import { db } from "@/lib/db";
import {
  getQueue,
  QUEUE_NAMES,
  type SmsJobData,
  type EmailJobData,
  type WhatsAppJobData,
} from "@/lib/queue";
import { type NotificationEvent, EVENT_CHANNELS } from "./events";
import { resolveAndRender } from "./templates";
import type { NotificationChannel } from "@prisma/client";

/**
 * Notification Dispatcher
 *
 * Central fan-out system that routes events to in-app, SMS, email, and
 * WhatsApp channels. Two upgrades landed in Phase-2 follow-through:
 *
 *   1. DB-backed templates — each channel tries `resolveAndRender()` against
 *      the NotificationTemplate table before using the inline fallback copy.
 *   2. User preferences — if a recipient has a NotificationPreference row for
 *      this event (or the '*' wildcard), we honour their channel selection
 *      instead of the system-default EVENT_CHANNELS list.
 *
 * Both paths are fail-open: any DB read error falls back to the original
 * (template-in-code / default-channels) behaviour so ops incidents don't
 * silently drop notifications.
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
  channels?: ("in_app" | "sms" | "email" | "whatsapp")[];
}

const CHANNEL_ENUM: Record<string, NotificationChannel> = {
  in_app: "IN_APP",
  sms: "SMS",
  email: "EMAIL",
  whatsapp: "WHATSAPP",
  push: "PUSH",
};

export async function dispatch(opts: DispatchOptions): Promise<void> {
  const channels = opts.channels || EVENT_CHANNELS[opts.event] || ["in_app"];

  const promises: Promise<void>[] = [];

  if (channels.includes("in_app")) promises.push(dispatchInApp(opts));
  if (channels.includes("sms")) promises.push(dispatchSms(opts));
  if (channels.includes("email")) promises.push(dispatchEmail(opts));
  if (channels.includes("whatsapp")) promises.push(dispatchWhatsApp(opts));

  await Promise.allSettled(promises);
}

/**
 * Fetch a recipient's preference for the given event. Checks the exact
 * event key first, then the '*' wildcard. Returns null if no override
 * exists — caller should treat that as "use the system defaults".
 */
async function getRecipientOverride(
  userId: string | undefined,
  eventKey: string,
): Promise<NotificationChannel[] | null> {
  if (!userId) return null;
  try {
    const [exact, wildcard] = await Promise.all([
      db.notificationPreference.findUnique({
        where: { userId_eventKey: { userId, eventKey } },
        select: { channels: true },
      }),
      db.notificationPreference.findUnique({
        where: { userId_eventKey: { userId, eventKey: "*" } },
        select: { channels: true },
      }),
    ]);
    return exact?.channels ?? wildcard?.channels ?? null;
  } catch {
    return null;
  }
}

/** Filter a recipient list by "is this channel allowed for this user?". */
async function filterByPreference(
  recipients: NotificationRecipient[],
  eventKey: string,
  channel: NotificationChannel,
): Promise<NotificationRecipient[]> {
  const out: NotificationRecipient[] = [];
  for (const r of recipients) {
    const override = await getRecipientOverride(r.userId, eventKey);
    if (override === null) {
      out.push(r); // no override = default allow
      continue;
    }
    if (override.includes(channel)) out.push(r);
  }
  return out;
}

// ─── In-App Notifications ──────────────────────────────────────────

async function dispatchInApp(opts: DispatchOptions): Promise<void> {
  const filtered = await filterByPreference(
    opts.recipients.filter((r) => r.userId),
    opts.event,
    CHANNEL_ENUM.in_app,
  );

  if (filtered.length === 0) return;

  const notifications = filtered.map((r) => ({
    userId: r.userId!,
    schoolId: opts.schoolId,
    title: opts.title,
    message: opts.message,
    type: "INFO" as const,
  }));

  await db.notification.createMany({ data: notifications });
}

// ─── SMS Notifications ─────────────────────────────────────────────

async function dispatchSms(opts: DispatchOptions): Promise<void> {
  const smsQueue = getQueue<SmsJobData>(QUEUE_NAMES.SMS);
  const initial = opts.recipients.filter((r) => r.phone);
  const filtered = await filterByPreference(initial, opts.event, CHANNEL_ENUM.sms);

  for (const recipient of filtered) {
    const rendered = await renderChannelMessage(
      opts,
      "SMS",
      recipient,
      opts.message,
    );

    const smsLog = await db.smsLog.create({
      data: {
        schoolId: opts.schoolId,
        recipientPhone: recipient.phone!,
        recipientName: recipient.name || null,
        message: rendered,
        status: "QUEUED",
      },
    });

    await smsQueue.add("sms-send", {
      smsLogId: smsLog.id,
      phone: recipient.phone!,
      message: rendered,
    });
  }
}

// ─── Email Notifications ───────────────────────────────────────────

async function dispatchEmail(opts: DispatchOptions): Promise<void> {
  const emailQueue = getQueue<EmailJobData>(QUEUE_NAMES.EMAIL);
  const initial = opts.recipients.filter((r) => r.email);
  const filtered = await filterByPreference(initial, opts.event, CHANNEL_ENUM.email);

  for (const recipient of filtered) {
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

// ─── WhatsApp Notifications ────────────────────────────────────────

async function dispatchWhatsApp(opts: DispatchOptions): Promise<void> {
  const waQueue = getQueue<WhatsAppJobData>(QUEUE_NAMES.WHATSAPP);
  const initial = opts.recipients.filter((r) => r.phone);
  const filtered = await filterByPreference(
    initial,
    opts.event,
    CHANNEL_ENUM.whatsapp,
  );

  for (const recipient of filtered) {
    const rendered = await renderChannelMessage(
      opts,
      "WHATSAPP",
      recipient,
      opts.message,
    );

    const log = await db.smsLog.create({
      data: {
        schoolId: opts.schoolId,
        recipientPhone: recipient.phone!,
        recipientName: recipient.name || null,
        message: rendered,
        status: "QUEUED",
      },
    });

    await waQueue.add("whatsapp-send", {
      smsLogId: log.id,
      to: recipient.phone!,
      message: rendered,
    });
  }
}

/**
 * Try to resolve a DB-backed template for the given event/channel; fall back
 * to the provided default message on miss or error. Used for SMS + WhatsApp
 * where plaintext substitution is enough. Email has its own subject+HTML
 * pipeline in `src/lib/email/send.ts`.
 */
async function renderChannelMessage(
  opts: DispatchOptions,
  channel: NotificationChannel,
  recipient: NotificationRecipient,
  fallback: string,
): Promise<string> {
  try {
    const resolved = await resolveAndRender({
      key: opts.event,
      channel,
      schoolId: opts.schoolId,
      data: {
        recipientName: recipient.name || "User",
        ...opts.templateData,
      },
    });
    return resolved.source === "db" ? resolved.body : fallback;
  } catch {
    return fallback;
  }
}
