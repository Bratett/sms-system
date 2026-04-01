import type {
  PaymentProvider,
  PaymentInitParams,
  PaymentInitResult,
  PaymentVerifyResult,
  PaymentMethodMapping,
} from "../types";
import { createHmac } from "crypto";

/**
 * MTN Mobile Money Collections API Provider
 * Handles MoMo payments for Ghanaian users via MTN's Collections API.
 *
 * Required env vars:
 *   MTN_MOMO_COLLECTION_API_KEY
 *   MTN_MOMO_COLLECTION_USER_ID
 *   MTN_MOMO_SUBSCRIPTION_KEY
 *   MTN_MOMO_ENVIRONMENT (sandbox | production)
 *   MTN_MOMO_WEBHOOK_SECRET
 */

const SANDBOX_BASE = "https://sandbox.momodeveloper.mtn.com";
const PRODUCTION_BASE = "https://momodeveloper.mtn.com";

function getConfig() {
  return {
    apiKey: process.env.MTN_MOMO_COLLECTION_API_KEY || "",
    userId: process.env.MTN_MOMO_COLLECTION_USER_ID || "",
    subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY || "",
    environment: (process.env.MTN_MOMO_ENVIRONMENT || "sandbox") as "sandbox" | "production",
    webhookSecret: process.env.MTN_MOMO_WEBHOOK_SECRET || "",
  };
}

function getBaseUrl(): string {
  const config = getConfig();
  return config.environment === "production" ? PRODUCTION_BASE : SANDBOX_BASE;
}

function getAuthToken(): string {
  const config = getConfig();
  return Buffer.from(`${config.userId}:${config.apiKey}`).toString("base64");
}

export class MtnMomoProvider implements PaymentProvider {
  readonly name = "mtn_momo";
  readonly displayName = "MTN Mobile Money";
  readonly supportedCurrencies = ["GHS"];

  async initializePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    try {
      const config = getConfig();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/collection/v1_0/requesttopay`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${getAuthToken()}`,
          "X-Reference-Id": params.reference,
          "X-Target-Environment": config.environment,
          "Ocp-Apim-Subscription-Key": config.subscriptionKey,
          "Content-Type": "application/json",
          "X-Callback-Url": params.callbackUrl,
        },
        body: JSON.stringify({
          amount: String(this.fromSmallestUnit(params.amount)),
          currency: params.currency,
          externalId: params.reference,
          payer: {
            partyIdType: "MSISDN",
            partyId: params.metadata?.phoneNumber || "",
          },
          payerMessage: params.metadata?.message || "School fee payment",
          payeeNote: params.metadata?.note || "Fee collection",
        }),
      });

      if (response.status === 202) {
        return {
          success: true,
          reference: params.reference,
        };
      }

      const errorData = await response.text();
      return { success: false, error: `MTN MoMo error: ${errorData}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "MTN MoMo payment failed",
      };
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerifyResult> {
    try {
      const config = getConfig();
      const baseUrl = getBaseUrl();

      const response = await fetch(
        `${baseUrl}/collection/v1_0/requesttopay/${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Basic ${getAuthToken()}`,
            "X-Target-Environment": config.environment,
            "Ocp-Apim-Subscription-Key": config.subscriptionKey,
          },
        },
      );

      const data = await response.json();

      if (data.status === "SUCCESSFUL") {
        return {
          success: true,
          status: data.status,
          amount: this.toSmallestUnit(parseFloat(data.amount)),
          currency: data.currency,
          reference: data.externalId,
          channel: "mobile_money",
          paidAt: new Date().toISOString(),
          providerReference: data.financialTransactionId,
        };
      }

      return { success: false, error: `Payment status: ${data.status}`, status: data.status };
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
