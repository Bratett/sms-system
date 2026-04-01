import type {
  PaymentProvider,
  PaymentInitParams,
  PaymentInitResult,
  PaymentVerifyResult,
  PaymentMethodMapping,
} from "../types";
import { createHmac } from "crypto";

/**
 * AirtelTigo Money Payment Provider
 * Handles AirtelTigo (AT) Money payments for Ghanaian users.
 *
 * Required env vars:
 *   AIRTELTIGO_MERCHANT_ID
 *   AIRTELTIGO_API_KEY
 *   AIRTELTIGO_API_SECRET
 *   AIRTELTIGO_WEBHOOK_SECRET
 */

const BASE_URL = process.env.AIRTELTIGO_BASE_URL || "https://api.airteltigo.com/payments/v1";

function getConfig() {
  return {
    merchantId: process.env.AIRTELTIGO_MERCHANT_ID || "",
    apiKey: process.env.AIRTELTIGO_API_KEY || "",
    apiSecret: process.env.AIRTELTIGO_API_SECRET || "",
    webhookSecret: process.env.AIRTELTIGO_WEBHOOK_SECRET || "",
  };
}

export class AirtelTigoProvider implements PaymentProvider {
  readonly name = "airteltigo";
  readonly displayName = "AirtelTigo Money";
  readonly supportedCurrencies = ["GHS"];

  async initializePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    try {
      const config = getConfig();

      const response = await fetch(`${BASE_URL}/collect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "X-Merchant-Id": config.merchantId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: this.fromSmallestUnit(params.amount),
          currency: params.currency,
          reference: params.reference,
          msisdn: params.metadata?.phoneNumber || "",
          narration: params.metadata?.message || "School fee payment",
          callbackUrl: params.callbackUrl,
        }),
      });

      const data = await response.json();

      if (data.success || data.statusCode === "200") {
        return {
          success: true,
          reference: data.transactionId || params.reference,
        };
      }

      return { success: false, error: data.message || "AirtelTigo payment request failed" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "AirtelTigo payment failed",
      };
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerifyResult> {
    try {
      const config = getConfig();

      const response = await fetch(
        `${BASE_URL}/status/${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "X-Merchant-Id": config.merchantId,
          },
        },
      );

      const data = await response.json();

      if (data.status === "SUCCESSFUL") {
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
