import { describe, it, expect } from "vitest";
import { LedgerError, postJournalTransaction, type LedgerLineInput } from "@/modules/accounting/lib/ledger";
import type { Prisma, BalanceSide } from "@prisma/client";

/**
 * Lightweight in-memory ledger harness. Exercises the real postJournalTransaction
 * helper against a fake transaction client so we can assert on balance updates
 * without touching the database.
 */
function createHarness(accounts: Array<{ id: string; code: string; schoolId: string; normalBalance: BalanceSide; balance?: number }>) {
  const accountMap = new Map(accounts.map((a) => [a.id, { ...a, balance: a.balance ?? 0 }]));
  const journalTransactions: Array<{ id: string; transactionNumber: string; schoolId: string; status: string }> = [];
  const journalEntries: Array<{ journalTransactionId: string; accountId: string; side: BalanceSide; amount: number }> = [];

  let txnCounter = 0;
  const tx = {
    account: {
      findMany: async (args: { where: { id: { in: string[] } } }) =>
        accounts.filter((a) => args.where.id.in.includes(a.id)).map((a) => ({
          id: a.id,
          schoolId: a.schoolId,
          normalBalance: a.normalBalance,
          code: a.code,
        })),
      update: async (args: { where: { id: string }; data: { currentBalance: { increment: number } } }) => {
        const acc = accountMap.get(args.where.id)!;
        acc.balance += args.data.currentBalance.increment;
        return { id: acc.id, currentBalance: acc.balance };
      },
    },
    fiscalPeriod: {
      findFirst: async () => null, // no period enforcement in tests
    },
    fund: {
      findFirst: async () => null, // no default fund
    },
    journalTransaction: {
      findFirst: async () => {
        const last = journalTransactions[journalTransactions.length - 1];
        return last ? { transactionNumber: last.transactionNumber } : null;
      },
      create: async (args: { data: { schoolId: string; transactionNumber: string } }) => {
        txnCounter += 1;
        const txn = { id: `t${txnCounter}`, transactionNumber: args.data.transactionNumber, schoolId: args.data.schoolId, status: "POSTED" };
        journalTransactions.push(txn);
        return txn;
      },
    },
    journalEntry: {
      createMany: async (args: { data: Array<{ journalTransactionId: string; accountId: string; side: BalanceSide; amount: number }> }) => {
        journalEntries.push(...args.data);
        return { count: args.data.length };
      },
    },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, accountMap, journalEntries, journalTransactions };
}

const SCHOOL = "school-1";

