import type {
  PaymentProvider,
  PaymentInitParams,
  PaymentInitResult,
  PaymentVerifyResult,
  PaymentMethodMapping,
} from "../types";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY not configured");
  return key;
}

function headers() {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    "Content-Type": "application/json",
  };
}

export class PaystackProvider implements PaymentProvider {
  readonly name = "paystack";
  readonly displayName = "Paystack";
  readonly supportedCurrencies = ["GHS", "NGN", "USD", "ZAR"];

  async initializePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    try {
      const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          email: params.email,
          amount: params.amount,
          currency: params.currency,
          reference: params.reference,
          callback_url: params.callbackUrl,
          metadata: params.metadata,
          channels: params.channels || ["mobile_money", "card"],
        }),
      });

      const data = await response.json();

      if (data.status) {
        return {
          success: true,
          authorizationUrl: data.data.authorization_url,
          accessCode: data.data.access_code,
          reference: data.data.reference,
        };
      }

      return { success: false, error: data.message || "Failed to initialize payment" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment initialization failed",
      };
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerifyResult> {
    try {
      const response = await fetch(
        `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: headers() },
      );

      const data = await response.json();

      if (data.status && data.data.status === "success") {
        return {
          success: true,
          status: data.data.status,
          amount: data.data.amount,
          currency: data.data.currency,
          reference: data.data.reference,
          channel: data.data.channel,
          paidAt: data.data.paid_at,
          providerReference: data.data.id?.toString(),
        };
      }

      return {
        success: false,
        status: data.data?.status,
        error: data.message || "Payment not successful",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment verification failed",
      };
    }
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    const crypto = require("crypto") as typeof import("crypto");
    const hash = crypto
      .createHmac("sha512", getSecretKey())
      .update(body)
      .digest("hex");
    return hash === signature;
  }

  mapChannel(channel: string): PaymentMethodMapping {
    switch (channel) {
      case "card":
        return "BANK_TRANSFER";
      case "mobile_money":
        return "MOBILE_MONEY";
      case "bank":
      case "bank_transfer":
        return "BANK_TRANSFER";
      default:
        return "OTHER";
    }
  }

  fromSmallestUnit(amount: number): number {
    return amount / 100;
  }

  toSmallestUnit(amount: number): number {
    return Math.round(amount * 100);
  }
}
