import type { MessageChannel, MessagePayload, MessageResult } from "../types";
import { db } from "@/lib/db";

/**
 * In-app notification channel.
 * Creates Notification records in the database
 * which are displayed in the notification dropdown.
 */
export class InAppChannel implements MessageChannel {
  readonly name = "in_app";
  readonly displayName = "In-App Notification";

  async send(payload: MessagePayload): Promise<MessageResult> {
    try {
      const notification = await db.notification.create({
        data: {
          userId: payload.to,
          title: payload.subject || "Notification",
          message: payload.body,
          type: ((payload.metadata?.type as string) || "INFO") as "INFO" | "SUCCESS" | "WARNING" | "ERROR",
          isRead: false,
          link: (payload.metadata?.link as string) || null,
        },
      });

      return { success: true, messageId: notification.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "In-app notification failed",
      };
    }
  }

  async sendBulk(payloads: MessagePayload[]): Promise<MessageResult[]> {
    try {
      const data = payloads.map((p) => ({
        userId: p.to,
        title: p.subject || "Notification",
        message: p.body,
        type: ((p.metadata?.type as string) || "INFO") as "INFO" | "SUCCESS" | "WARNING" | "ERROR",
        isRead: false,
        link: (p.metadata?.link as string) || null,
      }));

      await db.notification.createMany({ data });

      return payloads.map(() => ({ success: true }));
    } catch (error) {
      return payloads.map(() => ({
        success: false,
        error: error instanceof Error ? error.message : "Bulk notification failed",
      }));
    }
  }
}