describe("postJournalTransaction — balance direction per (side, normalBalance)", () => {
  it("DEBIT line on DEBIT-normal account increments balance (asset on deposit)", async () => {
    const h = createHarness([
      { id: "cash", code: "1101", schoolId: SCHOOL, normalBalance: "DEBIT" },
      { id: "rev", code: "4010", schoolId: SCHOOL, normalBalance: "CREDIT" },
    ]);
    await postJournalTransaction(h.tx, {
      schoolId: SCHOOL,
      date: new Date("2026-03-15"),
      description: "Fee payment",
      createdBy: "user-1",
      lines: [
        { accountId: "cash", side: "DEBIT", amount: 500 },
        { accountId: "rev", side: "CREDIT", amount: 500 },
      ],
    });
    expect(h.accountMap.get("cash")!.balance).toBe(500);
    expect(h.accountMap.get("rev")!.balance).toBe(500);
  });

  it("CREDIT line on DEBIT-normal account decrements balance (asset disposed)", async () => {
    const h = createHarness([
      { id: "cash", code: "1101", schoolId: SCHOOL, normalBalance: "DEBIT", balance: 1000 },
      { id: "ap", code: "2101", schoolId: SCHOOL, normalBalance: "CREDIT", balance: 1000 },
    ]);
    await postJournalTransaction(h.tx, {
      schoolId: SCHOOL,
      date: new Date("2026-03-15"),
      description: "Pay supplier",
      createdBy: "user-1",
      lines: [
        { accountId: "ap", side: "DEBIT", amount: 400 },
        { accountId: "cash", side: "CREDIT", amount: 400 },
      ],
    });
    expect(h.accountMap.get("cash")!.balance).toBe(600);
    expect(h.accountMap.get("ap")!.balance).toBe(600);
  });

  it("DEBIT line on CREDIT-normal account decrements balance (revenue close)", async () => {
    const h = createHarness([
      { id: "rev", code: "4010", schoolId: SCHOOL, normalBalance: "CREDIT", balance: 1000 },
      { id: "summary", code: "3900", schoolId: SCHOOL, normalBalance: "CREDIT" },
    ]);
    await postJournalTransaction(h.tx, {
      schoolId: SCHOOL,
      date: new Date("2026-12-31"),
      description: "Year-end close revenue",
      createdBy: "user-1",
      isClosing: true,
      lines: [
        { accountId: "rev", side: "DEBIT", amount: 1000 },
        { accountId: "summary", side: "CREDIT", amount: 1000 },
      ],
    });
    expect(h.accountMap.get("rev")!.balance).toBe(0);
    expect(h.accountMap.get("summary")!.balance).toBe(1000);
  });

  it("CREDIT line on CREDIT-normal account increments balance (revenue recognition)", async () => {
    const h = createHarness([
      { id: "ar", code: "1401", schoolId: SCHOOL, normalBalance: "DEBIT" },
      { id: "rev", code: "4010", schoolId: SCHOOL, normalBalance: "CREDIT" },
    ]);
    await postJournalTransaction(h.tx, {
      schoolId: SCHOOL,
      date: new Date("2026-03-15"),
      description: "Bill student",
      createdBy: "user-1",
      lines: [
        { accountId: "ar", side: "DEBIT", amount: 2000 },
        { accountId: "rev", side: "CREDIT", amount: 2000 },
      ],
    });
    expect(h.accountMap.get("ar")!.balance).toBe(2000);
    expect(h.accountMap.get("rev")!.balance).toBe(2000);
  });
});

describe("postJournalTransaction — invariants", () => {
  it("rejects empty line array", async () => {
    const h = createHarness([]);
    await expect(
      postJournalTransaction(h.tx, {
        schoolId: SCHOOL,
        date: new Date(),
        description: "x",
        createdBy: "u",
        lines: [],
      }),
    ).rejects.toThrow(LedgerError);
  });

  it("rejects unbalanced transactions", async () => {
    const h = createHarness([
      { id: "cash", code: "1101", schoolId: SCHOOL, normalBalance: "DEBIT" },
      { id: "rev", code: "4010", schoolId: SCHOOL, normalBalance: "CREDIT" },
    ]);
    await expect(
      postJournalTransaction(h.tx, {
        schoolId: SCHOOL,
        date: new Date(),
        description: "Unbalanced",
        createdBy: "u",
        lines: [
          { accountId: "cash", side: "DEBIT", amount: 500 },
          { accountId: "rev", side: "CREDIT", amount: 400 },
        ],
      }),
    ).rejects.toMatchObject({ info: { code: "UNBALANCED" } });
  });

  it("rejects negative or zero amounts", async () => {
    const h = createHarness([
      { id: "cash", code: "1101", schoolId: SCHOOL, normalBalance: "DEBIT" },
      { id: "rev", code: "4010", schoolId: SCHOOL, normalBalance: "CREDIT" },
    ]);
    await expect(
      postJournalTransaction(h.tx, {
        schoolId: SCHOOL,
        date: new Date(),
        description: "Zero",
        createdBy: "u",
        lines: [
          { accountId: "cash", side: "DEBIT", amount: 0 },
          { accountId: "rev", side: "CREDIT", amount: 0 },
        ],
      }),
    ).rejects.toMatchObject({ info: { code: "NEGATIVE_AMOUNT" } });
  });

  it("rejects cross-school account usage", async () => {
    const h = createHarness([
      { id: "cash", code: "1101", schoolId: "other-school", normalBalance: "DEBIT" },
      { id: "rev", code: "4010", schoolId: SCHOOL, normalBalance: "CREDIT" },
    ]);
    await expect(
      postJournalTransaction(h.tx, {
        schoolId: SCHOOL,
        date: new Date(),
        description: "Cross-school",
        createdBy: "u",
        lines: [
          { accountId: "cash", side: "DEBIT", amount: 100 },
          { accountId: "rev", side: "CREDIT", amount: 100 },
        ],
      }),
    ).rejects.toMatchObject({ info: { code: "CROSS_SCHOOL" } });
  });

  it("supports compound journals: 1 credit + N debits with correct totals", async () => {
    const h = createHarness([
      { id: "sal", code: "5110", schoolId: SCHOOL, normalBalance: "DEBIT" },
      { id: "ssnit-exp", code: "5130", schoolId: SCHOOL, normalBalance: "DEBIT" },
      { id: "bank", code: "1121", schoolId: SCHOOL, normalBalance: "DEBIT", balance: 10000 },
      { id: "paye", code: "2210", schoolId: SCHOOL, normalBalance: "CREDIT" },
      { id: "ssnit-pay", code: "2220", schoolId: SCHOOL, normalBalance: "CREDIT" },
    ]);
    const lines: LedgerLineInput[] = [
      { accountId: "sal", side: "DEBIT", amount: 2000 },
      { accountId: "ssnit-exp", side: "DEBIT", amount: 150 },
      { accountId: "bank", side: "CREDIT", amount: 1800 },
      { accountId: "paye", side: "CREDIT", amount: 200 },
      { accountId: "ssnit-pay", side: "CREDIT", amount: 150 },
    ];
    await postJournalTransaction(h.tx, {
      schoolId: SCHOOL,
      date: new Date("2026-03-31"),
      description: "Payroll March 2026",
      createdBy: "u",
      lines,
    });
    expect(h.accountMap.get("sal")!.balance).toBe(2000);
    expect(h.accountMap.get("ssnit-exp")!.balance).toBe(150);
    expect(h.accountMap.get("bank")!.balance).toBe(8200); // 10000 - 1800
    expect(h.accountMap.get("paye")!.balance).toBe(200);
    expect(h.accountMap.get("ssnit-pay")!.balance).toBe(150);
  });
});

