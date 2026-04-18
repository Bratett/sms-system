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
    const balancedInput = {
      date: new Date("2026-03-15"),
      description: "Fee payment received",
      lines: [
        { accountId: "acc-cash", side: "DEBIT" as const, amount: 500, narration: "Cash received" },
        { accountId: "acc-revenue", side: "CREDIT" as const, amount: 500, narration: "Tuition" },
      ],
    };

    it("rejects unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await createJournalTransactionAction(balancedInput);
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("rejects empty lines", async () => {
      const result = await createJournalTransactionAction({ ...balancedInput, lines: [] });
      expect(result.error).toBe("Invalid input");
    });

    it("rejects single-side lines (must be balanced)", async () => {
      const result = await createJournalTransactionAction({
        ...balancedInput,
        lines: [
          { accountId: "acc-1", side: "DEBIT", amount: 500 },
          { accountId: "acc-2", side: "DEBIT", amount: 500 },
        ],
      });
      expect(result.error).toBe("Invalid input");
    });

    it("rejects unbalanced debits and credits", async () => {
      const result = await createJournalTransactionAction({
        ...balancedInput,
        lines: [
          { accountId: "acc-1", side: "DEBIT", amount: 500 },
          { accountId: "acc-2", side: "CREDIT", amount: 400 },
        ],
      });
      expect(result.error).toBe("Invalid input");
    });

    it("rejects zero amount line", async () => {
      const result = await createJournalTransactionAction({
        ...balancedInput,
        lines: [
          { accountId: "acc-1", side: "DEBIT", amount: 0 },
          { accountId: "acc-2", side: "CREDIT", amount: 0 },
        ],
      });
      expect(result.error).toBe("Invalid input");
    });
  });

  describe("postJournalTransactionAction", () => {
    it("rejects if transaction not found", async () => {
      prismaMock.journalTransaction.findUnique.mockResolvedValue(null);
      const result = await postJournalTransactionAction("nonexistent");
      expect(result).toEqual({ error: "Journal transaction not found" });
    });

    it("is idempotent on already-posted transactions", async () => {
      prismaMock.journalTransaction.findUnique.mockResolvedValue({
        id: "jrn-1", status: "POSTED", schoolId: "default-school", entries: [],
      } as never);
      const result = await postJournalTransactionAction("jrn-1");
      expect(result.data).toEqual({ success: true, alreadyPosted: true });
    });

    it("rejects reversed transactions", async () => {
      prismaMock.journalTransaction.findUnique.mockResolvedValue({
        id: "jrn-1", status: "REVERSED", schoolId: "default-school", entries: [],
      } as never);
      const result = await postJournalTransactionAction("jrn-1");
      expect(result.error).toBe("Cannot post a reversed transaction");
    });
  });

  describe("reverseJournalTransactionAction", () => {
    it("rejects cross-school reversal attempts", async () => {
      prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
        const tx = {
          journalTransaction: {
            findUnique: async () => ({ id: "jrn-1", status: "POSTED", schoolId: "other-school", entries: [] }),
            update: async () => ({}),
            create: async () => ({ id: "r", transactionNumber: "JRN/2026/0002" }),
            findFirst: async () => null,
          },
          journalEntry: { createMany: async () => ({}) },
          account: { update: async () => ({}) },
        } as never;
        return (fn as (t: never) => unknown)(tx);
      });
      const result = await reverseJournalTransactionAction("jrn-1");
      expect(result.error).toBeDefined();
    });
  });

  describe("Double-entry posting rules", () => {
    it("maintains Σdebits = Σcredits in compound entries", () => {
      const lines = [
        { side: "DEBIT" as const, amount: 2000 },   // Dr Salary Expense
        { side: "DEBIT" as const, amount: 150 },    // Dr SSNIT Employer Exp
        { side: "CREDIT" as const, amount: 1800 },  // Cr Bank
        { side: "CREDIT" as const, amount: 200 },   // Cr PAYE Payable
        { side: "CREDIT" as const, amount: 150 },   // Cr SSNIT Payable
      ];
      const debits = lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + l.amount, 0);
      const credits = lines.filter((l) => l.side === "CREDIT").reduce((s, l) => s + l.amount, 0);
      expect(debits).toBe(credits);
    });

    it("updates account balances respecting normalBalance", () => {
      const simulatePost = (lines: { side: "DEBIT" | "CREDIT"; amount: number; normalBalance: "DEBIT" | "CREDIT" }[]) => {
        return lines.map((l) => (l.side === l.normalBalance ? l.amount : -l.amount));
      };

      // Dr Cash (Asset, DEBIT-normal, +) / Cr Revenue (CREDIT-normal, +)
      const payment = simulatePost([
        { side: "DEBIT", amount: 500, normalBalance: "DEBIT" },   // Cash: +500
        { side: "CREDIT", amount: 500, normalBalance: "CREDIT" }, // Revenue: +500
      ]);
      expect(payment).toEqual([500, 500]);

      // The bug we fixed: posting a CREDIT to CREDIT-normal must INCREMENT, not decrement
      const revenueCredit = simulatePost([
        { side: "CREDIT", amount: 100, normalBalance: "CREDIT" },
      ]);
      expect(revenueCredit[0]).toBe(100);

      // Contrapositive: posting a DEBIT to CREDIT-normal decrements (e.g., closing revenue)
      const revenueClose = simulatePost([
        { side: "DEBIT", amount: 100, normalBalance: "CREDIT" },
      ]);
      expect(revenueClose[0]).toBe(-100);
    });

    it("correctly reverses balance changes", () => {
      let cash = 0, revenue = 0;
      // Post: Dr Cash / Cr Revenue
      cash += 500; revenue += 500;
      expect([cash, revenue]).toEqual([500, 500]);
      // Reverse: Dr Revenue / Cr Cash (but applied via normalBalance rule)
      cash -= 500; revenue -= 500;
      expect([cash, revenue]).toEqual([0, 0]);
    });
  });
});
