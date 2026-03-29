/**
 * SMS Provider Interface
 * Abstraction layer for SMS delivery providers.
 * Implementations: Hubtel (production), Mock (dev/test).
 */

export interface SmsResult {
  success: boolean;
  providerMessageId?: string;
  cost?: number;
  error?: string;
}

export interface SmsProvider {
  send(phone: string, message: string, senderId?: string): Promise<SmsResult>;
  getDeliveryStatus?(providerMessageId: string): Promise<string>;
}

export function getSmsProvider(): SmsProvider {
  const provider = process.env.SMS_PROVIDER || "mock";

  switch (provider) {
    case "hubtel":
      // Lazy import to avoid loading in environments without credentials
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("./hubtel").hubtelProvider;
    case "mock":
    default:
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("./mock").mockProvider;
  }
}
