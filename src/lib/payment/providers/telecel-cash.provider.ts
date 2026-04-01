import type {
  PaymentProvider,
  PaymentInitParams,
  PaymentInitResult,
  PaymentVerifyResult,
  PaymentMethodMapping,
} from "../types";
import { createHmac } from "crypto";

/**
 * Telecel (formerly Vodafone) Cash Payment Provider
 * Handles Telecel Cash payments for Ghanaian users.
 *
 * Required env vars:
 *   TELECEL_CASH_MERCHANT_ID
 *   TELECEL_CASH_API_KEY
 *   TELECEL_CASH_API_SECRET
 *   TELECEL_CASH_WEBHOOK_SECRET
 */

const BASE_URL = process.env.TELECEL_CASH_BASE_URL || "https://api.telecel.com/cash/v1";

function getConfig() {
  return {
    merchantId: process.env.TELECEL_CASH_MERCHANT_ID || "",
    apiKey: process.env.TELECEL_CASH_API_KEY || "",
    apiSecret: process.env.TELECEL_CASH_API_SECRET || "",
    webhookSecret: process.env.TELECEL_CASH_WEBHOOK_SECRET || "",
  };
}

export class TelecelCashProvider implements PaymentProvider {
  readonly name = "telecel_cash";
  readonly displayName = "Telecel Cash";
  readonly supportedCurrencies = ["GHS"];

  async initializePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    try {
      const config = getConfig();

      const response = await fetch(`${BASE_URL}/payment/request`, {
        method: "POST",
        headers: {
          "X-Merchant-Id": config.merchantId,
          "X-Api-Key": config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: this.fromSmallestUnit(params.amount),
          currency: params.currency,
          reference: params.reference,
          phoneNumber: params.metadata?.phoneNumber || "",
          description: params.metadata?.message || "School fee payment",
          callbackUrl: params.callbackUrl,
        }),
      });

      const data = await response.json();

      if (data.success || data.status === "PENDING") {
        return {
          success: true,
          reference: data.transactionId || params.reference,
        };
      }

      return { success: false, error: data.message || "Telecel Cash request failed" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Telecel Cash payment failed",
      };
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerifyResult> {
    try {
      const config = getConfig();

      const response = await fetch(
        `${BASE_URL}/payment/status/${encodeURIComponent(reference)}`,
        {
          headers: {
            "X-Merchant-Id": config.merchantId,
            "X-Api-Key": config.apiKey,
          },
        },
      );

      const data = await response.json();

      if (data.status === "SUCCESSFUL" || data.status === "COMPLETED") {
        return {
          success: true,
          status: data.status,
          amount: this.toSmallestUnit(parseFloat(data.amount)),
          currency: data.currency || "GHS",
          reference: data.reference || reference,
          channel: "mobile_money",
          paidAt: data.completedAt || new Date().toISOString(),
          providerReference: data.transactionId,
        };
      }

      return { success: false, error: `Payment status: ${data.status}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Verification failed",
      };
    }
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    const config = getConfig();
    if (!config.webhookSecret) return false;
    const expected = createHmac("sha256", config.webhookSecret).update(body).digest("hex");
    return expected === signature;
  }

  mapChannel(_channel: string): PaymentMethodMapping {
    return "MOBILE_MONEY";
  }

  fromSmallestUnit(amount: number): number {
    return amount / 100;
  }

  toSmallestUnit(amount: number): number {
    return Math.round(amount * 100);
  }
}
