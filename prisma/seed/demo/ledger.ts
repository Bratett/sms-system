/**
 * IPSAS ledger backfill for the demo dataset.
 *
 * The core demo seed (prisma/seed/demo/index.ts) writes StudentBill, Payment,
 * Expense, etc. rows directly — it predates the IPSAS accrual upgrade and so
 * never posts journal entries. This module walks those operational rows and
 * synthesises balanced journal entries so the general ledger, trial balance,
 * and every IPSAS report have something to display.
 *
 * It ALSO seeds IPSAS-specific demo data (fiscal periods, a budget with lines,
 * approved commitments, a government subsidy disbursement) so the new UI
 * pages have content.
 *
 * Idempotent: bills/payments that already have a `journalTransactionId` are
 * skipped. Safe to rerun.
 *
 * Invoked automatically at the end of `npm run db:seed:demo`.
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import {
  postJournalTransaction,
  findAccountByCode,
  recomputeAccountBalances,
} from "../../../src/modules/accounting/lib/ledger";
import {
  ACCOUNTS,
  feeRevenueAccountCode,
  accountCodeForPaymentMethod,
} from "../../../src/modules/accounting/lib/account-codes";

const SCHOOL_ID = "default-school";
const SEED_USER = "seed";

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v && "toNumber" in v) return (v as { toNumber: () => number }).toNumber();
  return Number(v);
}
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function seedDemoLedger(db: PrismaClient) {
  console.log("▶ IPSAS ledger backfill + demo\n");

  await seedFiscalPeriods(db);
  console.log("  ✓ fiscal periods");

  await backfillBillAccruals(db);
  await backfillPayments(db);

  await seedDemoBudget(db);
  console.log("  ✓ budget + commitments");

  await seedDemoSubsidy(db);
  console.log("  ✓ government subsidy + disbursement");

  await seedDemoExpenses(db);
  console.log("  ✓ operating expenses (Dr Expense / Cr AP → Cr Bank)");

  const diffs = await db.$transaction((tx) => recomputeAccountBalances(tx, SCHOOL_ID));
  console.log(`  ✓ recompute drift: ${diffs.length} accounts corrected`);

  const summary = await summariseLedger(db);
  console.log(
    `\n  ledger: ${summary.txnCount} txns, ${summary.entryCount} lines, ` +
      `Σdebits=GHS ${summary.totalDebits.toFixed(2)}, Σcredits=GHS ${summary.totalCredits.toFixed(2)}` +
      ` (${summary.balanced ? "balanced ✓" : "OUT OF BALANCE ✗"})\n`,
  );
}

/* ─── Fiscal periods ────────────────────────────────────────────── */

async function seedFiscalPeriods(db: PrismaClient) {
  const year = await db.fiscalPeriod.upsert({
    where: { schoolId_name: { schoolId: SCHOOL_ID, name: "FY 2025/2026" } },
    update: {},
    create: {
      schoolId: SCHOOL_ID,
      name: "FY 2025/2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-08-31"),
      isFiscalYear: true,
    },
  });

  for (const [name, start, end] of [
    ["FY 2025/2026 Q1", "2025-09-01", "2025-12-31"],
    ["FY 2025/2026 Q2", "2026-01-01", "2026-03-31"],
    ["FY 2025/2026 Q3", "2026-04-01", "2026-08-31"],
  ] as const) {
    await db.fiscalPeriod.upsert({
      where: { schoolId_name: { schoolId: SCHOOL_ID, name } },
      update: {},
      create: {
        schoolId: SCHOOL_ID,
        name,
        startDate: new Date(start),
        endDate: new Date(end),
        isFiscalYear: false,
        fiscalYearId: year.id,
      },
    });
  }
}

/* ─── Bill accrual backfill (Dr AR / Cr Fee Revenue) ────────────── */

