/*
  Warnings:

  - You are about to alter the column `amount` on the `Allowance` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `fineAmount` on the `BookIssue` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `amount` on the `Deduction` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `amount` on the `FeeItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `basicSalary` on the `PayrollEntry` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `totalAllowances` on the `PayrollEntry` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `totalDeductions` on the `PayrollEntry` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `netPay` on the `PayrollEntry` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `totalAmount` on the `PurchaseOrder` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `unitPrice` on the `PurchaseOrderItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `totalPrice` on the `PurchaseOrderItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `estimatedUnitPrice` on the `PurchaseRequestItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `fee` on the `Route` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `value` on the `Scholarship` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `cost` on the `SmsLog` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,4)`.
  - You are about to alter the column `unitPrice` on the `StoreItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `totalAmount` on the `StudentBill` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `paidAmount` on the `StudentBill` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `balanceAmount` on the `StudentBill` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `amount` on the `StudentBillItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `waivedAmount` on the `StudentBillItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `paidAmount` on the `StudentBillItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - You are about to alter the column `appliedAmount` on the `StudentScholarship` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - Added the required column `schoolId` to the `AttendanceRegister` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "BalanceSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PettyCashType" AS ENUM ('DISBURSEMENT', 'REPLENISHMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ReplenishmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISBURSED');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ExpenseClaimStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "FinancialReportType" AS ENUM ('BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW', 'TRIAL_BALANCE', 'GENERAL_LEDGER', 'BUDGET_VS_ACTUAL', 'BOARD_SUMMARY', 'GRA_TAX_RETURN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('PAYE', 'VAT', 'WITHHOLDING', 'CORPORATE_TAX', 'SSNIT');

-- CreateEnum
CREATE TYPE "TaxStatus" AS ENUM ('PENDING', 'FILED', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "AttendancePolicyScope" AS ENUM ('SCHOOL', 'CLASS', 'CLASS_ARM');

-- CreateEnum
CREATE TYPE "AttendancePolicyMetric" AS ENUM ('ABSENCE_COUNT', 'ABSENCE_RATE', 'CONSECUTIVE_ABSENCES', 'LATE_COUNT');

-- CreateEnum
CREATE TYPE "AttendancePolicyPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'TERM');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PenaltyType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'DAILY_PERCENTAGE', 'DAILY_FIXED');

-- CreateEnum
CREATE TYPE "WaiverType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FULL_WAIVER', 'STAFF_CHILD_DISCOUNT', 'SIBLING_DISCOUNT');

-- CreateEnum
CREATE TYPE "WaiverStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubsidyType" AS ENUM ('FREE_SHS', 'GOVERNMENT_PLACEMENT', 'CAPITATION_GRANT', 'OTHER_GOVERNMENT');

-- CreateEnum
CREATE TYPE "SubsidyStatus" AS ENUM ('EXPECTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "DonorType" AS ENUM ('INDIVIDUAL', 'ORGANIZATION', 'FOUNDATION', 'ALUMNI', 'CORPORATE');

-- CreateEnum
CREATE TYPE "AidType" AS ENUM ('NEEDS_BASED', 'MERIT_BASED', 'HARDSHIP', 'ORPHAN_SUPPORT', 'COMMUNITY_SPONSORED');

-- CreateEnum
CREATE TYPE "AidStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED');

-- CreateEnum
CREATE TYPE "OnlinePaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('UNMATCHED', 'AUTO_MATCHED', 'MANUALLY_MATCHED', 'NO_MATCH');

-- CreateEnum
CREATE TYPE "StaffAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RENEWED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'FULLY_PAID', 'DEFAULTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'REDUCING_BALANCE', 'NONE');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'UNSERVICEABLE');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'UNDER_MAINTENANCE', 'DISPOSED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('REPAIR', 'SERVICE', 'UPGRADE', 'INSPECTION');

-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('STANDARD', 'PLACEMENT');

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('PORTAL', 'STAFF', 'BULK_IMPORT');

-- CreateEnum
CREATE TYPE "SubstitutionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TimetableVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "AdmissionApplication" ADD COLUMN     "applicationSource" "ApplicationSource" NOT NULL DEFAULT 'STAFF',
ADD COLUMN     "applicationType" "ApplicationType" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "beceIndexNumber" TEXT,
ADD COLUMN     "enrollmentCode" TEXT,
ADD COLUMN     "placementSchoolCode" TEXT;

-- AlterTable
ALTER TABLE "Allowance" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "arrivalTime" TIMESTAMP(3),
ADD COLUMN     "departureTime" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AttendanceRegister" ADD COLUMN     "schoolId" TEXT NOT NULL,
ADD COLUMN     "substituteForId" TEXT;

-- AlterTable
ALTER TABLE "BookIssue" ALTER COLUMN "fineAmount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Deduction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "FeeItem" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "PayrollEntry" ALTER COLUMN "basicSalary" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "totalAllowances" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "totalDeductions" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "netPay" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "PurchaseOrder" ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "PurchaseRequestItem" ALTER COLUMN "estimatedUnitPrice" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Route" ALTER COLUMN "fee" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Scholarship" ALTER COLUMN "value" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "SmsLog" ALTER COLUMN "cost" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StoreItem" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "StudentBill" ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "paidAmount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "balanceAmount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "StudentBillItem" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "waivedAmount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "paidAmount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "StudentScholarship" ALTER COLUMN "appliedAmount" SET DATA TYPE DECIMAL(18,2);

-- CreateTable
CREATE TABLE "AccountCategory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "normalBalance" "BalanceSide" NOT NULL,
    "isSystemAccount" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalTransaction" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "journalTransactionId" TEXT NOT NULL,
    "debitAccountId" TEXT NOT NULL,
    "creditAccountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "narration" TEXT,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "accountId" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "expenseCategoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "payee" TEXT,
    "referenceNumber" TEXT,
    "paymentMethod" "PaymentMethod",
    "receiptUrl" TEXT,
    "departmentId" TEXT,
    "termId" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "submittedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "journalTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashFund" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "custodianId" TEXT NOT NULL,
    "authorizedLimit" DECIMAL(18,2) NOT NULL,
    "currentBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PettyCashFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashTransaction" (
    "id" TEXT NOT NULL,
    "pettyCashFundId" TEXT NOT NULL,
    "type" "PettyCashType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "receiptUrl" TEXT,
    "recordedBy" TEXT NOT NULL,
    "expenseCategoryId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PettyCashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashReplenishment" (
    "id" TEXT NOT NULL,
    "pettyCashFundId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "status" "ReplenishmentStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "PettyCashReplenishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "expenseCategoryId" TEXT NOT NULL,
    "departmentId" TEXT,
    "allocatedAmount" DECIMAL(18,2) NOT NULL,
    "spentAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "claimantId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "ExpenseClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseClaimItem" (
    "id" TEXT NOT NULL,
    "expenseClaimId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "receiptUrl" TEXT,
    "expenseCategoryId" TEXT,

    CONSTRAINT "ExpenseClaimItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialReport" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "reportType" "FinancialReportType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,
    "fileUrl" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "FinancialReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "taxType" "TaxType" NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paidDate" TIMESTAMP(3),
    "referenceNumber" TEXT,
    "status" "TaxStatus" NOT NULL DEFAULT 'PENDING',
    "filedBy" TEXT,
    "filedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomReportDefinition" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "definition" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomReportDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "AttendancePolicyScope" NOT NULL DEFAULT 'SCHOOL',
    "scopeId" TEXT,
    "metric" "AttendancePolicyMetric" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "period" "AttendancePolicyPeriod" NOT NULL DEFAULT 'TERM',
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "actions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceAlert" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classArmId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAttendance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "remarks" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "boardingStatus" "BoardingStatus",
    "programmeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeTemplateItem" (
    "id" TEXT NOT NULL,
    "feeTemplateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,

    CONSTRAINT "FeeTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallmentPlan" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "feeStructureId" TEXT,
    "name" TEXT NOT NULL,
    "numberOfInstallments" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallmentSchedule" (
    "id" TEXT NOT NULL,
    "installmentPlanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "percentageOfTotal" DECIMAL(5,2) NOT NULL,
    "dueDaysFromStart" INTEGER NOT NULL,
    "label" TEXT,

    CONSTRAINT "InstallmentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentInstallment" (
    "id" TEXT NOT NULL,
    "studentBillId" TEXT NOT NULL,
    "installmentPlanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "StudentInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LatePenaltyRule" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "feeStructureId" TEXT,
    "name" TEXT NOT NULL,
    "type" "PenaltyType" NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "maxPenalty" DECIMAL(18,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LatePenaltyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppliedPenalty" (
    "id" TEXT NOT NULL,
    "studentBillId" TEXT NOT NULL,
    "latePenaltyRuleId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waived" BOOLEAN NOT NULL DEFAULT false,
    "waivedBy" TEXT,
    "waivedAt" TIMESTAMP(3),

    CONSTRAINT "AppliedPenalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeWaiver" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentBillId" TEXT NOT NULL,
    "studentBillItemId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "reason" TEXT NOT NULL,
    "waiverType" "WaiverType" NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "calculatedAmount" DECIMAL(18,2) NOT NULL,
    "status" "WaiverStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "FeeWaiver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernmentSubsidy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subsidyType" "SubsidyType" NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "expectedAmount" DECIMAL(18,2) NOT NULL,
    "receivedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "SubsidyStatus" NOT NULL DEFAULT 'EXPECTED',
    "referenceNumber" TEXT,
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernmentSubsidy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubsidyDisbursement" (
    "id" TEXT NOT NULL,
    "governmentSubsidyId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "bankReference" TEXT,
    "recordedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubsidyDisbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorFund" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "donorType" "DonorType" NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "totalPledged" DECIMAL(18,2) NOT NULL,
    "totalReceived" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalDisbursed" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "purpose" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonorFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorFundAllocation" (
    "id" TEXT NOT NULL,
    "donorFundId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "allocatedBy" TEXT NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonorFundAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAidApplication" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "aidType" "AidType" NOT NULL,
    "requestedAmount" DECIMAL(18,2) NOT NULL,
    "approvedAmount" DECIMAL(18,2),
    "reason" TEXT NOT NULL,
    "supportingDocs" TEXT[],
    "householdIncome" DECIMAL(18,2),
    "numberOfDependents" INTEGER,
    "status" "AidStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAidApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlinePaymentTransaction" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentBillId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "status" "OnlinePaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "providerReference" TEXT,
    "channel" TEXT,
    "callbackUrl" TEXT,
    "metadata" JSONB,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,

    CONSTRAINT "OnlinePaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentBillId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" DECIMAL(18,2),
    "description" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isOneTime" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "fileName" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "totalEntries" INTEGER NOT NULL DEFAULT 0,
    "matchedEntries" INTEGER NOT NULL DEFAULT 0,
    "unmatchedEntries" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementEntry" (
    "id" TEXT NOT NULL,
    "bankReconciliationId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "debitAmount" DECIMAL(18,2),
    "creditAmount" DECIMAL(18,2),
    "balance" DECIMAL(18,2),
    "matchedPaymentId" TEXT,
    "matchStatus" "MatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedAt" TIMESTAMP(3),
    "matchedBy" TEXT,

    CONSTRAINT "BankStatementEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "clockIn" TIMESTAMP(3),
    "clockOut" TIMESTAMP(3),
    "status" "StaffAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "remarks" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffContract" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "contractNumber" TEXT,
    "type" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "terms" TEXT,
    "documentId" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLoan" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalRepayment" DECIMAL(18,2) NOT NULL,
    "monthlyDeduction" DECIMAL(18,2) NOT NULL,
    "tenure" INTEGER NOT NULL,
    "remainingBalance" DECIMAL(18,2) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "payrollPeriodId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'PAYROLL_DEDUCTION',

    CONSTRAINT "LoanRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPromotion" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "previousRank" TEXT,
    "newRank" TEXT NOT NULL,
    "previousGrade" TEXT,
    "newGrade" TEXT,
    "previousSalary" DECIMAL(18,2),
    "newSalary" DECIMAL(18,2),
    "reason" TEXT,
    "approvedBy" TEXT NOT NULL,
    "letterDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "defaultUsefulLife" INTEGER,
    "defaultDepreciationMethod" "DepreciationMethod",
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assetNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "location" TEXT,
    "departmentId" TEXT,
    "serialNumber" TEXT,
    "model" TEXT,
    "manufacturer" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DECIMAL(18,2) NOT NULL,
    "currentValue" DECIMAL(18,2) NOT NULL,
    "usefulLifeYears" INTEGER,
    "salvageValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "disposedAt" TIMESTAMP(3),
    "disposalMethod" TEXT,
    "disposalAmount" DECIMAL(18,2),
    "disposedBy" TEXT,
    "purchaseOrderId" TEXT,
    "accountId" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDepreciation" (
    "id" TEXT NOT NULL,
    "fixedAssetId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "openingValue" DECIMAL(18,2) NOT NULL,
    "depreciationAmount" DECIMAL(18,2) NOT NULL,
    "closingValue" DECIMAL(18,2) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetDepreciation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMaintenance" (
    "id" TEXT NOT NULL,
    "fixedAssetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DECIMAL(18,2),
    "performedBy" TEXT,
    "nextDueDate" TIMESTAMP(3),
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableSubstitution" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "timetableSlotId" TEXT NOT NULL,
    "originalTeacherId" TEXT NOT NULL,
    "substituteTeacherId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "SubstitutionStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableSubstitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAvailability" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "periodId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherPreference" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "maxPeriodsPerDay" INTEGER,
    "maxConsecutivePeriods" INTEGER,
    "preferredPeriodIds" JSONB,
    "avoidPeriodIds" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableVersion" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TimetableVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "slots" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountCategory_schoolId_idx" ON "AccountCategory"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountCategory_schoolId_name_key" ON "AccountCategory"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Account_schoolId_idx" ON "Account"("schoolId");

-- CreateIndex
CREATE INDEX "Account_categoryId_idx" ON "Account"("categoryId");

-- CreateIndex
CREATE INDEX "Account_parentId_idx" ON "Account"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_schoolId_code_key" ON "Account"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "JournalTransaction_transactionNumber_key" ON "JournalTransaction"("transactionNumber");

-- CreateIndex
CREATE INDEX "JournalTransaction_schoolId_idx" ON "JournalTransaction"("schoolId");

-- CreateIndex
CREATE INDEX "JournalTransaction_date_idx" ON "JournalTransaction"("date");

-- CreateIndex
CREATE INDEX "JournalTransaction_status_idx" ON "JournalTransaction"("status");

-- CreateIndex
CREATE INDEX "JournalTransaction_referenceType_referenceId_idx" ON "JournalTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "JournalEntry_journalTransactionId_idx" ON "JournalEntry"("journalTransactionId");

-- CreateIndex
CREATE INDEX "JournalEntry_debitAccountId_idx" ON "JournalEntry"("debitAccountId");

-- CreateIndex
CREATE INDEX "JournalEntry_creditAccountId_idx" ON "JournalEntry"("creditAccountId");

-- CreateIndex
CREATE INDEX "ExpenseCategory_schoolId_idx" ON "ExpenseCategory"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_schoolId_name_key" ON "ExpenseCategory"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Expense_schoolId_idx" ON "Expense"("schoolId");

-- CreateIndex
CREATE INDEX "Expense_expenseCategoryId_idx" ON "Expense"("expenseCategoryId");

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "Expense"("status");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_departmentId_idx" ON "Expense"("departmentId");

-- CreateIndex
CREATE INDEX "PettyCashFund_schoolId_idx" ON "PettyCashFund"("schoolId");

-- CreateIndex
CREATE INDEX "PettyCashFund_custodianId_idx" ON "PettyCashFund"("custodianId");

-- CreateIndex
CREATE UNIQUE INDEX "PettyCashFund_schoolId_name_key" ON "PettyCashFund"("schoolId", "name");

-- CreateIndex
CREATE INDEX "PettyCashTransaction_pettyCashFundId_idx" ON "PettyCashTransaction"("pettyCashFundId");

-- CreateIndex
CREATE INDEX "PettyCashTransaction_date_idx" ON "PettyCashTransaction"("date");

-- CreateIndex
CREATE INDEX "PettyCashReplenishment_pettyCashFundId_idx" ON "PettyCashReplenishment"("pettyCashFundId");

-- CreateIndex
CREATE INDEX "PettyCashReplenishment_status_idx" ON "PettyCashReplenishment"("status");

-- CreateIndex
CREATE INDEX "Budget_schoolId_idx" ON "Budget"("schoolId");

-- CreateIndex
CREATE INDEX "Budget_academicYearId_idx" ON "Budget"("academicYearId");

-- CreateIndex
CREATE INDEX "Budget_status_idx" ON "Budget"("status");

-- CreateIndex
CREATE INDEX "BudgetLine_budgetId_idx" ON "BudgetLine"("budgetId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_budgetId_expenseCategoryId_departmentId_key" ON "BudgetLine"("budgetId", "expenseCategoryId", "departmentId");

-- CreateIndex
CREATE INDEX "ExpenseClaim_schoolId_idx" ON "ExpenseClaim"("schoolId");

-- CreateIndex
CREATE INDEX "ExpenseClaim_claimantId_idx" ON "ExpenseClaim"("claimantId");

-- CreateIndex
CREATE INDEX "ExpenseClaim_status_idx" ON "ExpenseClaim"("status");

-- CreateIndex
CREATE INDEX "ExpenseClaimItem_expenseClaimId_idx" ON "ExpenseClaimItem"("expenseClaimId");

-- CreateIndex
CREATE INDEX "FinancialReport_schoolId_idx" ON "FinancialReport"("schoolId");

-- CreateIndex
CREATE INDEX "FinancialReport_reportType_idx" ON "FinancialReport"("reportType");

-- CreateIndex
CREATE INDEX "FinancialReport_generatedAt_idx" ON "FinancialReport"("generatedAt");

-- CreateIndex
CREATE INDEX "TaxRecord_schoolId_idx" ON "TaxRecord"("schoolId");

-- CreateIndex
CREATE INDEX "TaxRecord_status_idx" ON "TaxRecord"("status");

-- CreateIndex
CREATE INDEX "TaxRecord_dueDate_idx" ON "TaxRecord"("dueDate");

-- CreateIndex
CREATE INDEX "TaxRecord_taxType_idx" ON "TaxRecord"("taxType");

-- CreateIndex
CREATE INDEX "CustomReportDefinition_schoolId_idx" ON "CustomReportDefinition"("schoolId");

-- CreateIndex
CREATE INDEX "CustomReportDefinition_createdBy_idx" ON "CustomReportDefinition"("createdBy");

-- CreateIndex
CREATE INDEX "AttendancePolicy_schoolId_idx" ON "AttendancePolicy"("schoolId");

-- CreateIndex
CREATE INDEX "AttendancePolicy_schoolId_isActive_idx" ON "AttendancePolicy"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "AttendanceAlert_schoolId_idx" ON "AttendanceAlert"("schoolId");

-- CreateIndex
CREATE INDEX "AttendanceAlert_schoolId_status_idx" ON "AttendanceAlert"("schoolId", "status");

-- CreateIndex
CREATE INDEX "AttendanceAlert_studentId_idx" ON "AttendanceAlert"("studentId");

-- CreateIndex
CREATE INDEX "AttendanceAlert_policyId_idx" ON "AttendanceAlert"("policyId");

-- CreateIndex
CREATE INDEX "EventAttendance_schoolId_idx" ON "EventAttendance"("schoolId");

-- CreateIndex
CREATE INDEX "EventAttendance_eventId_idx" ON "EventAttendance"("eventId");

-- CreateIndex
CREATE INDEX "EventAttendance_studentId_idx" ON "EventAttendance"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "EventAttendance_eventId_studentId_key" ON "EventAttendance"("eventId", "studentId");

-- CreateIndex
CREATE INDEX "FeeTemplate_schoolId_idx" ON "FeeTemplate"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeTemplate_schoolId_name_key" ON "FeeTemplate"("schoolId", "name");

-- CreateIndex
CREATE INDEX "FeeTemplateItem_feeTemplateId_idx" ON "FeeTemplateItem"("feeTemplateId");

-- CreateIndex
CREATE INDEX "InstallmentPlan_schoolId_idx" ON "InstallmentPlan"("schoolId");

-- CreateIndex
CREATE INDEX "InstallmentPlan_feeStructureId_idx" ON "InstallmentPlan"("feeStructureId");

-- CreateIndex
CREATE INDEX "InstallmentSchedule_installmentPlanId_idx" ON "InstallmentSchedule"("installmentPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "InstallmentSchedule_installmentPlanId_installmentNumber_key" ON "InstallmentSchedule"("installmentPlanId", "installmentNumber");

-- CreateIndex
CREATE INDEX "StudentInstallment_studentBillId_idx" ON "StudentInstallment"("studentBillId");

-- CreateIndex
CREATE INDEX "StudentInstallment_dueDate_idx" ON "StudentInstallment"("dueDate");

-- CreateIndex
CREATE INDEX "StudentInstallment_status_idx" ON "StudentInstallment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentInstallment_studentBillId_installmentPlanId_installm_key" ON "StudentInstallment"("studentBillId", "installmentPlanId", "installmentNumber");

-- CreateIndex
CREATE INDEX "LatePenaltyRule_schoolId_idx" ON "LatePenaltyRule"("schoolId");

-- CreateIndex
CREATE INDEX "LatePenaltyRule_feeStructureId_idx" ON "LatePenaltyRule"("feeStructureId");

-- CreateIndex
CREATE INDEX "AppliedPenalty_studentBillId_idx" ON "AppliedPenalty"("studentBillId");

-- CreateIndex
CREATE INDEX "AppliedPenalty_latePenaltyRuleId_idx" ON "AppliedPenalty"("latePenaltyRuleId");

-- CreateIndex
CREATE INDEX "FeeWaiver_schoolId_idx" ON "FeeWaiver"("schoolId");

-- CreateIndex
CREATE INDEX "FeeWaiver_studentBillId_idx" ON "FeeWaiver"("studentBillId");

-- CreateIndex
CREATE INDEX "FeeWaiver_status_idx" ON "FeeWaiver"("status");

-- CreateIndex
CREATE INDEX "GovernmentSubsidy_schoolId_idx" ON "GovernmentSubsidy"("schoolId");

-- CreateIndex
CREATE INDEX "GovernmentSubsidy_academicYearId_idx" ON "GovernmentSubsidy"("academicYearId");

-- CreateIndex
CREATE INDEX "GovernmentSubsidy_status_idx" ON "GovernmentSubsidy"("status");

-- CreateIndex
CREATE INDEX "SubsidyDisbursement_governmentSubsidyId_idx" ON "SubsidyDisbursement"("governmentSubsidyId");

-- CreateIndex
CREATE INDEX "DonorFund_schoolId_idx" ON "DonorFund"("schoolId");

-- CreateIndex
CREATE INDEX "DonorFund_isActive_idx" ON "DonorFund"("isActive");

-- CreateIndex
CREATE INDEX "DonorFundAllocation_donorFundId_idx" ON "DonorFundAllocation"("donorFundId");

-- CreateIndex
CREATE INDEX "DonorFundAllocation_studentId_idx" ON "DonorFundAllocation"("studentId");

-- CreateIndex
CREATE INDEX "DonorFundAllocation_termId_idx" ON "DonorFundAllocation"("termId");

-- CreateIndex
CREATE INDEX "FinancialAidApplication_schoolId_idx" ON "FinancialAidApplication"("schoolId");

-- CreateIndex
CREATE INDEX "FinancialAidApplication_studentId_idx" ON "FinancialAidApplication"("studentId");

-- CreateIndex
CREATE INDEX "FinancialAidApplication_academicYearId_idx" ON "FinancialAidApplication"("academicYearId");

-- CreateIndex
CREATE INDEX "FinancialAidApplication_status_idx" ON "FinancialAidApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OnlinePaymentTransaction_reference_key" ON "OnlinePaymentTransaction"("reference");

-- CreateIndex
CREATE INDEX "OnlinePaymentTransaction_schoolId_idx" ON "OnlinePaymentTransaction"("schoolId");

-- CreateIndex
CREATE INDEX "OnlinePaymentTransaction_studentBillId_idx" ON "OnlinePaymentTransaction"("studentBillId");

-- CreateIndex
CREATE INDEX "OnlinePaymentTransaction_reference_idx" ON "OnlinePaymentTransaction"("reference");

-- CreateIndex
CREATE INDEX "OnlinePaymentTransaction_status_idx" ON "OnlinePaymentTransaction"("status");

-- CreateIndex
CREATE INDEX "OnlinePaymentTransaction_provider_idx" ON "OnlinePaymentTransaction"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLink_code_key" ON "PaymentLink"("code");

-- CreateIndex
CREATE INDEX "PaymentLink_schoolId_idx" ON "PaymentLink"("schoolId");

-- CreateIndex
CREATE INDEX "PaymentLink_code_idx" ON "PaymentLink"("code");

-- CreateIndex
CREATE INDEX "PaymentLink_studentBillId_idx" ON "PaymentLink"("studentBillId");

-- CreateIndex
CREATE INDEX "PaymentLink_isActive_idx" ON "PaymentLink"("isActive");

-- CreateIndex
CREATE INDEX "BankReconciliation_schoolId_idx" ON "BankReconciliation"("schoolId");

-- CreateIndex
CREATE INDEX "BankReconciliation_status_idx" ON "BankReconciliation"("status");

-- CreateIndex
CREATE INDEX "BankStatementEntry_bankReconciliationId_idx" ON "BankStatementEntry"("bankReconciliationId");

-- CreateIndex
CREATE INDEX "BankStatementEntry_matchStatus_idx" ON "BankStatementEntry"("matchStatus");

-- CreateIndex
CREATE INDEX "BankStatementEntry_reference_idx" ON "BankStatementEntry"("reference");

-- CreateIndex
CREATE INDEX "PublicHoliday_schoolId_idx" ON "PublicHoliday"("schoolId");

-- CreateIndex
CREATE INDEX "PublicHoliday_date_idx" ON "PublicHoliday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PublicHoliday_schoolId_date_key" ON "PublicHoliday"("schoolId", "date");

-- CreateIndex
CREATE INDEX "StaffAttendance_schoolId_date_idx" ON "StaffAttendance"("schoolId", "date");

-- CreateIndex
CREATE INDEX "StaffAttendance_staffId_idx" ON "StaffAttendance"("staffId");

-- CreateIndex
CREATE INDEX "StaffAttendance_status_idx" ON "StaffAttendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_staffId_date_key" ON "StaffAttendance"("staffId", "date");

-- CreateIndex
CREATE INDEX "StaffContract_schoolId_idx" ON "StaffContract"("schoolId");

-- CreateIndex
CREATE INDEX "StaffContract_staffId_idx" ON "StaffContract"("staffId");

-- CreateIndex
CREATE INDEX "StaffContract_endDate_idx" ON "StaffContract"("endDate");

-- CreateIndex
CREATE INDEX "StaffContract_status_idx" ON "StaffContract"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffLoan_loanNumber_key" ON "StaffLoan"("loanNumber");

-- CreateIndex
CREATE INDEX "StaffLoan_schoolId_idx" ON "StaffLoan"("schoolId");

-- CreateIndex
CREATE INDEX "StaffLoan_staffId_idx" ON "StaffLoan"("staffId");

-- CreateIndex
CREATE INDEX "StaffLoan_status_idx" ON "StaffLoan"("status");

-- CreateIndex
CREATE INDEX "LoanRepayment_loanId_idx" ON "LoanRepayment"("loanId");

-- CreateIndex
CREATE INDEX "LoanRepayment_payrollPeriodId_idx" ON "LoanRepayment"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "StaffPromotion_schoolId_idx" ON "StaffPromotion"("schoolId");

-- CreateIndex
CREATE INDEX "StaffPromotion_staffId_idx" ON "StaffPromotion"("staffId");

-- CreateIndex
CREATE INDEX "AssetCategory_schoolId_idx" ON "AssetCategory"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_schoolId_name_key" ON "AssetCategory"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_assetNumber_key" ON "FixedAsset"("assetNumber");

-- CreateIndex
CREATE INDEX "FixedAsset_schoolId_idx" ON "FixedAsset"("schoolId");

-- CreateIndex
CREATE INDEX "FixedAsset_categoryId_idx" ON "FixedAsset"("categoryId");

-- CreateIndex
CREATE INDEX "FixedAsset_status_idx" ON "FixedAsset"("status");

-- CreateIndex
CREATE INDEX "FixedAsset_departmentId_idx" ON "FixedAsset"("departmentId");

-- CreateIndex
CREATE INDEX "FixedAsset_assetNumber_idx" ON "FixedAsset"("assetNumber");

-- CreateIndex
CREATE INDEX "AssetDepreciation_fixedAssetId_idx" ON "AssetDepreciation"("fixedAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDepreciation_fixedAssetId_period_key" ON "AssetDepreciation"("fixedAssetId", "period");

-- CreateIndex
CREATE INDEX "AssetMaintenance_fixedAssetId_idx" ON "AssetMaintenance"("fixedAssetId");

-- CreateIndex
CREATE INDEX "AssetMaintenance_date_idx" ON "AssetMaintenance"("date");

-- CreateIndex
CREATE INDEX "AssetMaintenance_nextDueDate_idx" ON "AssetMaintenance"("nextDueDate");

-- CreateIndex
CREATE INDEX "TimetableSubstitution_schoolId_idx" ON "TimetableSubstitution"("schoolId");

-- CreateIndex
CREATE INDEX "TimetableSubstitution_schoolId_date_idx" ON "TimetableSubstitution"("schoolId", "date");

-- CreateIndex
CREATE INDEX "TimetableSubstitution_originalTeacherId_idx" ON "TimetableSubstitution"("originalTeacherId");

-- CreateIndex
CREATE INDEX "TimetableSubstitution_substituteTeacherId_idx" ON "TimetableSubstitution"("substituteTeacherId");

-- CreateIndex
CREATE INDEX "TimetableSubstitution_status_idx" ON "TimetableSubstitution"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSubstitution_timetableSlotId_date_key" ON "TimetableSubstitution"("timetableSlotId", "date");

-- CreateIndex
CREATE INDEX "TeacherAvailability_schoolId_idx" ON "TeacherAvailability"("schoolId");

-- CreateIndex
CREATE INDEX "TeacherAvailability_teacherId_termId_idx" ON "TeacherAvailability"("teacherId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAvailability_teacherId_dayOfWeek_periodId_termId_key" ON "TeacherAvailability"("teacherId", "dayOfWeek", "periodId", "termId");

-- CreateIndex
CREATE INDEX "TeacherPreference_schoolId_idx" ON "TeacherPreference"("schoolId");

-- CreateIndex
CREATE INDEX "TeacherPreference_teacherId_idx" ON "TeacherPreference"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherPreference_teacherId_termId_key" ON "TeacherPreference"("teacherId", "termId");

-- CreateIndex
CREATE INDEX "TimetableVersion_schoolId_idx" ON "TimetableVersion"("schoolId");

-- CreateIndex
CREATE INDEX "TimetableVersion_schoolId_termId_idx" ON "TimetableVersion"("schoolId", "termId");

-- CreateIndex
CREATE INDEX "TimetableVersion_status_idx" ON "TimetableVersion"("status");

-- CreateIndex
CREATE INDEX "AdmissionApplication_applicationType_idx" ON "AdmissionApplication"("applicationType");

-- CreateIndex
CREATE INDEX "AdmissionApplication_beceIndexNumber_idx" ON "AdmissionApplication"("beceIndexNumber");

-- CreateIndex
CREATE INDEX "AdmissionApplication_enrollmentCode_idx" ON "AdmissionApplication"("enrollmentCode");

-- CreateIndex
CREATE INDEX "AdmissionApplication_guardianPhone_idx" ON "AdmissionApplication"("guardianPhone");

-- CreateIndex
CREATE INDEX "AttendanceRegister_schoolId_idx" ON "AttendanceRegister"("schoolId");

-- CreateIndex
CREATE INDEX "AttendanceRegister_schoolId_date_idx" ON "AttendanceRegister"("schoolId", "date");

-- CreateIndex
CREATE INDEX "Staff_deletedAt_idx" ON "Staff"("deletedAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AccountCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_journalTransactionId_fkey" FOREIGN KEY ("journalTransactionId") REFERENCES "JournalTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashTransaction" ADD CONSTRAINT "PettyCashTransaction_pettyCashFundId_fkey" FOREIGN KEY ("pettyCashFundId") REFERENCES "PettyCashFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashReplenishment" ADD CONSTRAINT "PettyCashReplenishment_pettyCashFundId_fkey" FOREIGN KEY ("pettyCashFundId") REFERENCES "PettyCashFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaimItem" ADD CONSTRAINT "ExpenseClaimItem_expenseClaimId_fkey" FOREIGN KEY ("expenseClaimId") REFERENCES "ExpenseClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRegister" ADD CONSTRAINT "AttendanceRegister_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRegister" ADD CONSTRAINT "AttendanceRegister_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePolicy" ADD CONSTRAINT "AttendancePolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAlert" ADD CONSTRAINT "AttendanceAlert_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAlert" ADD CONSTRAINT "AttendanceAlert_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AttendancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeTemplateItem" ADD CONSTRAINT "FeeTemplateItem_feeTemplateId_fkey" FOREIGN KEY ("feeTemplateId") REFERENCES "FeeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentSchedule" ADD CONSTRAINT "InstallmentSchedule_installmentPlanId_fkey" FOREIGN KEY ("installmentPlanId") REFERENCES "InstallmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentInstallment" ADD CONSTRAINT "StudentInstallment_studentBillId_fkey" FOREIGN KEY ("studentBillId") REFERENCES "StudentBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentInstallment" ADD CONSTRAINT "StudentInstallment_installmentPlanId_fkey" FOREIGN KEY ("installmentPlanId") REFERENCES "InstallmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedPenalty" ADD CONSTRAINT "AppliedPenalty_studentBillId_fkey" FOREIGN KEY ("studentBillId") REFERENCES "StudentBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedPenalty" ADD CONSTRAINT "AppliedPenalty_latePenaltyRuleId_fkey" FOREIGN KEY ("latePenaltyRuleId") REFERENCES "LatePenaltyRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeWaiver" ADD CONSTRAINT "FeeWaiver_studentBillId_fkey" FOREIGN KEY ("studentBillId") REFERENCES "StudentBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubsidyDisbursement" ADD CONSTRAINT "SubsidyDisbursement_governmentSubsidyId_fkey" FOREIGN KEY ("governmentSubsidyId") REFERENCES "GovernmentSubsidy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorFundAllocation" ADD CONSTRAINT "DonorFundAllocation_donorFundId_fkey" FOREIGN KEY ("donorFundId") REFERENCES "DonorFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementEntry" ADD CONSTRAINT "BankStatementEntry_bankReconciliationId_fkey" FOREIGN KEY ("bankReconciliationId") REFERENCES "BankReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffContract" ADD CONSTRAINT "StaffContract_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLoan" ADD CONSTRAINT "StaffLoan_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "StaffLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPromotion" ADD CONSTRAINT "StaffPromotion_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciation" ADD CONSTRAINT "AssetDepreciation_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSubstitution" ADD CONSTRAINT "TimetableSubstitution_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSubstitution" ADD CONSTRAINT "TimetableSubstitution_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "TimetableSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPreference" ADD CONSTRAINT "TeacherPreference_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
