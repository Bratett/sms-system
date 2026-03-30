import type { ChannelType, MessageChannel, MessagePayload, MessageResult } from "./types";
export type { ChannelType };
import { WhatsAppChannel } from "./channels/whatsapp.channel";
import { PushChannel } from "./channels/push.channel";
import { InAppChannel } from "./channels/in-app.channel";

/**
 * Messaging Hub - orchestrates multi-channel message delivery.
 *
 * Supports sending through multiple channels simultaneously:
 * - SMS (existing BullMQ-based system)
 * - WhatsApp Business API
 * - Web Push Notifications
 * - In-App Notifications
 * - Email (existing Nodemailer-based system)
 */

const channels = new Map<ChannelType, MessageChannel>();

// Register available channels
channels.set("whatsapp", new WhatsAppChannel());
channels.set("push", new PushChannel());
channels.set("in_app", new InAppChannel());

/**
 * Get a specific channel by type.
 */
export function getChannel(type: ChannelType): MessageChannel | undefined {
  return channels.get(type);
}

/**
 * Send a message through a specific channel.
 */
export async function sendMessage(
  channel: ChannelType,
  payload: MessagePayload,
): Promise<MessageResult> {
  const ch = channels.get(channel);
  if (!ch) {
    return { success: false, error: `Channel '${channel}' not available` };
  }

  try {
    return await ch.send(payload);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : `${channel} delivery failed`,
    };
  }
}

/**
 * Send a message through multiple channels simultaneously.
 * Returns results for each channel attempted.
 */
export async function sendMultiChannel(
  channelTypes: ChannelType[],
  payload: MessagePayload,
): Promise<Record<ChannelType, MessageResult>> {
  const results: Record<string, MessageResult> = {};

  const promises = channelTypes.map(async (type) => {
    results[type] = await sendMessage(type, payload);
  });

  await Promise.allSettled(promises);
  return results as Record<ChannelType, MessageResult>;
}

/**
 * Send a broadcast message to multiple recipients across channels.
 */
export async function broadcastMessage(data: {
  channels: ChannelType[];
  recipients: Array<{
    userId: string;
    phone?: string;
    email?: string;
    pushSubscription?: string;
  }>;
  message: string;
  subject?: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  totalSent: number;
  totalFailed: number;
  byChannel: Record<string, { sent: number; failed: number }>;
}> {
  const stats = {
    totalSent: 0,
    totalFailed: 0,
    byChannel: {} as Record<string, { sent: number; failed: number }>,
  };

  for (const channelType of data.channels) {
    const channelStats = { sent: 0, failed: 0 };

    for (const recipient of data.recipients) {
      let to: string | null = null;

      switch (channelType) {
        case "sms":
        case "whatsapp":
          to = recipient.phone || null;
          break;
        case "push":
          to = recipient.pushSubscription || null;
          break;
        case "in_app":
          to = recipient.userId;
          break;
      }

      if (!to) continue;

      const result = await sendMessage(channelType, {
        to,
        body: data.message,
        subject: data.subject,
        metadata: data.metadata,
      });

      if (result.success) {
        channelStats.sent++;
        stats.totalSent++;
      } else {
        channelStats.failed++;
        stats.totalFailed++;
      }
    }

    stats.byChannel[channelType] = channelStats;
  }

  return stats;
}

/**
 * Get available channel types.
 */
export function getAvailableChannels(): ChannelType[] {
  return [...channels.keys()];
}

/**
 * Register a custom channel (for plugins).
 */
export function registerChannel(type: ChannelType, channel: MessageChannel): void {
  channels.set(type, channel);
}
