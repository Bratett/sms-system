-- ─── Accounting IPSAS Upgrade ─────────────────────────────────────
-- Refactors JournalEntry to canonical one-row-per-side model, adds Fund /
-- FiscalPeriod / BudgetCommitment / Encumbrance / ImpairmentRun models, and
-- wires journal-transaction link columns on every operational table that
-- now posts to the ledger.
--
-- Data preservation note: existing JournalEntry rows (old schema: one row
-- with both debitAccountId and creditAccountId) are split into two rows
-- (one DEBIT, one CREDIT) so historical ledgers remain intact.

-- ─── New enums ────────────────────────────────────────────────────
CREATE TYPE "FundType" AS ENUM ('GENERAL', 'RESTRICTED', 'CAPITAL', 'DONOR', 'ENDOWMENT');
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('OPEN', 'SOFT_CLOSED', 'CLOSED');
CREATE TYPE "BudgetCommitmentStatus" AS ENUM ('DRAFT', 'APPROVED', 'PARTIALLY_LIQUIDATED', 'LIQUIDATED', 'CANCELLED');
CREATE TYPE "EncumbranceStatus" AS ENUM ('ACTIVE', 'LIQUIDATED', 'CANCELLED');

-- Enum extensions (committed before use in same transaction)
ALTER TYPE "AccountType" ADD VALUE 'BUDGETARY';
ALTER TYPE "FinancialReportType" ADD VALUE 'STATEMENT_OF_FINANCIAL_POSITION';
ALTER TYPE "FinancialReportType" ADD VALUE 'STATEMENT_OF_FINANCIAL_PERFORMANCE';
ALTER TYPE "FinancialReportType" ADD VALUE 'STATEMENT_OF_CHANGES_IN_NET_ASSETS';
ALTER TYPE "FinancialReportType" ADD VALUE 'STATEMENT_OF_BUDGET_VS_ACTUAL';
ALTER TYPE "FinancialReportType" ADD VALUE 'RECEIVABLES_AGING';
ALTER TYPE "FinancialReportType" ADD VALUE 'FUND_STATEMENT';
ALTER TYPE "FinancialReportType" ADD VALUE 'CASH_FLOW_DIRECT';

-- ─── New core tables ──────────────────────────────────────────────
CREATE TABLE "Fund" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FundType" NOT NULL,
    "parentFundId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Fund_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Fund_schoolId_idx" ON "Fund"("schoolId");
CREATE INDEX "Fund_type_idx" ON "Fund"("type");
CREATE UNIQUE INDEX "Fund_schoolId_code_key" ON "Fund"("schoolId", "code");
ALTER TABLE "Fund" ADD CONSTRAINT "Fund_parentFundId_fkey" FOREIGN KEY ("parentFundId") REFERENCES "Fund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FiscalPeriod" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fiscalYearId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "isFiscalYear" BOOLEAN NOT NULL DEFAULT false,
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "closingNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FiscalPeriod_schoolId_idx" ON "FiscalPeriod"("schoolId");
CREATE INDEX "FiscalPeriod_status_idx" ON "FiscalPeriod"("status");
CREATE INDEX "FiscalPeriod_startDate_endDate_idx" ON "FiscalPeriod"("startDate", "endDate");
CREATE UNIQUE INDEX "FiscalPeriod_schoolId_name_key" ON "FiscalPeriod"("schoolId", "name");
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BudgetCommitment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "commitmentNumber" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorContact" TEXT,
    "budgetLineId" TEXT,
    "fundId" TEXT,
    "description" TEXT,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "liquidatedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "commitmentDate" TIMESTAMP(3) NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "status" "BudgetCommitmentStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "encumbranceJournalId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BudgetCommitment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BudgetCommitment_schoolId_idx" ON "BudgetCommitment"("schoolId");
CREATE INDEX "BudgetCommitment_status_idx" ON "BudgetCommitment"("status");
CREATE INDEX "BudgetCommitment_budgetLineId_idx" ON "BudgetCommitment"("budgetLineId");
CREATE UNIQUE INDEX "BudgetCommitment_schoolId_commitmentNumber_key" ON "BudgetCommitment"("schoolId", "commitmentNumber");

