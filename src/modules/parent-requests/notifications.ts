import { db } from "@/lib/db";
import { sendMessage, type ChannelType } from "@/lib/messaging/hub";
import { NOTIFICATION_EVENTS, EVENT_CHANNELS } from "@/lib/notifications/events";
import type { NotificationChannel } from "@prisma/client";

type ChannelKey = "in_app" | "sms" | "email" | "whatsapp" | "push";

function channelKeyToHub(c: ChannelKey): ChannelType | null {
  switch (c) {
    case "in_app": return "in_app";
    case "sms": return "sms";
    case "email": return "email";
    case "whatsapp": return "whatsapp";
    case "push": return "push";
    default: return null;
  }
}

function channelEnumToKey(c: NotificationChannel): ChannelKey {
  switch (c) {
    case "IN_APP": return "in_app";
    case "SMS": return "sms";
    case "EMAIL": return "email";
    case "WHATSAPP": return "whatsapp";
    case "PUSH": return "push";
  }
}

async function fanOut(params: {
  eventKey: string;
  recipientUserIds: string[];
  defaultChannels: ChannelKey[];
  renderBody: (userId: string) => string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const prefs = await db.notificationPreference.findMany({
    where: {
      userId: { in: params.recipientUserIds },
      eventKey: params.eventKey,
    },
  });
  const prefByUser = new Map(prefs.map((p) => [p.userId, p.channels]));

  for (const userId of params.recipientUserIds) {
    const override = prefByUser.get(userId);
    const channels: ChannelKey[] = override
      ? override.map(channelEnumToKey)
      : params.defaultChannels;

    if (channels.length === 0) continue;

    for (const channel of channels) {
      const hubChannel = channelKeyToHub(channel);
      if (!hubChannel) continue;

      try {
        await sendMessage(hubChannel, {
          to: userId,
          body: params.renderBody(userId),
          metadata: params.metadata,
        });
      } catch (err) {
        console.error("parent-requests notification failed", {
          eventKey: params.eventKey,
          userId,
          err,
        });
      }
    }
  }
}

// ─── Excuse ────────────────────────────────────────────────────────

export async function notifyExcuseSubmitted(params: {
  requestId: string;
  reviewerUserIds: string[];
  studentName: string;
  fromDate: Date;
  toDate: Date;
  submitterName: string;
}): Promise<void> {
  const defaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.EXCUSE_REQUEST_SUBMITTED] as ChannelKey[];
  const range = formatRange(params.fromDate, params.toDate);
  await fanOut({
    eventKey: NOTIFICATION_EVENTS.EXCUSE_REQUEST_SUBMITTED,
    recipientUserIds: params.reviewerUserIds,
    defaultChannels: defaults,
    renderBody: () =>
      `${params.submitterName} submitted an excuse request for ${params.studentName} (${range}).`,
    metadata: {
      requestId: params.requestId,
      studentName: params.studentName,
      submitterName: params.submitterName,
      range,
    },
  });
}

export async function notifyExcuseReviewed(params: {
  requestId: string;
  submitterUserId: string;
  outcome: "APPROVED" | "REJECTED";
  reviewerName: string;
  reviewNote?: string;
  studentName: string;
}): Promise<void> {
  const defaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.EXCUSE_REQUEST_REVIEWED] as ChannelKey[];
  const verb = params.outcome === "APPROVED" ? "approved" : "rejected";
  const noteText = params.reviewNote ? ` Note: ${params.reviewNote}` : "";
  await fanOut({
    eventKey: NOTIFICATION_EVENTS.EXCUSE_REQUEST_REVIEWED,
    recipientUserIds: [params.submitterUserId],
    defaultChannels: defaults,
    renderBody: () =>
      `Your excuse request for ${params.studentName} was ${verb} by ${params.reviewerName}.${noteText}`,
    metadata: {
      requestId: params.requestId,
      outcome: params.outcome,
      reviewerName: params.reviewerName,
      reviewNote: params.reviewNote ?? null,
      studentName: params.studentName,
    },
  });
}

// ─── Medical Disclosure ────────────────────────────────────────────

export async function notifyMedicalDisclosureSubmitted(params: {
  disclosureId: string;
  nurseUserIds: string[];
  studentName: string;
  category: "ALLERGY" | "CONDITION" | "MEDICATION";
  title: string;
  isUrgent: boolean;
  submitterName: string;
}): Promise<void> {
  const defaults: ChannelKey[] = params.isUrgent
    ? ["in_app", "sms"]
    : (EVENT_CHANNELS[NOTIFICATION_EVENTS.MEDICAL_DISCLOSURE_SUBMITTED] as ChannelKey[]);
  const urgentPrefix = params.isUrgent ? "[URGENT] " : "";
  await fanOut({
    eventKey: NOTIFICATION_EVENTS.MEDICAL_DISCLOSURE_SUBMITTED,
    recipientUserIds: params.nurseUserIds,
    defaultChannels: defaults,
    renderBody: () =>
      `${urgentPrefix}${params.submitterName} disclosed ${params.category.toLowerCase()} for ${params.studentName}: ${params.title}.`,
    metadata: {
      disclosureId: params.disclosureId,
      studentName: params.studentName,
      category: params.category,
      title: params.title,
      isUrgent: params.isUrgent,
      submitterName: params.submitterName,
    },
  });
}

export async function notifyMedicalDisclosureReviewed(params: {
  disclosureId: string;
  submitterUserId: string;
  outcome: "APPROVED" | "REJECTED";
  reviewerName: string;
  reviewNote?: string;
  studentName: string;
}): Promise<void> {
  const defaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.MEDICAL_DISCLOSURE_REVIEWED] as ChannelKey[];
  const verb = params.outcome === "APPROVED" ? "approved" : "rejected";
  const noteText = params.reviewNote ? ` Note: ${params.reviewNote}` : "";
  await fanOut({
    eventKey: NOTIFICATION_EVENTS.MEDICAL_DISCLOSURE_REVIEWED,
    recipientUserIds: [params.submitterUserId],
    defaultChannels: defaults,
    renderBody: () =>
      `Your medical disclosure for ${params.studentName} was ${verb} by ${params.reviewerName}.${noteText}`,
    metadata: {
      disclosureId: params.disclosureId,
      outcome: params.outcome,
      reviewerName: params.reviewerName,
      reviewNote: params.reviewNote ?? null,
      studentName: params.studentName,
    },
  });
}

function formatRange(from: Date, to: Date): string {
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  return fromStr === toStr ? fromStr : `${fromStr} → ${toStr}`;
}
