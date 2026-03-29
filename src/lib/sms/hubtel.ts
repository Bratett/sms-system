import type { SmsProvider, SmsResult } from "./provider";

/**
 * Hubtel SMS Provider
 * Docs: https://developers.hubtel.com/reference/sendmessage
 */

const HUBTEL_BASE_URL = "https://smsc.hubtel.com/v1/messages/send";

export const hubtelProvider: SmsProvider = {
  async send(phone: string, message: string, senderId?: string): Promise<SmsResult> {
    const apiKey = process.env.SMS_API_KEY;
    const apiSecret = process.env.SMS_API_SECRET;
    const defaultSenderId = process.env.SMS_SENDER_ID || "SMS";

    if (!apiKey || !apiSecret) {
      return { success: false, error: "Hubtel API credentials not configured" };
    }

    try {
      const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

      const response = await fetch(HUBTEL_BASE_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          From: senderId || defaultSenderId,
          To: phone,
          Content: message,
        }),
      });

      const result = await response.json();

      if (response.ok && result.MessageId) {
        return {
          success: true,
          providerMessageId: result.MessageId,
          cost: result.Rate ? parseFloat(result.Rate) : undefined,
        };
      }

      return {
        success: false,
        error: result.Message || `Hubtel API error: HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown SMS delivery error",
      };
    }
  },

  async getDeliveryStatus(providerMessageId: string): Promise<string> {
    const apiKey = process.env.SMS_API_KEY;
    const apiSecret = process.env.SMS_API_SECRET;

    if (!apiKey || !apiSecret) return "UNKNOWN";

    try {
      const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

      const response = await fetch(
        `https://smsc.hubtel.com/v1/messages/${providerMessageId}`,
        {
          headers: { Authorization: `Basic ${credentials}` },
        },
      );

      if (!response.ok) return "UNKNOWN";

      const result = await response.json();
      // Map Hubtel status to our status enum
      const statusMap: Record<string, string> = {
        Submitted: "SENT",
        Delivered: "DELIVERED",
        Undeliverable: "FAILED",
        Rejected: "FAILED",
      };

      return statusMap[result.Status] || "SENT";
    } catch {
      return "UNKNOWN";
    }
  },
};