CREATE TABLE "BudgetCommitmentLine" (
    "id" TEXT NOT NULL,
    "budgetCommitmentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "expenseCategoryId" TEXT,
    CONSTRAINT "BudgetCommitmentLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BudgetCommitmentLine_budgetCommitmentId_idx" ON "BudgetCommitmentLine"("budgetCommitmentId");
CREATE INDEX "BudgetCommitmentLine_schoolId_idx" ON "BudgetCommitmentLine"("schoolId");
ALTER TABLE "BudgetCommitment" ADD CONSTRAINT "BudgetCommitment_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BudgetCommitmentLine" ADD CONSTRAINT "BudgetCommitmentLine_budgetCommitmentId_fkey" FOREIGN KEY ("budgetCommitmentId") REFERENCES "BudgetCommitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Encumbrance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "budgetCommitmentId" TEXT NOT NULL,
    "budgetLineId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "EncumbranceStatus" NOT NULL DEFAULT 'ACTIVE',
    "journalTransactionId" TEXT,
    "liquidationJournalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liquidatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    CONSTRAINT "Encumbrance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Encumbrance_schoolId_idx" ON "Encumbrance"("schoolId");
CREATE INDEX "Encumbrance_budgetCommitmentId_idx" ON "Encumbrance"("budgetCommitmentId");
CREATE INDEX "Encumbrance_budgetLineId_idx" ON "Encumbrance"("budgetLineId");
CREATE INDEX "Encumbrance_status_idx" ON "Encumbrance"("status");
ALTER TABLE "Encumbrance" ADD CONSTRAINT "Encumbrance_budgetCommitmentId_fkey" FOREIGN KEY ("budgetCommitmentId") REFERENCES "BudgetCommitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Encumbrance" ADD CONSTRAINT "Encumbrance_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ImpairmentRun" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "totalReceivables" DECIMAL(18,2) NOT NULL,
    "totalAllowance" DECIMAL(18,2) NOT NULL,
    "journalTransactionId" TEXT,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "buckets" JSONB NOT NULL,
    CONSTRAINT "ImpairmentRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ImpairmentRun_schoolId_idx" ON "ImpairmentRun"("schoolId");
CREATE INDEX "ImpairmentRun_asOfDate_idx" ON "ImpairmentRun"("asOfDate");

-- ─── Account: add classification flags ────────────────────────────
ALTER TABLE "Account"
  ADD COLUMN "isBudgetary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isContra" BOOLEAN NOT NULL DEFAULT false;

-- ─── JournalTransaction: audit + period fields ────────────────────
ALTER TABLE "JournalTransaction"
  DROP COLUMN "approvedAt",
  DROP COLUMN "approvedBy",
  ADD COLUMN "fiscalPeriodId" TEXT,
  ADD COLUMN "isAdjusting" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isClosing" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "postedAt" TIMESTAMP(3),
  ADD COLUMN "postedBy" TEXT,
  ADD COLUMN "reversalOfId" TEXT,
  ADD COLUMN "reversedAt" TIMESTAMP(3),
  ADD COLUMN "reversedBy" TEXT;
CREATE INDEX "JournalTransaction_fiscalPeriodId_idx" ON "JournalTransaction"("fiscalPeriodId");
ALTER TABLE "JournalTransaction" ADD CONSTRAINT "JournalTransaction_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalTransaction" ADD CONSTRAINT "JournalTransaction_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── JournalEntry: canonical one-row-per-side refactor ────────────
-- 1) Drop old FKs + indexes but KEEP old columns temporarily
ALTER TABLE "JournalEntry" DROP CONSTRAINT IF EXISTS "JournalEntry_creditAccountId_fkey";
ALTER TABLE "JournalEntry" DROP CONSTRAINT IF EXISTS "JournalEntry_debitAccountId_fkey";
DROP INDEX IF EXISTS "JournalEntry_creditAccountId_idx";
DROP INDEX IF EXISTS "JournalEntry_debitAccountId_idx";

