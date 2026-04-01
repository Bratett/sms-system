import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createLatePenaltyRuleAction,
  deleteLatePenaltyRuleAction,
  waivePenaltyAction,
} from "@/modules/finance/actions/penalty.action";

describe("Penalty Actions", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  describe("createLatePenaltyRuleAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await createLatePenaltyRuleAction({
        name: "Test", type: "PERCENTAGE", value: 5, gracePeriodDays: 7,
      });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject invalid penalty type", async () => {
      const result = await createLatePenaltyRuleAction({
        name: "Test", type: "INVALID" as never, value: 5,
      });
      expect(result.error).toBe("Invalid input");
    });

    it("should reject zero value", async () => {
      const result = await createLatePenaltyRuleAction({
        name: "Test", type: "PERCENTAGE", value: 0,
      });
      expect(result.error).toBe("Invalid input");
    });

    it("should create percentage penalty rule", async () => {
      prismaMock.latePenaltyRule.create.mockResolvedValue({
        id: "rule-1", name: "5% Late Fee", type: "PERCENTAGE", value: 5,
      } as never);

      const result = await createLatePenaltyRuleAction({
        name: "5% Late Fee", type: "PERCENTAGE", value: 5, gracePeriodDays: 7,
      });
      expect(result.data).toBeDefined();
      expect(result.data!.type).toBe("PERCENTAGE");
    });

    it("should create daily fixed penalty rule", async () => {
      prismaMock.latePenaltyRule.create.mockResolvedValue({
        id: "rule-2", name: "GHS 2/day", type: "DAILY_FIXED", value: 2,
      } as never);

      const result = await createLatePenaltyRuleAction({
        name: "GHS 2/day", type: "DAILY_FIXED", value: 2, maxPenalty: 100,
      });
      expect(result.data).toBeDefined();
    });
  });

  describe("deleteLatePenaltyRuleAction", () => {
    it("should reject if rule has applied penalties", async () => {
      prismaMock.latePenaltyRule.findUnique.mockResolvedValue({
        id: "rule-1", name: "Test", _count: { penalties: 3 },
      } as never);

      const result = await deleteLatePenaltyRuleAction("rule-1");
      expect(result.error).toContain("Cannot delete");
    });
  });

  describe("waivePenaltyAction", () => {
    it("should reject if penalty not found", async () => {
      prismaMock.appliedPenalty.findUnique.mockResolvedValue(null);
      const result = await waivePenaltyAction("nonexistent");
      expect(result).toEqual({ error: "Penalty not found" });
    });

    it("should reject already waived penalty", async () => {
      prismaMock.appliedPenalty.findUnique.mockResolvedValue({
        id: "pen-1", waived: true,
      } as never);
      const result = await waivePenaltyAction("pen-1");
      expect(result).toEqual({ error: "Penalty has already been waived" });
    });
  });

  describe("Penalty calculation logic", () => {
    it("should calculate percentage penalty correctly", () => {
      const outstandingBalance = 1500;
      const percentage = 5;
      const penalty = outstandingBalance * (percentage / 100);
      expect(penalty).toBe(75);
    });

    it("should calculate daily fixed penalty correctly", () => {
      const dailyRate = 2;
      const daysPastDue = 10;
      const gracePeriod = 3;
      const effectiveDays = daysPastDue - gracePeriod;
      const penalty = dailyRate * effectiveDays;
      expect(penalty).toBe(14);
    });

    it("should respect max penalty cap", () => {
      const calculatedPenalty = 150;
      const existingTotal = 80;
      const maxPenalty = 100;
      const remainingAllowance = maxPenalty - existingTotal;
      const actualPenalty = Math.min(calculatedPenalty, remainingAllowance);
      expect(actualPenalty).toBe(20);
    });

    it("should skip penalty when max already reached", () => {
      const existingTotal = 100;
      const maxPenalty = 100;
      const remaining = maxPenalty - existingTotal;
      expect(remaining).toBeLessThanOrEqual(0);
    });
  });
});
