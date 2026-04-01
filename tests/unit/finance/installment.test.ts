import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createInstallmentPlanAction,
  applyInstallmentPlanToBillAction,
  deleteInstallmentPlanAction,
} from "@/modules/finance/actions/installment.action";

describe("Installment Actions", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  describe("createInstallmentPlanAction", () => {
    const validInput = {
      name: "Three-Part Plan",
      numberOfInstallments: 3,
      schedules: [
        { installmentNumber: 1, percentageOfTotal: 40, dueDaysFromStart: 0, label: "1st" },
        { installmentNumber: 2, percentageOfTotal: 30, dueDaysFromStart: 30, label: "2nd" },
        { installmentNumber: 3, percentageOfTotal: 30, dueDaysFromStart: 60, label: "3rd" },
      ],
    };

    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await createInstallmentPlanAction(validInput);
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject if percentages don't sum to 100", async () => {
      const result = await createInstallmentPlanAction({
        ...validInput,
        schedules: [
          { installmentNumber: 1, percentageOfTotal: 40, dueDaysFromStart: 0 },
          { installmentNumber: 2, percentageOfTotal: 30, dueDaysFromStart: 30 },
          { installmentNumber: 3, percentageOfTotal: 20, dueDaysFromStart: 60 }, // total = 90, not 100
        ],
      });
      expect(result.error).toBe("Invalid input");
    });

    it("should reject less than 2 installments", async () => {
      const result = await createInstallmentPlanAction({
        ...validInput,
        numberOfInstallments: 1,
        schedules: [{ installmentNumber: 1, percentageOfTotal: 100, dueDaysFromStart: 0 }],
      });
      expect(result.error).toBe("Invalid input");
    });

    it("should create plan with valid data", async () => {
      const mockPlan = { id: "plan-1", name: validInput.name };
      prismaMock.$transaction.mockImplementation(async (fn) => {
        const tx = {
          installmentPlan: { create: async () => mockPlan },
          installmentSchedule: { createMany: async () => ({ count: 3 }) },
        };
        return fn(tx as never);
      });

      const result = await createInstallmentPlanAction(validInput);
      expect(result.error).toBeUndefined();
    });
  });

  describe("applyInstallmentPlanToBillAction", () => {
    const validInput = {
      studentBillId: "bill-1",
      installmentPlanId: "plan-1",
      termStartDate: new Date("2026-01-15"),
    };

    it("should reject if bill not found", async () => {
      prismaMock.studentBill.findUnique.mockResolvedValue(null);
      prismaMock.installmentPlan.findUnique.mockResolvedValue({ id: "plan-1", isActive: true, schedules: [] } as never);

      const result = await applyInstallmentPlanToBillAction(validInput);
      expect(result).toEqual({ error: "Student bill not found" });
    });

    it("should reject if plan is inactive", async () => {
      prismaMock.studentBill.findUnique.mockResolvedValue({ id: "bill-1", status: "UNPAID", balanceAmount: 1500 } as never);
      prismaMock.installmentPlan.findUnique.mockResolvedValue({ id: "plan-1", isActive: false, schedules: [] } as never);

      const result = await applyInstallmentPlanToBillAction(validInput);
      expect(result).toEqual({ error: "Installment plan is not active" });
    });

    it("should reject if bill already has installments", async () => {
      prismaMock.studentBill.findUnique.mockResolvedValue({ id: "bill-1", status: "UNPAID", balanceAmount: 1500 } as never);
      prismaMock.installmentPlan.findUnique.mockResolvedValue({
        id: "plan-1", isActive: true,
        schedules: [{ installmentNumber: 1, percentageOfTotal: 50, dueDaysFromStart: 0 }],
      } as never);
      prismaMock.studentInstallment.findFirst.mockResolvedValue({ id: "existing" } as never);

      const result = await applyInstallmentPlanToBillAction(validInput);
      expect(result.error).toContain("already been created");
    });

    it("should reject if bill is already paid", async () => {
      prismaMock.studentBill.findUnique.mockResolvedValue({ id: "bill-1", status: "PAID", balanceAmount: 0 } as never);
      prismaMock.installmentPlan.findUnique.mockResolvedValue({ id: "plan-1", isActive: true, schedules: [] } as never);

      const result = await applyInstallmentPlanToBillAction(validInput);
      expect(result).toEqual({ error: "Bill is already fully paid" });
    });
  });

  describe("deleteInstallmentPlanAction", () => {
    it("should reject if plan has students assigned", async () => {
      prismaMock.installmentPlan.findUnique.mockResolvedValue({
        id: "plan-1", name: "Test", _count: { studentInstallments: 5 },
      } as never);

      const result = await deleteInstallmentPlanAction("plan-1");
      expect(result.error).toContain("Cannot delete");
    });

    it("should delete plan with no students", async () => {
      prismaMock.installmentPlan.findUnique.mockResolvedValue({
        id: "plan-1", name: "Test", _count: { studentInstallments: 0 },
      } as never);
      prismaMock.installmentPlan.delete.mockResolvedValue({} as never);

      const result = await deleteInstallmentPlanAction("plan-1");
      expect(result.data).toEqual({ success: true });
    });
  });

  describe("Installment percentage calculation", () => {
    it("should correctly split amounts for 3-part plan", () => {
      const totalAmount = 1500;
      const schedules = [
        { percentageOfTotal: 40, dueDaysFromStart: 0 },
        { percentageOfTotal: 30, dueDaysFromStart: 30 },
        { percentageOfTotal: 30, dueDaysFromStart: 60 },
      ];

      const amounts = schedules.map((s) =>
        Math.round((totalAmount * s.percentageOfTotal) / 100 * 100) / 100
      );

      expect(amounts).toEqual([600, 450, 450]);
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(1500);
    });

    it("should handle uneven splits with rounding", () => {
      const totalAmount = 1000;
      const schedules = [
        { percentageOfTotal: 33.33 },
        { percentageOfTotal: 33.33 },
        { percentageOfTotal: 33.34 },
      ];

      const amounts = schedules.map((s) =>
        Math.round((totalAmount * s.percentageOfTotal) / 100 * 100) / 100
      );

      const total = amounts.reduce((a, b) => a + b, 0);
      expect(Math.abs(total - 1000)).toBeLessThan(0.01);
    });
  });
});
