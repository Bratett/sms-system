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
        console.error("circular notification failed", {
          eventKey: params.eventKey,
          userId,
          err,
        });
      }
    }
  }
}

// ─── Published (fires ANNOUNCEMENT_PUBLISHED always; plus stronger event if ack required) ──

export async function notifyCircularPublished(params: {
  announcementId: string;
  title: string;
  priority: "low" | "normal" | "high" | "urgent";
  recipientUserIds: string[];
  requiresAcknowledgement: boolean;
}): Promise<void> {
  const existingDefaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.ANNOUNCEMENT_PUBLISHED] as ChannelKey[];
  await fanOut({
    eventKey: NOTIFICATION_EVENTS.ANNOUNCEMENT_PUBLISHED,
    recipientUserIds: params.recipientUserIds,
    defaultChannels: existingDefaults,
    renderBody: () => `New circular: ${params.title}`,
    metadata: {
      announcementId: params.announcementId,
      priority: params.priority,
      requiresAcknowledgement: params.requiresAcknowledgement,
    },
  });

  if (!params.requiresAcknowledgement) return;

  const ackDefaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.CIRCULAR_ACKNOWLEDGEMENT_REQUIRED] as ChannelKey[];
  await fanOut({
    eventKey: NOTIFICATION_EVENTS.CIRCULAR_ACKNOWLEDGEMENT_REQUIRED,
    recipientUserIds: params.recipientUserIds,
    defaultChannels: ackDefaults,
    renderBody: () => `Please acknowledge: ${params.title}`,
    metadata: {
      announcementId: params.announcementId,
      priority: params.priority,
    },
  });
}

// ─── Reminder (chase) ────────────────────────────────────────────

export async function notifyCircularReminder(params: {
  announcementId: string;
  title: string;
  recipientUserIds: string[];
}): Promise<void> {
  const defaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.CIRCULAR_REMINDER_SENT] as ChannelKey[];
  await fanOut({
    eventKey: NOTIFICATION_EVENTS.CIRCULAR_REMINDER_SENT,
    recipientUserIds: params.recipientUserIds,
    defaultChannels: defaults,
    renderBody: () => `Reminder: please acknowledge "${params.title}".`,
    metadata: {
      announcementId: params.announcementId,
    },
  });
}