-- 2) Add new columns nullable
ALTER TABLE "JournalEntry"
  ADD COLUMN "accountId" TEXT,
  ADD COLUMN "fundId" TEXT,
  ADD COLUMN "lineOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "side" "BalanceSide";

-- 3) Split every existing row into a DEBIT row + a CREDIT row.
--    We update the existing row to be the DEBIT side and insert a new row
--    for the CREDIT side, using a deterministic derived id so retries are idempotent.
UPDATE "JournalEntry" SET "accountId" = "debitAccountId", "side" = 'DEBIT', "lineOrder" = 0
  WHERE "debitAccountId" IS NOT NULL;

INSERT INTO "JournalEntry" ("id", "journalTransactionId", "schoolId", "accountId", "fundId", "side", "amount", "narration", "lineOrder")
SELECT
    -- Derive a stable id for the new credit row from the original id
    SUBSTR(MD5("id" || '|credit'), 1, 24),
    "journalTransactionId",
    "schoolId",
    "creditAccountId",
    NULL,
    'CREDIT',
    "amount",
    "narration",
    1
FROM "JournalEntry"
WHERE "side" = 'DEBIT' AND "creditAccountId" IS NOT NULL;

-- 4) Enforce NOT NULL on new columns and drop the legacy columns
ALTER TABLE "JournalEntry"
  ALTER COLUMN "accountId" SET NOT NULL,
  ALTER COLUMN "side" SET NOT NULL,
  DROP COLUMN "creditAccountId",
  DROP COLUMN "debitAccountId";

CREATE INDEX "JournalEntry_accountId_idx" ON "JournalEntry"("accountId");
CREATE INDEX "JournalEntry_fundId_idx" ON "JournalEntry"("fundId");
CREATE INDEX "JournalEntry_side_idx" ON "JournalEntry"("side");
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Operational table additions ──────────────────────────────────
ALTER TABLE "AppliedPenalty"
  ADD COLUMN "journalTransactionId" TEXT,
  ADD COLUMN "waiverJournalId" TEXT;

ALTER TABLE "Budget"
  ADD COLUMN "fiscalPeriodId" TEXT,
  ADD COLUMN "fundId" TEXT,
  ADD COLUMN "originalAmount" DECIMAL(18,2);

ALTER TABLE "BudgetLine"
  ADD COLUMN "committedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "originalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "DonorFund" ADD COLUMN "fundId" TEXT;
ALTER TABLE "DonorFundAllocation" ADD COLUMN "journalTransactionId" TEXT;

ALTER TABLE "Expense"
  DROP COLUMN "journalTransactionId",
  ADD COLUMN "accrualJournalId" TEXT,
  ADD COLUMN "budgetCommitmentId" TEXT,
  ADD COLUMN "fundId" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "paymentJournalId" TEXT;
CREATE INDEX "Expense_budgetCommitmentId_idx" ON "Expense"("budgetCommitmentId");

ALTER TABLE "ExpenseClaim" ADD COLUMN "journalTransactionId" TEXT;
ALTER TABLE "FeeWaiver" ADD COLUMN "journalTransactionId" TEXT;
ALTER TABLE "FinancialReport" ADD COLUMN "fundId" TEXT;

ALTER TABLE "GovernmentSubsidy"
  ADD COLUMN "fundId" TEXT,
  ADD COLUMN "isConditional" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Payment" ADD COLUMN "journalTransactionId" TEXT;
ALTER TABLE "PaymentReversal" ADD COLUMN "journalTransactionId" TEXT;
ALTER TABLE "PettyCashFund" ADD COLUMN "accountId" TEXT;
ALTER TABLE "PettyCashReplenishment" ADD COLUMN "journalTransactionId" TEXT;
ALTER TABLE "PettyCashTransaction" ADD COLUMN "journalTransactionId" TEXT;

ALTER TABLE "StudentBill"
  ADD COLUMN "accrualJournalId" TEXT,
  ADD COLUMN "writeOffJournalId" TEXT,
  ADD COLUMN "writtenOffAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "StudentScholarship" ADD COLUMN "journalTransactionId" TEXT;
ALTER TABLE "SubsidyDisbursement" ADD COLUMN "journalTransactionId" TEXT;
