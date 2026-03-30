import type {
  PaymentProvider,
  PaymentInitParams,
  PaymentInitResult,
  PaymentVerifyResult,
  PaymentMethodMapping,
} from "../types";

const STRIPE_BASE_URL = "https://api.stripe.com/v1";

function getSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return key;
}

function headers() {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

function toFormData(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value !== null && value !== undefined) {
      if (typeof value === "object" && !Array.isArray(value)) {
        parts.push(toFormData(value as Record<string, unknown>, fullKey));
      } else {
        parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
      }
    }
  }
  return parts.filter(Boolean).join("&");
}

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";
  readonly displayName = "Stripe";
  readonly supportedCurrencies = [
    "USD", "EUR", "GBP", "GHS", "NGN", "KES", "ZAR",
  ];

  async initializePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    try {
      const body = toFormData({
        "payment_method_types[]": "card",
        mode: "payment",
        success_url: `${params.callbackUrl}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: params.callbackUrl,
        "line_items[0][price_data][currency]": params.currency.toLowerCase(),
        "line_items[0][price_data][unit_amount]": params.amount.toString(),
        "line_items[0][price_data][product_data][name]": "School Fee Payment",
        "line_items[0][quantity]": "1",
        client_reference_id: params.reference,
        customer_email: params.email,
      });

      const response = await fetch(`${STRIPE_BASE_URL}/checkout/sessions`, {
        method: "POST",
        headers: headers(),
        body,
      });

      const data = await response.json();

      if (data.url) {
        return {
          success: true,
          authorizationUrl: data.url,
          accessCode: data.id,
          reference: params.reference,
        };
      }

      return { success: false, error: data.error?.message || "Failed to create checkout session" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment initialization failed",
      };
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerifyResult> {
    try {
      // Search for checkout session by client_reference_id
      const response = await fetch(
        `${STRIPE_BASE_URL}/checkout/sessions?client_reference_id=${encodeURIComponent(reference)}`,
        { headers: headers() },
      );

      const data = await response.json();
      const session = data.data?.[0];

      if (session && session.payment_status === "paid") {
        return {
          success: true,
          status: "success",
          amount: session.amount_total,
          currency: session.currency?.toUpperCase(),
          reference: session.client_reference_id,
          channel: "card",
          paidAt: new Date(session.created * 1000).toISOString(),
          providerReference: session.payment_intent,
        };
      }

      return {
        success: false,
        status: session?.payment_status || "unpaid",
        error: "Payment not completed",
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
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return false;

    const parts = signature.split(",");
    const timestampPart = parts.find((p) => p.startsWith("t="));
    const signaturePart = parts.find((p) => p.startsWith("v1="));

    if (!timestampPart || !signaturePart) return false;

    const timestamp = timestampPart.split("=")[1];
    const expectedSig = signaturePart.split("=")[1];

    const payload = `${timestamp}.${body}`;
    const computedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(payload)
      .digest("hex");

    return computedSig === expectedSig;
  }

  mapChannel(channel: string): PaymentMethodMapping {
    switch (channel) {
      case "card":
        return "BANK_TRANSFER";
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