async function backfillBillAccruals(db: PrismaClient) {
  const bills = await db.studentBill.findMany({
    where: { schoolId: SCHOOL_ID, accrualJournalId: null, totalAmount: { gt: 0 } },
    include: { billItems: { include: { feeItem: true } } },
  });
  if (bills.length === 0) {
    console.log("  · bill accrual: already backfilled");
    return;
  }
  console.log(`  · backfilling ${bills.length} bill accruals...`);

  let posted = 0;
  for (const bill of bills) {
    try {
      await db.$transaction(async (tx) => {
        const ar = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.FEES_RECEIVABLE);
        if (!ar) return;

        // Spread the bill total across revenue accounts per fee item.
        const grossTotal = bill.billItems.reduce((s, i) => s + toNum(i.amount), 0);
        const ratio = grossTotal > 0 ? toNum(bill.totalAmount) / grossTotal : 0;
        const revLines: Array<{ accountId: string; side: "CREDIT"; amount: number; narration: string }> = [];
        let allocated = 0;
        for (let i = 0; i < bill.billItems.length; i++) {
          const item = bill.billItems[i];
          const revAcc = await findAccountByCode(tx, SCHOOL_ID, feeRevenueAccountCode(item.feeItem.name));
          if (!revAcc) continue;
          const isLast = i === bill.billItems.length - 1;
          const amount = isLast
            ? round2(toNum(bill.totalAmount) - allocated)
            : round2(toNum(item.amount) * ratio);
          if (amount <= 0) continue;
          allocated = round2(allocated + amount);
          revLines.push({ accountId: revAcc.id, side: "CREDIT", amount, narration: item.feeItem.name });
        }
        if (revLines.length === 0) return;

        const result = await postJournalTransaction(tx, {
          schoolId: SCHOOL_ID,
          date: bill.generatedAt,
          description: `Fees billed — ${bill.studentId.slice(-8)}`,
          referenceType: "Billing",
          referenceId: bill.id,
          createdBy: SEED_USER,
          isAutoGenerated: true,
          lines: [
            { accountId: ar.id, side: "DEBIT", amount: toNum(bill.totalAmount), narration: `Bill ${bill.id.slice(-8)}` },
            ...revLines,
          ],
        });
        await tx.studentBill.update({ where: { id: bill.id }, data: { accrualJournalId: result.journalTransactionId } });
      });
      posted += 1;
    } catch (err) {
      // Skip bills that fail (e.g., missing revenue account) — operational data stays intact.
      console.warn(`    skip bill ${bill.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`    → ${posted}/${bills.length} bill accrual journals posted`);
}

/* ─── Payment backfill (Dr Cash/Bank/MoMo / Cr AR) ──────────────── */

async function backfillPayments(db: PrismaClient) {
  const payments = await db.payment.findMany({
    where: { schoolId: SCHOOL_ID, journalTransactionId: null, status: "CONFIRMED" },
  });
  if (payments.length === 0) {
    console.log("  · payment backfill: already done");
    return;
  }
  console.log(`  · backfilling ${payments.length} payment journals...`);

  let posted = 0;
  for (const p of payments) {
    try {
      await db.$transaction(async (tx) => {
        const cashCode = accountCodeForPaymentMethod(p.paymentMethod);
        const cash = await findAccountByCode(tx, SCHOOL_ID, cashCode);
        const ar = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.FEES_RECEIVABLE);
        if (!cash || !ar) return;

        const result = await postJournalTransaction(tx, {
          schoolId: SCHOOL_ID,
          date: p.receivedAt,
          description: `Fee payment — ${p.paymentMethod.replace("_", " ")}`,
          referenceType: "Payment",
          referenceId: p.id,
          createdBy: SEED_USER,
          isAutoGenerated: true,
          lines: [
            { accountId: cash.id, side: "DEBIT", amount: toNum(p.amount), narration: p.referenceNumber ?? `Payment ${p.id.slice(-8)}` },
            { accountId: ar.id, side: "CREDIT", amount: toNum(p.amount), narration: `Settle bill ${p.studentBillId.slice(-8)}` },
          ],
        });
        await tx.payment.update({ where: { id: p.id }, data: { journalTransactionId: result.journalTransactionId } });
      });
      posted += 1;
    } catch (err) {
      console.warn(`    skip payment ${p.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`    → ${posted}/${payments.length} payment journals posted`);
}

/* ─── Budget + commitments (IPSAS 24) ───────────────────────────── */

async function seedDemoBudget(db: PrismaClient) {
  const academicYear = await db.academicYear.findFirst({ where: { schoolId: SCHOOL_ID }, orderBy: { startDate: "desc" } });
  if (!academicYear) return;

  // Ensure the expense categories we need exist — bootstrap inline rather
  // than requiring `prisma/seed-finance.ts` to have been run beforehand.
  async function ensureCategory(name: string, code: string) {
    const existing = await db.expenseCategory.findFirst({ where: { schoolId: SCHOOL_ID, name } });
    if (existing) return existing;
    return db.expenseCategory.create({ data: { schoolId: SCHOOL_ID, name, code } });
  }
  const utilitiesCat = await ensureCategory("Utilities", "UTL");
  const maintenanceCat = await ensureCategory("Maintenance & Repairs", "MNT");
  const feedingCat = await ensureCategory("Feeding & Catering", "FED");

  const budget = await db.budget.upsert({
    where: { id: "demo-budget-fy26" },
    update: {},
    create: {
      id: "demo-budget-fy26",
      schoolId: SCHOOL_ID,
      name: "FY 2025/2026 Operating Budget",
      academicYearId: academicYear.id,
      totalAmount: 350_000,
      originalAmount: 300_000,
      status: "ACTIVE",
      createdBy: SEED_USER,
      approvedBy: SEED_USER,
      approvedAt: new Date("2025-08-20"),
    },
  });

  const lines: Array<[string, string, number, number]> = [
    ["demo-line-util", utilitiesCat.id, 60_000, 50_000],
    ["demo-line-maint", maintenanceCat.id, 90_000, 80_000],
    ["demo-line-feed", feedingCat.id, 200_000, 170_000],
  ];
  for (const [id, categoryId, allocated, original] of lines) {
    await db.budgetLine.upsert({
      where: { id },
      update: {},
      create: {
        id,
        schoolId: SCHOOL_ID,
        budgetId: budget.id,
        expenseCategoryId: categoryId,
        allocatedAmount: allocated,
        originalAmount: original,
      },
    });
  }

  // Approved commitment (encumbers part of the utilities budget)
  const existingCommitment = await db.budgetCommitment.findFirst({
    where: { schoolId: SCHOOL_ID, commitmentNumber: "COM/2025/0001" },
  });
  if (!existingCommitment) {
    const commitment = await db.budgetCommitment.create({
      data: {
        schoolId: SCHOOL_ID,
        commitmentNumber: "COM/2025/0001",
        vendorName: "ECG (Electricity Company of Ghana)",
        vendorContact: "accounts@ecg.com.gh",
        budgetLineId: "demo-line-util",
        description: "Annual electricity supply — termly billing",
        totalAmount: 18_000,
        currency: "GHS",
        commitmentDate: new Date("2025-09-10"),
        expectedDate: new Date("2026-08-31"),
        status: "APPROVED",
        approvedBy: SEED_USER,
        approvedAt: new Date("2025-09-10"),
        createdBy: SEED_USER,
        lines: {
          create: [{
            schoolId: SCHOOL_ID,
            description: "Electricity — FY 2025/2026",
            quantity: 1,
            unitPrice: 18_000,
            amount: 18_000,
            expenseCategoryId: utilitiesCat.id,
          }],
        },
      },
    });

    // Post the encumbrance journal (Dr 9100 / Cr 9200) and update committedAmount
    await db.$transaction(async (tx) => {
      const enc = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.ENCUMBRANCES);
      const res = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.RESERVE_FOR_ENCUMBRANCES);
      if (!enc || !res) return;
      const posted = await postJournalTransaction(tx, {
        schoolId: SCHOOL_ID,
        date: commitment.commitmentDate,
        description: `Encumbrance — ${commitment.vendorName}`,
        referenceType: "Encumbrance",
        referenceId: commitment.id,
        createdBy: SEED_USER,
        isAutoGenerated: true,
        lines: [
          { accountId: enc.id, side: "DEBIT", amount: 18_000, narration: commitment.commitmentNumber },
          { accountId: res.id, side: "CREDIT", amount: 18_000, narration: commitment.commitmentNumber },
        ],
      });
      await tx.encumbrance.create({
        data: {
          schoolId: SCHOOL_ID,
          budgetCommitmentId: commitment.id,
          budgetLineId: "demo-line-util",
          amount: 18_000,
          journalTransactionId: posted.journalTransactionId,
        },
      });
      await tx.budgetCommitment.update({
        where: { id: commitment.id },
        data: { encumbranceJournalId: posted.journalTransactionId },
      });
      await tx.budgetLine.update({
        where: { id: "demo-line-util" },
        data: { committedAmount: { increment: 18_000 } },
      });
    });
  }
}

