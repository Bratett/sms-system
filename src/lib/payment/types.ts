/**
 * Payment provider abstraction types.
 * All providers implement the PaymentProvider interface.
 */

export interface PaymentInitParams {
  email: string;
  /** Amount in the currency's smallest unit (e.g., pesewas for GHS, kobo for NGN, cents for USD) */
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  channels?: string[];
}

export interface PaymentInitResult {
  success: boolean;
  authorizationUrl?: string;
  accessCode?: string;
  reference?: string;
  error?: string;
}

export interface PaymentVerifyResult {
  success: boolean;
  status?: string;
  /** Amount in the currency's smallest unit */
  amount?: number;
  currency?: string;
  reference?: string;
  channel?: string;
  paidAt?: string;
  providerReference?: string;
  error?: string;
}

export type PaymentMethodMapping = "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "CHEQUE" | "OTHER";

export interface PaymentProvider {
  /** Unique provider identifier */
  readonly name: string;

  /** Human-readable display name */
  readonly displayName: string;

  /** Supported currencies */
  readonly supportedCurrencies: string[];

  /** Initialize a payment transaction */
  initializePayment(params: PaymentInitParams): Promise<PaymentInitResult>;

  /** Verify a payment by reference */
  verifyPayment(reference: string): Promise<PaymentVerifyResult>;

  /** Verify webhook signature */
  verifyWebhookSignature(body: string, signature: string): boolean;

  /** Map provider channel name to internal PaymentMethod */
  mapChannel(channel: string): PaymentMethodMapping;

  /** Convert amount from smallest unit to standard unit (e.g., pesewas to GHS) */
  fromSmallestUnit(amount: number): number;

  /** Convert amount from standard unit to smallest unit (e.g., GHS to pesewas) */
  toSmallestUnit(amount: number): number;
}

/** Currency configuration */
export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  /** Number of decimal places (e.g., 2 for GHS, 0 for JPY) */
  decimals: number;
  /** Multiplier to convert to smallest unit (e.g., 100 for GHS) */
  smallestUnitMultiplier: number;
}

export const CURRENCIES: Record<string, CurrencyConfig> = {
  GHS: { code: "GHS", name: "Ghana Cedi", symbol: "GH\u20B5", decimals: 2, smallestUnitMultiplier: 100 },
  NGN: { code: "NGN", name: "Nigerian Naira", symbol: "\u20A6", decimals: 2, smallestUnitMultiplier: 100 },
  KES: { code: "KES", name: "Kenyan Shilling", symbol: "KSh", decimals: 2, smallestUnitMultiplier: 100 },
  USD: { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, smallestUnitMultiplier: 100 },
  EUR: { code: "EUR", name: "Euro", symbol: "\u20AC", decimals: 2, smallestUnitMultiplier: 100 },
  GBP: { code: "GBP", name: "British Pound", symbol: "\u00A3", decimals: 2, smallestUnitMultiplier: 100 },
  XOF: { code: "XOF", name: "West African CFA Franc", symbol: "CFA", decimals: 0, smallestUnitMultiplier: 1 },
  ZAR: { code: "ZAR", name: "South African Rand", symbol: "R", decimals: 2, smallestUnitMultiplier: 100 },
};
