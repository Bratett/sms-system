import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient, type BalanceSide } from "@prisma/client";
import {
  postJournalTransaction,
  reverseJournalTransaction,
  recomputeAccountBalances,
  findAccountByCode,
} from "@/modules/accounting/lib/ledger";
import { ACCOUNTS } from "@/modules/accounting/lib/account-codes";

/**
 * Live-DB integration test for the accounting ledger. Runs against the local
 * Postgres configured via DATABASE_URL. Assumes the database has been seeded
 * (`npx tsx prisma/seed/index.ts`) so the Ghana public-sector COA is in place.
 *
 * Each test creates its own isolated journal transactions with unique
 * reference ids and cleans up in afterAll.
 */

const SCHOOL_ID = "default-school";

const db = new PrismaClient();
const createdTxnIds: string[] = [];

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v && "toNumber" in v) return (v as { toNumber: () => number }).toNumber();
  return Number(v);
}

async function balanceOf(code: string): Promise<number> {
  const acc = await db.account.findFirst({ where: { schoolId: SCHOOL_ID, code } });
  return acc ? toNum(acc.currentBalance) : 0;
}

describe("ledger integration — bill → payment → reversal → impairment", () => {
  beforeAll(async () => {
    const school = await db.school.findUnique({ where: { id: SCHOOL_ID } });
    if (!school) {
      throw new Error(`Test requires seeded database with school id "${SCHOOL_ID}". Run: npx tsx prisma/seed/index.ts`);
    }
  });

  afterAll(async () => {
    // Clean up test journal transactions (entries cascade via FK)
    if (createdTxnIds.length > 0) {
      await db.journalTransaction.deleteMany({ where: { id: { in: createdTxnIds } } });
    }
    await recomputeAccountBalances(db, SCHOOL_ID).catch(() => {});
    await db.$disconnect();
  });

  beforeEach(async () => {
    // Baseline balances are captured inside each test so we don't depend on any
    // prior test state — tests assert DELTAS, not absolutes.
  });

  it("posts balanced manual journal and updates both sides correctly", async () => {
    const cashOpen = await balanceOf(ACCOUNTS.BANK_GCB);
    const revenueOpen = await balanceOf(ACCOUNTS.OTHER_INCOME);

    const result = await db.$transaction(async (tx) => {
      const bank = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.BANK_GCB);
      const income = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.OTHER_INCOME);
      expect(bank).not.toBeNull();
      expect(income).not.toBeNull();

      return postJournalTransaction(tx, {
        schoolId: SCHOOL_ID,
        date: new Date("2026-06-15"),
        description: "[integration-test] manual journal",
        referenceType: "IntegrationTest",
        createdBy: "test-user",
        lines: [
          { accountId: bank!.id, side: "DEBIT" as BalanceSide, amount: 250 },
          { accountId: income!.id, side: "CREDIT" as BalanceSide, amount: 250 },
        ],
      });
    });
    createdTxnIds.push(result.journalTransactionId);

    expect(await balanceOf(ACCOUNTS.BANK_GCB)).toBeCloseTo(cashOpen + 250, 2);
    expect(await balanceOf(ACCOUNTS.OTHER_INCOME)).toBeCloseTo(revenueOpen + 250, 2);
  });

  it("rejects unbalanced journals before any DB writes", async () => {
    const before = await db.journalTransaction.count({ where: { schoolId: SCHOOL_ID } });
    await expect(
      db.$transaction(async (tx) => {
        const bank = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.BANK_GCB);
        const income = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.OTHER_INCOME);
        return postJournalTransaction(tx, {
          schoolId: SCHOOL_ID,
          date: new Date(),
          description: "[integration-test] unbalanced",
          createdBy: "test-user",
          lines: [
            { accountId: bank!.id, side: "DEBIT", amount: 100 },
            { accountId: income!.id, side: "CREDIT", amount: 99 },
          ],
        });
      }),
    ).rejects.toThrow(/not balanced/i);
    const after = await db.journalTransaction.count({ where: { schoolId: SCHOOL_ID } });
    expect(after).toBe(before);
  });

  it("bill → partial payment → reversal: AR + Cash balances swing correctly", async () => {
    const arOpen = await balanceOf(ACCOUNTS.FEES_RECEIVABLE);
    const revOpen = await balanceOf(ACCOUNTS.FEE_REVENUE_TUITION);
    const cashOpen = await balanceOf(ACCOUNTS.CASH_ON_HAND);

    // Accrual: Dr AR 2,000 / Cr Fee Revenue 2,000
    const billTxn = await db.$transaction(async (tx) => {
      const ar = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.FEES_RECEIVABLE);
      const rev = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.FEE_REVENUE_TUITION);
      return postJournalTransaction(tx, {
        schoolId: SCHOOL_ID,
        date: new Date("2026-01-10"),
        description: "[integration-test] bill accrual",
        referenceType: "IntegrationTest",
        createdBy: "test-user",
        lines: [
          { accountId: ar!.id, side: "DEBIT", amount: 2000 },
          { accountId: rev!.id, side: "CREDIT", amount: 2000 },
        ],
      });
    });
    createdTxnIds.push(billTxn.journalTransactionId);

    expect(await balanceOf(ACCOUNTS.FEES_RECEIVABLE)).toBeCloseTo(arOpen + 2000, 2);
    expect(await balanceOf(ACCOUNTS.FEE_REVENUE_TUITION)).toBeCloseTo(revOpen + 2000, 2);

    // Partial payment: Dr Cash 800 / Cr AR 800
    const payTxn = await db.$transaction(async (tx) => {
      const cash = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.CASH_ON_HAND);
      const ar = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.FEES_RECEIVABLE);
      return postJournalTransaction(tx, {
        schoolId: SCHOOL_ID,
        date: new Date("2026-02-01"),
        description: "[integration-test] partial payment",
        referenceType: "IntegrationTest",
        createdBy: "test-user",
        lines: [
          { accountId: cash!.id, side: "DEBIT", amount: 800 },
          { accountId: ar!.id, side: "CREDIT", amount: 800 },
        ],
      });
    });
    createdTxnIds.push(payTxn.journalTransactionId);

    expect(await balanceOf(ACCOUNTS.CASH_ON_HAND)).toBeCloseTo(cashOpen + 800, 2);
    expect(await balanceOf(ACCOUNTS.FEES_RECEIVABLE)).toBeCloseTo(arOpen + 1200, 2);

    // Reverse the payment
    const reversal = await db.$transaction(async (tx) =>
      reverseJournalTransaction(tx, payTxn.journalTransactionId, {
        schoolId: SCHOOL_ID,
        reversedBy: "test-user",
        description: "[integration-test] reverse payment",
      }),
    );
    createdTxnIds.push(reversal.journalTransactionId);

    expect(await balanceOf(ACCOUNTS.CASH_ON_HAND)).toBeCloseTo(cashOpen, 2);
    expect(await balanceOf(ACCOUNTS.FEES_RECEIVABLE)).toBeCloseTo(arOpen + 2000, 2);
    expect(await balanceOf(ACCOUNTS.FEE_REVENUE_TUITION)).toBeCloseTo(revOpen + 2000, 2);
  });

  it("compound payroll journal balances and updates all 5 accounts", async () => {
    const salOpen = await balanceOf(ACCOUNTS.EXPENSE_SALARIES);
    const ssnitExpOpen = await balanceOf(ACCOUNTS.EXPENSE_SSNIT_EMPLOYER);
    const bankOpen = await balanceOf(ACCOUNTS.BANK_GCB);
    const payeOpen = await balanceOf(ACCOUNTS.PAYE_PAYABLE);
    const ssnitPayOpen = await balanceOf(ACCOUNTS.SSNIT_PAYABLE);

    const payrollTxn = await db.$transaction(async (tx) => {
      const sal = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.EXPENSE_SALARIES);
      const ssnitExp = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.EXPENSE_SSNIT_EMPLOYER);
      const bank = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.BANK_GCB);
      const paye = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.PAYE_PAYABLE);
      const ssnitPay = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.SSNIT_PAYABLE);

      return postJournalTransaction(tx, {
        schoolId: SCHOOL_ID,
        date: new Date("2026-03-31"),
        description: "[integration-test] payroll March 2026",
        referenceType: "IntegrationTest",
        createdBy: "test-user",
        lines: [
          { accountId: sal!.id, side: "DEBIT", amount: 10_000 },
          { accountId: ssnitExp!.id, side: "DEBIT", amount: 750 },
          { accountId: bank!.id, side: "CREDIT", amount: 9_000 },
          { accountId: paye!.id, side: "CREDIT", amount: 1_000 },
          { accountId: ssnitPay!.id, side: "CREDIT", amount: 750 },
        ],
      });
    });
    createdTxnIds.push(payrollTxn.journalTransactionId);

    expect(await balanceOf(ACCOUNTS.EXPENSE_SALARIES)).toBeCloseTo(salOpen + 10_000, 2);
    expect(await balanceOf(ACCOUNTS.EXPENSE_SSNIT_EMPLOYER)).toBeCloseTo(ssnitExpOpen + 750, 2);
    expect(await balanceOf(ACCOUNTS.BANK_GCB)).toBeCloseTo(bankOpen - 9_000, 2);
    expect(await balanceOf(ACCOUNTS.PAYE_PAYABLE)).toBeCloseTo(payeOpen + 1_000, 2);
    expect(await balanceOf(ACCOUNTS.SSNIT_PAYABLE)).toBeCloseTo(ssnitPayOpen + 750, 2);
  });

  it("recomputeAccountBalances is a no-op when balances are already consistent", async () => {
    const diffs = await db.$transaction(async (tx) => recomputeAccountBalances(tx, SCHOOL_ID));
    expect(diffs).toEqual([]);
  });

  it("trial balance ties out: Σdebits == Σcredits", async () => {
    // Query the ledger directly to prove the fundamental double-entry invariant.
    // (The server action wraps this in auth; tests assert on the data itself.)
    const entries = await db.journalEntry.findMany({
      where: { schoolId: SCHOOL_ID, journalTransaction: { status: { in: ["POSTED", "REVERSED"] } } },
      select: { side: true, amount: true },
    });
    const debits = entries.filter((e) => e.side === "DEBIT").reduce((s, e) => s + toNum(e.amount), 0);
    const credits = entries.filter((e) => e.side === "CREDIT").reduce((s, e) => s + toNum(e.amount), 0);
    expect(Math.abs(debits - credits)).toBeLessThan(0.01);
  });
});
