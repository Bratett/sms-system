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
  if (params.recipientUserIds.length === 0) return;

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
        console.error("report-card notification failed", {
          eventKey: params.eventKey,
          userId,
          err,
        });
      }
    }
  }
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "your child";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export async function notifyReportCardReleased(params: {
  releaseId: string;
  termName: string;
  classArmName: string;
  recipientUserIds: string[];
  studentNamesByUserId: Map<string, string[]>;
  isReRelease: boolean;
}): Promise<void> {
  const defaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.REPORT_CARD_RELEASED] as ChannelKey[];
  const prefix = params.isReRelease ? "Updated: " : "";

  await fanOut({
    eventKey: NOTIFICATION_EVENTS.REPORT_CARD_RELEASED,
    recipientUserIds: params.recipientUserIds,
    defaultChannels: defaults,
    renderBody: (userId) => {
      const names = joinNames(params.studentNamesByUserId.get(userId) ?? []);
      return `${prefix}${names}'s ${params.termName} report card is now available. Please log in to view and acknowledge receipt.`;
    },
    metadata: {
      releaseId: params.releaseId,
      termName: params.termName,
      classArmName: params.classArmName,
      isReRelease: params.isReRelease,
    },
  });
}

export async function notifyReportCardReminder(params: {
  releaseId: string;
  termName: string;
  classArmName: string;
  recipientUserIds: string[];
  studentNamesByUserId: Map<string, string[]>;
}): Promise<void> {
  const defaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.REPORT_CARD_REMINDER_SENT] as ChannelKey[];

  await fanOut({
    eventKey: NOTIFICATION_EVENTS.REPORT_CARD_REMINDER_SENT,
    recipientUserIds: params.recipientUserIds,
    defaultChannels: defaults,
    renderBody: (userId) => {
      const names = joinNames(params.studentNamesByUserId.get(userId) ?? []);
      return `Reminder: please acknowledge ${names}'s ${params.termName} report card.`;
    },
    metadata: {
      releaseId: params.releaseId,
      termName: params.termName,
      classArmName: params.classArmName,
    },
  });
}
