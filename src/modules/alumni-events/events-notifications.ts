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

function humanizeDate(d: Date): string {
  return d.toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function notifyAlumniEventPublished(params: {
  eventId: string;
  schoolId: string;
  eventTitle: string;
  startAt: Date;
}): Promise<{ recipientCount: number }> {
  const profiles = await db.alumniProfile.findMany({
    where: { schoolId: params.schoolId },
    select: { studentId: true },
  });
  if (profiles.length === 0) {
    return { recipientCount: 0 };
  }

  const students = await db.student.findMany({
    where: { id: { in: profiles.map((p) => p.studentId) } },
    select: { id: true, userId: true },
  });
  const recipientUserIds = students
    .map((s) => s.userId)
    .filter((u): u is string => !!u);

  if (recipientUserIds.length === 0) {
    return { recipientCount: 0 };
  }

  const school = await db.school.findUnique({
    where: { id: params.schoolId },
    select: { name: true },
  });
  const schoolName = school?.name ?? "Your school";

  const prefs = await db.notificationPreference.findMany({
    where: {
      userId: { in: recipientUserIds },
      eventKey: NOTIFICATION_EVENTS.ALUMNI_EVENT_PUBLISHED,
    },
  });
  const prefByUser = new Map(prefs.map((p) => [p.userId, p.channels]));

  const defaults = EVENT_CHANNELS[NOTIFICATION_EVENTS.ALUMNI_EVENT_PUBLISHED] as ChannelKey[];
  const body =
    `${params.eventTitle} — ${humanizeDate(params.startAt)}\n\n` +
    `${schoolName} has published a new alumni event. Log in to RSVP.`;

  const metadata = {
    eventId: params.eventId,
    eventTitle: params.eventTitle,
    startAt: params.startAt.toISOString(),
  };

  for (const userId of recipientUserIds) {
    const override = prefByUser.get(userId);
    const channels: ChannelKey[] = override
      ? override.map(channelEnumToKey)
      : defaults;

    if (channels.length === 0) continue;

    for (const channel of channels) {
      const hubChannel = channelKeyToHub(channel);
      if (!hubChannel) continue;

      try {
        await sendMessage(hubChannel, {
          to: userId,
          body,
          metadata,
        });
      } catch (err) {
        console.error("alumni event notification failed", {
          eventId: params.eventId,
          userId,
          err,
        });
      }
    }
  }

  return { recipientCount: recipientUserIds.length };
}
