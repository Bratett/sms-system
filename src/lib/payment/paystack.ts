/**
 * Paystack Payment Gateway Client
 * Docs: https://paystack.com/docs/api/
 * Standard for Ghana mobile money and card payments.
 */

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

// ─── Initialize Transaction ────────────────────────────────────────

export interface InitializePaymentParams {
  email: string;
  /** Amount in pesewas (GHS * 100) */
  amount: number;
  currency?: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  channels?: ("card" | "mobile_money" | "bank")[];
}

export interface InitializePaymentResult {
  success: boolean;
  authorizationUrl?: string;
  accessCode?: string;
  reference?: string;
  error?: string;
}

export async function initializePayment(
  params: InitializePaymentParams,
): Promise<InitializePaymentResult> {
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        email: params.email,
        amount: params.amount,
        currency: params.currency || "GHS",
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

// ─── Verify Transaction ────────────────────────────────────────────

export interface VerifyPaymentResult {
  success: boolean;
  status?: string;
  amount?: number;
  currency?: string;
  reference?: string;
  channel?: string;
  paidAt?: string;
  error?: string;
}

export async function verifyPayment(reference: string): Promise<VerifyPaymentResult> {
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
        amount: data.data.amount, // in pesewas
        currency: data.data.currency,
        reference: data.data.reference,
        channel: data.data.channel,
        paidAt: data.data.paid_at,
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

// ─── Webhook Signature Verification ────────────────────────────────

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const crypto = require("crypto") as typeof import("crypto");
  const hash = crypto
    .createHmac("sha512", getSecretKey())
    .update(body)
    .digest("hex");
  return hash === signature;
}