describe("end-to-end: bill → payment → reversal maintains balance integrity", () => {
  it("bill generates AR+Revenue, payment clears AR, reversal restores AR", async () => {
    const h = createHarness([
      { id: "ar", code: "1401", schoolId: SCHOOL, normalBalance: "DEBIT" },
      { id: "rev", code: "4010", schoolId: SCHOOL, normalBalance: "CREDIT" },
      { id: "bank", code: "1121", schoolId: SCHOOL, normalBalance: "DEBIT" },
    ]);

    // Bill: Dr AR 2000 / Cr Revenue 2000
    await postJournalTransaction(h.tx, {
      schoolId: SCHOOL, date: new Date(), description: "Bill", createdBy: "u",
      lines: [
        { accountId: "ar", side: "DEBIT", amount: 2000 },
        { accountId: "rev", side: "CREDIT", amount: 2000 },
      ],
    });
    expect(h.accountMap.get("ar")!.balance).toBe(2000);
    expect(h.accountMap.get("rev")!.balance).toBe(2000);

    // Partial payment 800: Dr Bank / Cr AR
    await postJournalTransaction(h.tx, {
      schoolId: SCHOOL, date: new Date(), description: "Payment", createdBy: "u",
      lines: [
        { accountId: "bank", side: "DEBIT", amount: 800 },
        { accountId: "ar", side: "CREDIT", amount: 800 },
      ],
    });
    expect(h.accountMap.get("ar")!.balance).toBe(1200);
    expect(h.accountMap.get("bank")!.balance).toBe(800);

    // Reverse the payment: Cr Bank / Dr AR  (swapped sides)
    await postJournalTransaction(h.tx, {
      schoolId: SCHOOL, date: new Date(), description: "Payment reversed", createdBy: "u",
      lines: [
        { accountId: "ar", side: "DEBIT", amount: 800 },
        { accountId: "bank", side: "CREDIT", amount: 800 },
      ],
    });
    expect(h.accountMap.get("ar")!.balance).toBe(2000);
    expect(h.accountMap.get("bank")!.balance).toBe(0);
    expect(h.accountMap.get("rev")!.balance).toBe(2000);
  });
});
