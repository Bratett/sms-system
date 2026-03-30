import type { PaymentProvider } from "./types";
import { PaystackProvider } from "./providers/paystack.provider";
import { FlutterwaveProvider } from "./providers/flutterwave.provider";
import { StripeProvider } from "./providers/stripe.provider";

/**
 * Payment provider registry.
 * Manages available providers and selects the appropriate one
 * based on school configuration or currency.
 */

const providers = new Map<string, PaymentProvider>();

// Register built-in providers
providers.set("paystack", new PaystackProvider());
providers.set("flutterwave", new FlutterwaveProvider());
providers.set("stripe", new StripeProvider());

/**
 * Get a payment provider by name.
 */
export function getPaymentProvider(name: string): PaymentProvider | undefined {
  return providers.get(name);
}

/**
 * Get the default payment provider for a given currency.
 * Falls back to Paystack for African currencies, Stripe for international.
 */
export function getProviderForCurrency(currency: string): PaymentProvider {
  const africanCurrencies = ["GHS", "NGN", "KES", "ZAR", "XOF", "XAF", "UGX", "TZS", "RWF"];

  if (currency === "GHS" || currency === "NGN") {
    // Paystack is strongest in Ghana and Nigeria
    return providers.get("paystack")!;
  }

  if (africanCurrencies.includes(currency)) {
    // Flutterwave has broadest African coverage
    return providers.get("flutterwave")!;
  }

  // International currencies default to Stripe
  return providers.get("stripe")!;
}

/**
 * Get all registered provider names.
 */
export function getAvailableProviders(): string[] {
  return [...providers.keys()];
}

/**
 * Check if a provider supports a given currency.
 */
export function providerSupportsCurrency(providerName: string, currency: string): boolean {
  const provider = providers.get(providerName);
  if (!provider) return false;
  return provider.supportedCurrencies.includes(currency);
}

/**
 * Register a custom payment provider (for plugin system).
 */
export function registerPaymentProvider(provider: PaymentProvider): void {
  providers.set(provider.name, provider);
}
