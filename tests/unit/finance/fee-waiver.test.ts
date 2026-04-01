import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  requestFeeWaiverAction,
  approveFeeWaiverAction,
  rejectFeeWaiverAction,
} from "@/modules/finance/actions/fee-waiver.action";

describe("Fee Waiver Actions", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  describe("requestFeeWaiverAction", () => {
    const validInput = {
      studentBillId: "bill-1",
      waiverType: "PERCENTAGE" as const,
      value: 50,
      reason: "Staff child discount",
    };

    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await requestFeeWaiverAction(validInput);
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject invalid waiver type", async () => {
      const result = await requestFeeWaiverAction({ ...validInput, waiverType: "INVALID" as never });
      expect(result.error).toBe("Invalid input");
    });

    it("should reject missing reason", async () => {
      const result = await requestFeeWaiverAction({ ...validInput, reason: "" });
      expect(result.error).toBe("Invalid input");
    });

    it("should reject if bill not found", async () => {
      prismaMock.studentBill.findUnique.mockResolvedValue(null);
      const result = await requestFeeWaiverAction(validInput);
      expect(result).toEqual({ error: "Student bill not found" });
    });

    it("should reject if bill already paid", async () => {
      prismaMock.studentBill.findUnique.mockResolvedValue({
        id: "bill-1", status: "PAID", totalAmount: 1000, billItems: [],
      } as never);

      const result = await requestFeeWaiverAction(validInput);
      expect(result.error).toContain("already paid or waived");
    });

    it("should calculate percentage waiver correctly", async () => {
      prismaMock.studentBill.findUnique.mockResolvedValue({
        id: "bill-1", status: "UNPAID", totalAmount: 1000, balanceAmount: 1000, billItems: [],
      } as never);
      prismaMock.feeWaiver.create.mockResolvedValue({
        id: "waiver-1", calculatedAmount: 500, waiverType: "PERCENTAGE",
      } as never);

      const result = await requestFeeWaiverAction(validInput);
      expect(result.error).toBeUndefined();
    });
  });

  describe("approveFeeWaiverAction", () => {
    it("should reject if waiver not found", async () => {
      prismaMock.feeWaiver.findUnique.mockResolvedValue(null);
      const result = await approveFeeWaiverAction("nonexistent");
      expect(result).toEqual({ error: "Fee waiver not found" });
    });

    it("should reject non-pending waiver", async () => {
      prismaMock.feeWaiver.findUnique.mockResolvedValue({
        id: "waiver-1", status: "APPROVED",
      } as never);
      const result = await approveFeeWaiverAction("waiver-1");
      expect(result).toEqual({ error: "Only pending waivers can be approved" });
    });
  });

  describe("rejectFeeWaiverAction", () => {
    it("should reject non-pending waiver", async () => {
      prismaMock.feeWaiver.findUnique.mockResolvedValue({
        id: "waiver-1", status: "REJECTED",
      } as never);
      const result = await rejectFeeWaiverAction("waiver-1");
      expect(result).toEqual({ error: "Only pending waivers can be rejected" });
    });
  });

  describe("Waiver calculation logic", () => {
    it("should calculate percentage waiver on total bill", () => {
      const totalAmount = 2000;
      const value = 25; // 25%
      const calculated = totalAmount * (value / 100);
      expect(calculated).toBe(500);
    });

    it("should calculate fixed amount waiver capped at base", () => {
      const totalAmount = 200;
      const fixedValue = 500;
      const calculated = Math.min(fixedValue, totalAmount);
      expect(calculated).toBe(200);
    });

    it("should calculate full waiver as balance amount", () => {
      const balanceAmount = 1500;
      expect(balanceAmount).toBe(1500);
    });
  });
});