/* ─── Government subsidy + disbursement ─────────────────────────── */

async function seedDemoSubsidy(db: PrismaClient) {
  const academicYear = await db.academicYear.findFirst({ where: { schoolId: SCHOOL_ID }, orderBy: { startDate: "desc" } });
  if (!academicYear) return;

  const existing = await db.governmentSubsidy.findFirst({
    where: { schoolId: SCHOOL_ID, name: "Free SHS Capitation 2025/2026" },
  });
  if (existing) return;

  const subsidy = await db.governmentSubsidy.create({
    data: {
      schoolId: SCHOOL_ID,
      name: "Free SHS Capitation 2025/2026",
      subsidyType: "CAPITATION_GRANT",
      academicYearId: academicYear.id,
      expectedAmount: 500_000,
      referenceNumber: "GES/FSHS/2025-26/CAP/001",
      isConditional: false,
    },
  });

  // Record one disbursement of 250,000 GHS (Dr Bank / Cr Grant Revenue)
  await db.$transaction(async (tx) => {
    const disbursement = await tx.subsidyDisbursement.create({
      data: {
        schoolId: SCHOOL_ID,
        governmentSubsidyId: subsidy.id,
        amount: 250_000,
        receivedAt: new Date("2025-10-15"),
        bankReference: "MOF-EFT-20251015-0042",
        recordedBy: SEED_USER,
      },
    });
    await tx.governmentSubsidy.update({
      where: { id: subsidy.id },
      data: { receivedAmount: 250_000, status: "PARTIALLY_RECEIVED", receivedAt: new Date("2025-10-15") },
    });

    const bank = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.BANK_GCB);
    const grantRev = await findAccountByCode(tx, SCHOOL_ID, ACCOUNTS.GRANT_REVENUE_UNCONDITIONAL);
    if (!bank || !grantRev) return;
    const posted = await postJournalTransaction(tx, {
      schoolId: SCHOOL_ID,
      date: new Date("2025-10-15"),
      description: `Government subsidy received — ${subsidy.name}`,
      referenceType: "Subsidy",
      referenceId: disbursement.id,
      createdBy: SEED_USER,
      isAutoGenerated: true,
      lines: [
        { accountId: bank.id, side: "DEBIT", amount: 250_000, narration: "MOF EFT" },
        { accountId: grantRev.id, side: "CREDIT", amount: 250_000, narration: subsidy.name },
      ],
    });
    await tx.subsidyDisbursement.update({ where: { id: disbursement.id }, data: { journalTransactionId: posted.journalTransactionId } });
  });
}

