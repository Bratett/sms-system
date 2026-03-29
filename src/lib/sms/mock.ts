import type { SmsProvider, SmsResult } from "./provider";

/**
 * Mock SMS Provider for development and testing.
 * Logs messages to console instead of sending.
 */
export const mockProvider: SmsProvider = {
  async send(phone: string, message: string, senderId?: string): Promise<SmsResult> {
    console.log(`[Mock SMS] From: ${senderId || "SMS"} To: ${phone} Message: ${message}`);

    return {
      success: true,
      providerMessageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      cost: 0,
    };
  },

  async getDeliveryStatus(_providerMessageId: string): Promise<string> {
    return "DELIVERED";
  },
};
