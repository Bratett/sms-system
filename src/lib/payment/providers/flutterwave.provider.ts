import type {
  PaymentProvider,
  PaymentInitParams,
  PaymentInitResult,
  PaymentVerifyResult,
  PaymentMethodMapping,
} from "../types";

const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3";

function getSecretKey(): string {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error("FLUTTERWAVE_SECRET_KEY not configured");
  return key;
}

function headers() {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    "Content-Type": "application/json",
  };
}

export class FlutterwaveProvider implements PaymentProvider {
  readonly name = "flutterwave";
  readonly displayName = "Flutterwave";
  readonly supportedCurrencies = [
    "GHS", "NGN", "KES", "USD", "EUR", "GBP", "ZAR", "XOF",
    "UGX", "TZS", "RWF", "XAF",
  ];

  async initializePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    try {
      const response = await fetch(`${FLUTTERWAVE_BASE_URL}/payments`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          tx_ref: params.reference,
          amount: this.fromSmallestUnit(params.amount),
          currency: params.currency,
          redirect_url: params.callbackUrl,
          customer: { email: params.email },
          meta: params.metadata,
          payment_options: params.channels?.join(",") || "card,mobilemoney,banktransfer",
          customizations: {
            title: "School Fee Payment",
          },
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        return {
          success: true,
          authorizationUrl: data.data.link,
          reference: params.reference,
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
      // Flutterwave verifies by transaction ID, but we can search by tx_ref
      const response = await fetch(
        `${FLUTTERWAVE_BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
        { headers: headers() },
      );

      const data = await response.json();

      if (data.status === "success" && data.data.status === "successful") {
        return {
          success: true,
          status: data.data.status,
          amount: this.toSmallestUnit(data.data.amount),
          currency: data.data.currency,
          reference: data.data.tx_ref,
          channel: data.data.payment_type,
          paidAt: data.data.created_at,
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

  verifyWebhookSignature(_body: string, signature: string): boolean {
    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    if (!secretHash) return false;
    return signature === secretHash;
  }

  mapChannel(channel: string): PaymentMethodMapping {
    switch (channel) {
      case "card":
        return "BANK_TRANSFER";
      case "mobilemoney":
      case "mobilemoneyghana":
      case "mobilemoneyfranco":
        return "MOBILE_MONEY";
      case "banktransfer":
      case "account":
        return "BANK_TRANSFER";
      case "ussd":
        return "OTHER";
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
