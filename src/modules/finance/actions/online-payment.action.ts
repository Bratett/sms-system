"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getPaymentProvider, getProviderForCurrency } from "@/lib/payment/registry";
import { CURRENCIES } from "@/lib/payment/types";

// ─── Initiate Online Payment ───────────────────────────────────────

export async function initiateOnlinePaymentAction(data: {
  studentBillId: string;
  amount: number;
  email: string;
  currency?: string;
  provider?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  if (data.amount <= 0) return { error: "Amount must be greater than zero" };

  const bill = await db.studentBill.findUnique({
    where: { id: data.studentBillId },
  });

  if (!bill) return { error: "Bill not found" };

  if (bill.status === "PAID" || bill.status === "OVERPAID") {
    return { error: "This bill is already fully paid" };
  }

  if (data.amount > bill.balanceAmount) {
    return { error: `Amount exceeds outstanding balance of ${bill.balanceAmount.toFixed(2)}` };
  }

  // Resolve payment provider
  const currency = data.currency || "GHS";
  const currencyConfig = CURRENCIES[currency];
  if (!currencyConfig) return { error: `Unsupported currency: ${currency}` };

  const provider = data.provider
    ? getPaymentProvider(data.provider)
    : getProviderForCurrency(currency);

  if (!provider) return { error: `Payment provider not found: ${data.provider}` };

  if (!provider.supportedCurrencies.includes(currency)) {
    return { error: `${provider.displayName} does not support ${currency}` };
  }

  // Generate unique reference
  const reference = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3000";

  const result = await provider.initializePayment({
    email: data.email,
    amount: provider.toSmallestUnit(data.amount),
    currency,
    reference,
    callbackUrl: `${baseUrl}/parent/fees?payment=success&ref=${reference}`,
    metadata: {
      studentBillId: bill.id,
      studentId: bill.studentId,
      schoolId: school.id,
      provider: provider.name,
    },
  });

  if (!result.success) {
    return { error: result.error || "Failed to initialize payment" };
  }

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Payment",
    module: "finance",
    description: `Initiated online payment of ${currencyConfig.symbol} ${data.amount.toFixed(currencyConfig.decimals)} via ${provider.displayName}. Ref: ${reference}`,
    metadata: { reference, amount: data.amount, currency, provider: provider.name, studentBillId: bill.id },
  });

  return {
    data: {
      authorizationUrl: result.authorizationUrl,
      accessCode: result.accessCode,
      reference: result.reference,
      provider: provider.name,
    },
  };
}

// ─── Verify Online Payment (callback handler) ──────────────────────

export async function verifyOnlinePaymentAction(reference: string, providerName?: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  // Try to determine provider from reference or use specified one
  const provider = providerName
    ? getPaymentProvider(providerName)
    : getProviderForCurrency("GHS"); // Default fallback

  if (!provider) return { error: "Payment provider not found" };

  const result = await provider.verifyPayment(reference);

  if (result.success) {
    return {
      data: {
        status: "success",
        amount: provider.fromSmallestUnit(result.amount || 0),
        currency: result.currency,
        reference: result.reference,
        channel: result.channel,
        paidAt: result.paidAt,
        provider: provider.name,
      },
    };
  }

  return {
    data: {
      status: result.status || "failed",
      reference,
      error: result.error,
    },
  };
}
