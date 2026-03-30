import type { MessageChannel, MessagePayload, MessageResult } from "../types";

/**
 * Web Push notification channel.
 * Uses the Web Push Protocol (VAPID) to send push notifications
 * to subscribed browsers/PWA instances.
 */

interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function getVapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@school.edu.gh";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)");
  }
  return { publicKey, privateKey, subject };
}

export class PushChannel implements MessageChannel {
  readonly name = "push";
  readonly displayName = "Push Notification";

  async send(payload: MessagePayload): Promise<MessageResult> {
    try {
      // payload.to should be a JSON-encoded PushSubscription
      const subscription: PushSubscriptionData = JSON.parse(payload.to);
      const { publicKey, privateKey, subject } = getVapidKeys();

      // Dynamic import web-push (optional dependency)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let webpush: any;
      try {
        webpush = require("web-push");
      } catch {
        return { success: false, error: "web-push package not installed" };
      }

      webpush.setVapidDetails(subject, publicKey, privateKey);

      const notificationPayload = JSON.stringify({
        title: payload.subject || "School Notification",
        body: payload.body,
        icon: "/icons/icon-192x192.svg",
        badge: "/icons/icon-192x192.svg",
        data: payload.metadata,
      });

      await webpush.sendNotification(subscription, notificationPayload);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Push notification failed",
      };
    }
  }

  async sendBulk(payloads: MessagePayload[]): Promise<MessageResult[]> {
    return Promise.all(payloads.map((p) => this.send(p)));
  }
}
