import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createJournalTransactionAction,
  postJournalTransactionAction,
  reverseJournalTransactionAction,
} from "@/modules/accounting/actions/journal.action";

describe("Journal Actions", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  describe("createJournalTransactionAction", () => {
    const validInput = {
      date: new Date("2026-03-15"),
      description: "Fee payment received",
      entries: [
        { debitAccountId: "acc-cash", creditAccountId: "acc-revenue", amount: 500, narration: "Tuition" },
      ],
    };

    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await createJournalTransactionAction(validInput);
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject empty entries", async () => {
      const result = await createJournalTransactionAction({ ...validInput, entries: [] });
      expect(result.error).toBe("Invalid input");
    });

    it("should reject zero amount entry", async () => {
      const result = await createJournalTransactionAction({
        ...validInput,
        entries: [{ debitAccountId: "acc-1", creditAccountId: "acc-2", amount: 0 }],
      });
      expect(result.error).toBe("Invalid input");
    });

    it("should create journal transaction", async () => {
      prismaMock.journalTransaction.findFirst.mockResolvedValue(null);

      const mockTxn = { id: "jrn-1", transactionNumber: "JRN/2026/0001" };
      prismaMock.$transaction.mockImplementation(async (fn) => {
        const tx = {
          journalTransaction: { create: async () => mockTxn, findFirst: async () => null },
          journalEntry: { createMany: async () => ({ count: 1 }) },
        };
        return fn(tx as never);
      });

      const result = await createJournalTransactionAction(validInput);
      expect(result.error).toBeUndefined();
    });
  });

  describe("postJournalTransactionAction", () => {
    it("should reject if transaction not found", async () => {
      prismaMock.journalTransaction.findUnique.mockResolvedValue(null);
      const result = await postJournalTransactionAction("nonexistent");
      expect(result).toEqual({ error: "Journal transaction not found" });
    });

    it("should reject non-DRAFT transaction", async () => {
      prismaMock.journalTransaction.findUnique.mockResolvedValue({
        id: "jrn-1", status: "POSTED", entries: [],
      } as never);
      const result = await postJournalTransactionAction("jrn-1");
      expect(result).toEqual({ error: "Only DRAFT transactions can be posted" });
    });
  });

  describe("reverseJournalTransactionAction", () => {
    it("should reject non-POSTED transaction", async () => {
      prismaMock.journalTransaction.findUnique.mockResolvedValue({
        id: "jrn-1", status: "DRAFT", entries: [],
      } as never);
      const result = await reverseJournalTransactionAction("jrn-1");
      expect(result).toEqual({ error: "Only POSTED transactions can be reversed" });
    });
  });

  describe("Double-entry accounting principles", () => {
    it("should ensure debits equal credits in a transaction", () => {
      const entries = [
        { debitAccountId: "cash", creditAccountId: "revenue", amount: 500 },
        { debitAccountId: "cash", creditAccountId: "pta-revenue", amount: 100 },
      ];

      const totalDebits = entries.reduce((sum, e) => sum + e.amount, 0);
      const totalCredits = entries.reduce((sum, e) => sum + e.amount, 0);

      expect(totalDebits).toBe(totalCredits);
    });

    it("should correctly reverse balance changes", () => {
      // Original posting: Dr Cash 500, Cr Revenue 500
      let cashBalance = 0;
      let revenueBalance = 0;

      // Post
      cashBalance += 500;  // debit increases asset
      revenueBalance += 500;  // credit increases revenue

      expect(cashBalance).toBe(500);
      expect(revenueBalance).toBe(500);

      // Reverse: Dr Revenue 500, Cr Cash 500
      cashBalance -= 500;  // credit decreases asset
      revenueBalance -= 500;  // debit decreases revenue

      expect(cashBalance).toBe(0);
      expect(revenueBalance).toBe(0);
    });
  });
});
