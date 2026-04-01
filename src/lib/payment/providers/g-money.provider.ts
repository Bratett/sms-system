import type {
  PaymentProvider,
  PaymentInitParams,
  PaymentInitResult,
  PaymentVerifyResult,
  PaymentMethodMapping,
} from "../types";
import { createHmac } from "crypto";

/**
 * G-Money Payment Provider
 * Handles GCB Bank G-Money payments for Ghanaian users.
 *
 * Required env vars:
 *   GMONEY_MERCHANT_ID
 *   GMONEY_API_KEY
 *   GMONEY_API_SECRET
 *   GMONEY_WEBHOOK_SECRET
 */

const BASE_URL = process.env.GMONEY_BASE_URL || "https://api.gmoney.com.gh/v1";

function getConfig() {
  return {
    merchantId: process.env.GMONEY_MERCHANT_ID || "",
    apiKey: process.env.GMONEY_API_KEY || "",
    apiSecret: process.env.GMONEY_API_SECRET || "",
    webhookSecret: process.env.GMONEY_WEBHOOK_SECRET || "",
  };
}

export class GMoneyProvider implements PaymentProvider {
  readonly name = "g_money";
  readonly displayName = "G-Money";
  readonly supportedCurrencies = ["GHS"];

  async initializePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    try {
      const config = getConfig();

      const response = await fetch(`${BASE_URL}/payment/collect`, {
        method: "POST",
        headers: {
          "X-Merchant-Id": config.merchantId,
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: this.fromSmallestUnit(params.amount),
          currency: params.currency,
          reference: params.reference,
          customerPhone: params.metadata?.phoneNumber || "",
          description: params.metadata?.message || "School fee payment",
          callbackUrl: params.callbackUrl,
        }),
      });

      const data = await response.json();

      if (data.success || data.code === "00") {
        return {
          success: true,
          reference: data.transactionId || params.reference,
        };
      }

      return { success: false, error: data.message || "G-Money payment request failed" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "G-Money payment failed",
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
            Authorization: `Bearer ${config.apiKey}`,
          },
        },
      );

      const data = await response.json();

      if (data.status === "SUCCESSFUL" || data.code === "00") {
        return {
          success: true,
          status: "SUCCESSFUL",
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
