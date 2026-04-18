import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createExpenseAction,
  approveExpenseAction,
  rejectExpenseAction,
} from "@/modules/accounting/actions/expense.action";

describe("Expense Actions", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  describe("createExpenseAction", () => {
    const validInput = {
      expenseCategoryId: "cat-1",
      description: "Textbook purchase",
      amount: 2500,
      date: new Date("2026-03-10"),
    };

    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await createExpenseAction(validInput);
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject zero amount", async () => {
      const result = await createExpenseAction({ ...validInput, amount: 0 });
      expect(result.error).toBe("Invalid input");
    });

    it("should reject missing description", async () => {
      const result = await createExpenseAction({ ...validInput, description: "" });
      expect(result.error).toBe("Invalid input");
    });

    it("should create expense", async () => {
      prismaMock.expense.create.mockResolvedValue({
        id: "exp-1", description: validInput.description, status: "PENDING",
      } as never);

      const result = await createExpenseAction(validInput);
      expect(result.data).toBeDefined();
    });
  });

  describe("approveExpenseAction", () => {
    it("should reject if expense not found", async () => {
      prismaMock.expense.findUnique.mockResolvedValue(null);
      const result = await approveExpenseAction("nonexistent");
      expect(result).toEqual({ error: "Expense not found" });
    });

    it("should reject non-pending expense", async () => {
      prismaMock.expense.findUnique.mockResolvedValue({ id: "exp-1", schoolId: "default-school", status: "APPROVED" } as never);
      const result = await approveExpenseAction("exp-1");
      expect(result).toEqual({ error: "Only pending expenses can be approved" });
    });

    it("should approve pending expense and post accrual journal", async () => {
      prismaMock.expense.findUnique.mockResolvedValue({
        id: "exp-1", schoolId: "default-school", status: "PENDING", amount: 2500, date: new Date("2026-03-10"), expenseCategoryId: "cat-1", budgetCommitmentId: null, fundId: null, description: "x",
      } as never);
      prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
        const tx = {
          expenseCategory: { findUnique: async () => ({ name: "supplies", accountId: null }) },
          account: { findFirst: async () => null, findMany: async () => [], update: async () => ({}) },
          expense: { update: async () => ({ id: "exp-1", status: "APPROVED" }) },
          budgetLine: { findFirst: async () => null, update: async () => ({}) },
          fiscalPeriod: { findFirst: async () => null },
          fund: { findFirst: async () => null },
          journalTransaction: { findFirst: async () => null, create: async () => ({ id: "j1", transactionNumber: "JRN/2026/0001" }) },
          journalEntry: { createMany: async () => ({}) },
          budgetCommitment: { findUnique: async () => null },
          encumbrance: { update: async () => ({}) },
        } as never;
        return (fn as (t: never) => unknown)(tx);
      });

      const result = await approveExpenseAction("exp-1");
      expect(result.data).toEqual({ success: true });
    });
  });

  describe("rejectExpenseAction", () => {
    it("should reject non-pending expense", async () => {
      prismaMock.expense.findUnique.mockResolvedValue({ id: "exp-1", status: "PAID" } as never);
      const result = await rejectExpenseAction("exp-1");
      expect(result).toEqual({ error: "Only pending expenses can be rejected" });
    });
  });
});
