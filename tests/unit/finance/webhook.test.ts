import { describe, it, expect } from "vitest";
import { MtnMomoProvider } from "@/lib/payment/providers/mtn-momo.provider";
import { TelecelCashProvider } from "@/lib/payment/providers/telecel-cash.provider";
import { AirtelTigoProvider } from "@/lib/payment/providers/airteltigo.provider";
import { GMoneyProvider } from "@/lib/payment/providers/g-money.provider";

describe("Ghana Payment Providers", () => {
  describe("MtnMomoProvider", () => {
    const provider = new MtnMomoProvider();

    it("should have correct name and display name", () => {
      expect(provider.name).toBe("mtn_momo");
      expect(provider.displayName).toBe("MTN Mobile Money");
    });

    it("should support GHS currency only", () => {
      expect(provider.supportedCurrencies).toEqual(["GHS"]);
    });

    it("should convert from smallest unit (pesewas to GHS)", () => {
      expect(provider.fromSmallestUnit(15000)).toBe(150);
      expect(provider.fromSmallestUnit(100)).toBe(1);
      expect(provider.fromSmallestUnit(50)).toBe(0.5);
    });

    it("should convert to smallest unit (GHS to pesewas)", () => {
      expect(provider.toSmallestUnit(150)).toBe(15000);
      expect(provider.toSmallestUnit(1)).toBe(100);
      expect(provider.toSmallestUnit(0.5)).toBe(50);
    });

    it("should map all channels to MOBILE_MONEY", () => {
      expect(provider.mapChannel("mobile_money")).toBe("MOBILE_MONEY");
      expect(provider.mapChannel("momo")).toBe("MOBILE_MONEY");
    });

    it("should reject invalid webhook signature when no secret", () => {
      expect(provider.verifyWebhookSignature("body", "sig")).toBe(false);
    });
  });

  describe("TelecelCashProvider", () => {
    const provider = new TelecelCashProvider();

    it("should have correct name", () => {
      expect(provider.name).toBe("telecel_cash");
      expect(provider.displayName).toBe("Telecel Cash");
    });

    it("should support GHS only", () => {
      expect(provider.supportedCurrencies).toEqual(["GHS"]);
    });

    it("should handle unit conversions", () => {
      expect(provider.fromSmallestUnit(50000)).toBe(500);
      expect(provider.toSmallestUnit(500)).toBe(50000);
    });
  });

  describe("AirtelTigoProvider", () => {
    const provider = new AirtelTigoProvider();

    it("should have correct name", () => {
      expect(provider.name).toBe("airteltigo");
      expect(provider.displayName).toBe("AirtelTigo Money");
    });

    it("should support GHS only", () => {
      expect(provider.supportedCurrencies).toEqual(["GHS"]);
    });
  });

  describe("GMoneyProvider", () => {
    const provider = new GMoneyProvider();

    it("should have correct name", () => {
      expect(provider.name).toBe("g_money");
      expect(provider.displayName).toBe("G-Money");
    });

    it("should support GHS only", () => {
      expect(provider.supportedCurrencies).toEqual(["GHS"]);
    });

    it("should handle unit conversions", () => {
      expect(provider.fromSmallestUnit(100000)).toBe(1000);
      expect(provider.toSmallestUnit(1000)).toBe(100000);
    });
  });

  describe("Provider registry integration", () => {
    it("should have all 4 Ghana MoMo providers", async () => {
      // Dynamic import to trigger registry side effects
      const { getAvailableProviders, getPaymentProvider } = await import("@/lib/payment/registry");
      const providers = getAvailableProviders();

      expect(providers).toContain("mtn_momo");
      expect(providers).toContain("telecel_cash");
      expect(providers).toContain("airteltigo");
      expect(providers).toContain("g_money");

      // Verify each can be retrieved
      expect(getPaymentProvider("mtn_momo")).toBeDefined();
      expect(getPaymentProvider("telecel_cash")).toBeDefined();
      expect(getPaymentProvider("airteltigo")).toBeDefined();
      expect(getPaymentProvider("g_money")).toBeDefined();
    });
  });
});
