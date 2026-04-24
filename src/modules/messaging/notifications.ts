import { db } from "@/lib/db";
import { sendMessage, type ChannelType } from "@/lib/messaging/hub";
import { NOTIFICATION_EVENTS, EVENT_CHANNELS } from "@/lib/notifications/events";
import type { NotificationChannel } from "@prisma/client";

type NotifyParams = {
  messageId: string;
  threadId: string;
  recipientUserIds: string[];
  authorRole: "parent" | "teacher";
  studentName: string;
  authorName: string;
  bodyPreview: string;
};

const CHANNEL_ENUM_TO_HUB: Record<NotificationChannel, ChannelType | null> = {
  IN_APP: "in_app",
  WHATSAPP: "whatsapp",
  PUSH: "push",
  SMS: "sms",
  EMAIL: "email",
};

const EVENT_CHANNELS_AS_ENUM: Record<"parent" | "teacher", NotificationChannel[]> = {
  parent: (EVENT_CHANNELS[NOTIFICATION_EVENTS.MESSAGE_RECEIVED_PARENT] ?? ["in_app"]).map((c) =>
    channelKeyToEnum(c),
  ),
  teacher: (EVENT_CHANNELS[NOTIFICATION_EVENTS.MESSAGE_RECEIVED_TEACHER] ?? ["in_app"]).map((c) =>
    channelKeyToEnum(c),
  ),
};

/**
 * Fan out a new-message notification to recipients via their preferred
 * channels (or the system defaults if no preference exists).
 *
 * Errors during individual dispatches are swallowed so one recipient's
 * failure doesn't block others.
 */
export async function notifyNewMessage(params: NotifyParams): Promise<void> {
  const eventKey =
    params.authorRole === "teacher"
      ? NOTIFICATION_EVENTS.MESSAGE_RECEIVED_PARENT
      : NOTIFICATION_EVENTS.MESSAGE_RECEIVED_TEACHER;

  const audience: "parent" | "teacher" =
    params.authorRole === "teacher" ? "parent" : "teacher";

  const prefs = await db.notificationPreference.findMany({
    where: {
      userId: { in: params.recipientUserIds },
      eventKey,
    },
  });
  const prefByUser = new Map(prefs.map((p) => [p.userId, p.channels]));

  for (const userId of params.recipientUserIds) {
    const override = prefByUser.get(userId);
    const channels = override ?? EVENT_CHANNELS_AS_ENUM[audience];

    if (channels.length === 0) continue;

    for (const channel of channels) {
      const hubChannel = CHANNEL_ENUM_TO_HUB[channel];
      if (!hubChannel) continue;

      try {
        await sendMessage(hubChannel, {
          to: userId,
          body: renderBody(params),
          templateData: {
            studentName: params.studentName,
            authorName: params.authorName,
            bodyPreview: params.bodyPreview,
            eventKey,
            threadId: params.threadId,
          },
        });
      } catch {
        // swallowed — do not block other recipients/channels
      }
    }
  }
}

function renderBody(p: NotifyParams): string {
  const who =
    p.authorRole === "teacher"
      ? `${p.authorName} (teacher)`
      : `${p.authorName} (parent)`;
  return `New message about ${p.studentName} from ${who}: ${p.bodyPreview}`;
}

function channelKeyToEnum(c: string): NotificationChannel {
  switch (c) {
    case "in_app":
      return "IN_APP";
    case "sms":
      return "SMS";
    case "email":
      return "EMAIL";
    case "whatsapp":
      return "WHATSAPP";
    case "push":
      return "PUSH";
    default:
      // Fail loud rather than silently falling through to IN_APP; an unknown
      // key is almost always a typo in EVENT_CHANNELS config and masking it
      // makes channel-preference bugs hard to spot.
      throw new Error(`unknown notification channel key: "${c}"`);
  }
}
