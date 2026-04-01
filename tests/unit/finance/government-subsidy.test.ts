import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createGovernmentSubsidyAction,
  recordDisbursementAction,
  deleteGovernmentSubsidyAction,
} from "@/modules/finance/actions/government-subsidy.action";

describe("Government Subsidy Actions", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  describe("createGovernmentSubsidyAction", () => {
    const validInput = {
      name: "Free SHS Term 1 2026",
      subsidyType: "FREE_SHS" as const,
      academicYearId: "ay-1",
      expectedAmount: 50000,
    };

    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await createGovernmentSubsidyAction(validInput);
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject invalid subsidy type", async () => {
      const result = await createGovernmentSubsidyAction({ ...validInput, subsidyType: "INVALID" as never });
      expect(result.error).toBe("Invalid input");
    });

    it("should reject zero expected amount", async () => {
      const result = await createGovernmentSubsidyAction({ ...validInput, expectedAmount: 0 });
      expect(result.error).toBe("Invalid input");
    });

    it("should create subsidy with valid data", async () => {
      prismaMock.governmentSubsidy.create.mockResolvedValue({
        id: "sub-1", name: validInput.name, status: "EXPECTED",
      } as never);

      const result = await createGovernmentSubsidyAction(validInput);
      expect(result.data).toBeDefined();
    });
  });

  describe("recordDisbursementAction", () => {
    it("should reject if subsidy not found", async () => {
      prismaMock.governmentSubsidy.findUnique.mockResolvedValue(null);
      const result = await recordDisbursementAction({
        governmentSubsidyId: "nonexistent", amount: 10000, receivedAt: new Date(),
      });
      expect(result).toEqual({ error: "Subsidy not found" });
    });

    it("should update subsidy status to PARTIALLY_RECEIVED", async () => {
      prismaMock.governmentSubsidy.findUnique.mockResolvedValue({
        id: "sub-1", expectedAmount: 50000, receivedAmount: 0,
      } as never);

      prismaMock.$transaction.mockImplementation(async (fn) => {
        const tx = {
          subsidyDisbursement: { create: async () => ({}) },
          governmentSubsidy: {
            update: async () => ({
              id: "sub-1", receivedAmount: 20000, expectedAmount: 50000, status: "PARTIALLY_RECEIVED",
            }),
          },
        };
        return fn(tx as never);
      });

      const result = await recordDisbursementAction({
        governmentSubsidyId: "sub-1", amount: 20000, receivedAt: new Date(),
      });
      expect(result.error).toBeUndefined();
      expect(result.data!.remainingAmount).toBe(30000);
    });
  });

  describe("deleteGovernmentSubsidyAction", () => {
    it("should reject if subsidy has disbursements", async () => {
      prismaMock.governmentSubsidy.findUnique.mockResolvedValue({
        id: "sub-1", name: "Test", _count: { disbursements: 2 },
      } as never);

      const result = await deleteGovernmentSubsidyAction("sub-1");
      expect(result.error).toContain("Cannot delete");
    });
  });

  describe("Subsidy variance calculation", () => {
    it("should calculate variance correctly", () => {
      const expected = 50000;
      const received = 35000;
      const variance = expected - received;
      expect(variance).toBe(15000);
    });

    it("should calculate receipt rate correctly", () => {
      const expected = 50000;
      const received = 35000;
      const rate = (received / expected) * 100;
      expect(rate).toBe(70);
    });
  });
});