/* ─── Operating expenses (a handful, to give the IS & CF content) ─ */

async function seedDemoExpenses(db: PrismaClient) {
  const rows: Array<[Date, string, number, string, string]> = [
    [new Date("2025-09-28"), "Salaries — September", 45_000, ACCOUNTS.EXPENSE_SALARIES, ACCOUNTS.BANK_GCB],
    [new Date("2025-10-28"), "Salaries — October", 47_000, ACCOUNTS.EXPENSE_SALARIES, ACCOUNTS.BANK_GCB],
    [new Date("2025-11-28"), "Salaries — November", 46_500, ACCOUNTS.EXPENSE_SALARIES, ACCOUNTS.BANK_GCB],
    [new Date("2025-10-05"), "ECG electricity invoice Q1", 6_200, ACCOUNTS.EXPENSE_UTILITIES_ELECTRICITY, ACCOUNTS.BANK_GCB],
    [new Date("2025-11-05"), "ECG electricity invoice Nov", 5_800, ACCOUNTS.EXPENSE_UTILITIES_ELECTRICITY, ACCOUNTS.BANK_GCB],
    [new Date("2025-10-12"), "Feeding supplies — Oct", 22_000, ACCOUNTS.EXPENSE_FEEDING, ACCOUNTS.CASH_ON_HAND],
    [new Date("2025-11-12"), "Feeding supplies — Nov", 24_500, ACCOUNTS.EXPENSE_FEEDING, ACCOUNTS.CASH_ON_HAND],
    [new Date("2025-10-20"), "Classroom repairs", 4_500, ACCOUNTS.EXPENSE_REPAIRS, ACCOUNTS.BANK_GCB],
    [new Date("2025-11-03"), "Transport fuel", 3_800, ACCOUNTS.EXPENSE_TRANSPORT, ACCOUNTS.CASH_ON_HAND],
    [new Date("2025-10-30"), "Stationery restock", 2_600, ACCOUNTS.EXPENSE_STATIONERY, ACCOUNTS.BANK_GCB],
  ];

  // Skip if already seeded (detect by looking for a JRN with our reference)
  const existing = await db.journalTransaction.count({
    where: { schoolId: SCHOOL_ID, referenceType: "DemoExpense" },
  });
  if (existing >= rows.length) return;

  for (let i = 0; i < rows.length; i++) {
    const [date, desc, amount, expCode, cashCode] = rows[i];
    // Idempotent: check if a journal with this reference already exists
    const seen = await db.journalTransaction.findFirst({
      where: { schoolId: SCHOOL_ID, referenceType: "DemoExpense", referenceId: `demo-exp-${i}` },
    });
    if (seen) continue;

    await db.$transaction(async (tx) => {
      const exp = await findAccountByCode(tx, SCHOOL_ID, expCode);
      const cash = await findAccountByCode(tx, SCHOOL_ID, cashCode);
      if (!exp || !cash) return;
      await postJournalTransaction(tx, {
        schoolId: SCHOOL_ID,
        date,
        description: desc,
        referenceType: "DemoExpense",
        referenceId: `demo-exp-${i}`,
        createdBy: SEED_USER,
        isAutoGenerated: true,
        lines: [
          { accountId: exp.id, side: "DEBIT", amount, narration: desc },
          { accountId: cash.id, side: "CREDIT", amount, narration: desc },
        ],
      });
    });
  }
}

/* ─── Summary ───────────────────────────────────────────────────── */

async function summariseLedger(db: PrismaClient) {
  const [txnCount, entryCount, sums] = await Promise.all([
    db.journalTransaction.count({ where: { schoolId: SCHOOL_ID, status: { in: ["POSTED", "REVERSED"] } } }),
    db.journalEntry.count({ where: { schoolId: SCHOOL_ID, journalTransaction: { status: { in: ["POSTED", "REVERSED"] } } } }),
    db.journalEntry.groupBy({
      by: ["side"],
      where: { schoolId: SCHOOL_ID, journalTransaction: { status: { in: ["POSTED", "REVERSED"] } } },
      _sum: { amount: true },
    }),
  ]);
  const totalDebits = sums.find((s) => s.side === "DEBIT")?._sum.amount ? toNum(sums.find((s) => s.side === "DEBIT")!._sum.amount) : 0;
  const totalCredits = sums.find((s) => s.side === "CREDIT")?._sum.amount ? toNum(sums.find((s) => s.side === "CREDIT")!._sum.amount) : 0;
  return { txnCount, entryCount, totalDebits, totalCredits, balanced: Math.abs(totalDebits - totalCredits) < 0.01 };
}
