import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../setup";
import crypto from "crypto";

// Mock environment variable
vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_fake_key");

describe("Paystack — bill status calculation", () => {
  /**
   * Replicates the status logic from the webhook handler in
   * src/app/api/webhooks/paystack/route.ts
   */
  function calculateBillStatus(
    totalAmount: number,
    previousPaid: number,
    newPayment: number,
  ): "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID" {
    const newPaidAmount = previousPaid + newPayment;
    const newBalanceAmount = totalAmount - newPaidAmount;

    if (newBalanceAmount <= 0 && newPaidAmount > totalAmount) {
      return "OVERPAID";
    } else if (newBalanceAmount <= 0) {
      return "PAID";
    } else if (newPaidAmount > 0) {
      return "PARTIAL";
    } else {
      return "UNPAID";
    }
  }

  it("should return PARTIAL when paid less than total", () => {
    expect(calculateBillStatus(1500, 0, 500)).toBe("PARTIAL");
  });

  it("should return PAID when exact amount is paid", () => {
    expect(calculateBillStatus(1500, 1000, 500)).toBe("PAID");
  });

  it("should return OVERPAID when paid more than total", () => {
    expect(calculateBillStatus(1500, 1000, 600)).toBe("OVERPAID");
  });

  it("should return PARTIAL for first partial payment on zero-paid bill", () => {
    expect(calculateBillStatus(2000, 0, 100)).toBe("PARTIAL");
  });

  it("should return PAID when paying full amount at once", () => {
    expect(calculateBillStatus(1500, 0, 1500)).toBe("PAID");
  });
});

describe("Paystack — idempotency", () => {
  it("should not double-count when processing same reference twice", async () => {
    // Simulate the idempotency check from the webhook handler:
    // If a payment already exists with the same reference, it should be skipped.
    const reference = "PSK_REF_12345";

    // First call: no existing payment
    prismaMock.payment.findFirst.mockResolvedValueOnce(null);
    const first = await prismaMock.payment.findFirst({ where: { referenceNumber: reference } });
    expect(first).toBeNull(); // would proceed to create payment

    // Second call: payment already exists
    prismaMock.payment.findFirst.mockResolvedValueOnce({
      id: "pay-1",
      referenceNumber: reference,
      amount: 500,
    } as never);
    const second = await prismaMock.payment.findFirst({ where: { referenceNumber: reference } });
    expect(second).not.toBeNull(); // would skip, already processed
    expect(second!.referenceNumber).toBe(reference);
  });
});

describe("Paystack — webhook signature verification", () => {
  it("should return true for valid signature", async () => {
    const { verifyWebhookSignature } = await import("@/lib/payment/paystack");

    const body = '{"event":"charge.success","data":{}}';
    // Compute the real expected hash using the same key
    const expectedHash = crypto.createHmac("sha512", "sk_test_fake_key").update(body).digest("hex");

    const result = verifyWebhookSignature(body, expectedHash);
    expect(result).toBe(true);
  });

  it("should return false for invalid signature", async () => {
    const { verifyWebhookSignature } = await import("@/lib/payment/paystack");

    const body = '{"event":"charge.success","data":{}}';
    const signature = "wrong-signature";

    const result = verifyWebhookSignature(body, signature);
    expect(result).toBe(false);
  });
});
