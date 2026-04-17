/*
  Warnings:

  - You are about to drop the column `schoolId` on the `UserRole` table. All the data in the column will be lost.
  - Made the column `schoolId` on table `MarkStandardLink` required. This step will fail if there are existing NULL values in that column.
  - Made the column `schoolId` on table `StudentStandardMastery` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "WastageReason" AS ENUM ('EXPIRED', 'DAMAGED', 'SPOILED', 'OBSOLETE', 'OTHER');

-- CreateEnum
CREATE TYPE "CheckoutStatus" AS ENUM ('CHECKED_OUT', 'RETURNED', 'OVERDUE');

-- AlterTable
ALTER TABLE "BoardingIncident" ALTER COLUMN "studentIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MarkStandardLink" ALTER COLUMN "schoolId" SET NOT NULL;

-- AlterTable
ALTER TABLE "StudentStandardMastery" ALTER COLUMN "schoolId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "periodsPerWeek" INTEGER,
ADD COLUMN     "preferredRoomType" "RoomType",
ADD COLUMN     "requiresDouble" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserRole" DROP COLUMN "schoolId";

-- CreateTable
CREATE TABLE "SupplierContract" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "contractNumber" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "terms" TEXT,
    "value" DECIMAL(18,2),
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierRating" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "deliveryScore" INTEGER NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "pricingScore" INTEGER NOT NULL,
    "overallScore" DECIMAL(3,1) NOT NULL,
    "comments" TEXT,
    "ratedBy" TEXT NOT NULL,
    "ratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemExpiryTracking" (
    "id" TEXT NOT NULL,
    "storeItemId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "quantity" INTEGER NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "alertSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemExpiryTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WastageRecord" (
    "id" TEXT NOT NULL,
    "storeItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "WastageReason" NOT NULL,
    "description" TEXT,
    "recordedBy" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WastageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCheckout" (
    "id" TEXT NOT NULL,
    "fixedAssetId" TEXT NOT NULL,
    "checkedOutTo" TEXT NOT NULL,
    "checkedOutBy" TEXT NOT NULL,
    "purpose" TEXT,
    "checkoutDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturn" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "returnedBy" TEXT,
    "condition" "AssetCondition",
    "returnNotes" TEXT,
    "status" "CheckoutStatus" NOT NULL DEFAULT 'CHECKED_OUT',

    CONSTRAINT "AssetCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetInsurance" (
    "id" TEXT NOT NULL,
    "fixedAssetId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "policyNumber" TEXT,
    "coverageAmount" DECIMAL(18,2),
    "premium" DECIMAL(18,2),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetWarranty" (
    "id" TEXT NOT NULL,
    "fixedAssetId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "warrantyType" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "terms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetWarranty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableConfig" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "assemblyPeriodId" TEXT,
    "assemblyDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "formMasterPeriodId" TEXT,
    "fridayLastPeriodOrder" INTEGER,
    "operatingDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "softWeights" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierContract_supplierId_idx" ON "SupplierContract"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierContract_endDate_idx" ON "SupplierContract"("endDate");

-- CreateIndex
CREATE INDEX "SupplierRating_supplierId_idx" ON "SupplierRating"("supplierId");

-- CreateIndex
CREATE INDEX "ItemExpiryTracking_storeItemId_idx" ON "ItemExpiryTracking"("storeItemId");

-- CreateIndex
CREATE INDEX "ItemExpiryTracking_expiryDate_idx" ON "ItemExpiryTracking"("expiryDate");

-- CreateIndex
CREATE INDEX "WastageRecord_storeItemId_idx" ON "WastageRecord"("storeItemId");

-- CreateIndex
CREATE INDEX "WastageRecord_reason_idx" ON "WastageRecord"("reason");

-- CreateIndex
CREATE INDEX "WastageRecord_recordedAt_idx" ON "WastageRecord"("recordedAt");

-- CreateIndex
CREATE INDEX "AssetCheckout_fixedAssetId_idx" ON "AssetCheckout"("fixedAssetId");

-- CreateIndex
CREATE INDEX "AssetCheckout_checkedOutTo_idx" ON "AssetCheckout"("checkedOutTo");

-- CreateIndex
CREATE INDEX "AssetCheckout_status_idx" ON "AssetCheckout"("status");

-- CreateIndex
CREATE INDEX "AssetCheckout_expectedReturn_idx" ON "AssetCheckout"("expectedReturn");

-- CreateIndex
CREATE INDEX "AssetInsurance_fixedAssetId_idx" ON "AssetInsurance"("fixedAssetId");

-- CreateIndex
CREATE INDEX "AssetInsurance_endDate_idx" ON "AssetInsurance"("endDate");

-- CreateIndex
CREATE INDEX "AssetWarranty_fixedAssetId_idx" ON "AssetWarranty"("fixedAssetId");

-- CreateIndex
CREATE INDEX "AssetWarranty_endDate_idx" ON "AssetWarranty"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableConfig_termId_key" ON "TimetableConfig"("termId");

-- CreateIndex
CREATE INDEX "TimetableConfig_schoolId_idx" ON "TimetableConfig"("schoolId");

-- CreateIndex
CREATE INDEX "AdmissionDocument_schoolId_idx" ON "AdmissionDocument"("schoolId");

-- CreateIndex
CREATE INDEX "AppliedPenalty_schoolId_idx" ON "AppliedPenalty"("schoolId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_schoolId_idx" ON "AssignmentSubmission"("schoolId");

-- CreateIndex
CREATE INDEX "BankStatementEntry_schoolId_idx" ON "BankStatementEntry"("schoolId");

-- CreateIndex
CREATE INDEX "BedAllocation_schoolId_idx" ON "BedAllocation"("schoolId");

-- CreateIndex
CREATE INDEX "BudgetLine_schoolId_idx" ON "BudgetLine"("schoolId");

-- CreateIndex
CREATE INDEX "CourseEnrollment_schoolId_idx" ON "CourseEnrollment"("schoolId");

-- CreateIndex
CREATE INDEX "DonorFundAllocation_schoolId_idx" ON "DonorFundAllocation"("schoolId");

-- CreateIndex
CREATE INDEX "ExamSeatingArrangement_schoolId_idx" ON "ExamSeatingArrangement"("schoolId");

-- CreateIndex
CREATE INDEX "ExeatApproval_schoolId_idx" ON "ExeatApproval"("schoolId");

-- CreateIndex
CREATE INDEX "ExpenseClaimItem_schoolId_idx" ON "ExpenseClaimItem"("schoolId");

-- CreateIndex
CREATE INDEX "FeeTemplateItem_schoolId_idx" ON "FeeTemplateItem"("schoolId");

-- CreateIndex
CREATE INDEX "GraduationRecord_schoolId_idx" ON "GraduationRecord"("schoolId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_schoolId_idx" ON "HomeworkSubmission"("schoolId");

-- CreateIndex
CREATE INDEX "InstallmentSchedule_schoolId_idx" ON "InstallmentSchedule"("schoolId");

-- CreateIndex
CREATE INDEX "LeaveBalance_schoolId_idx" ON "LeaveBalance"("schoolId");

-- CreateIndex
CREATE INDEX "LessonProgress_schoolId_idx" ON "LessonProgress"("schoolId");

-- CreateIndex
CREATE INDEX "LmsAssignment_schoolId_idx" ON "LmsAssignment"("schoolId");

-- CreateIndex
CREATE INDEX "LoanRepayment_schoolId_idx" ON "LoanRepayment"("schoolId");

-- CreateIndex
CREATE INDEX "MarkAuditLog_schoolId_idx" ON "MarkAuditLog"("schoolId");

-- CreateIndex
CREATE INDEX "MarkStandardLink_schoolId_idx" ON "MarkStandardLink"("schoolId");

-- CreateIndex
CREATE INDEX "PTCBooking_schoolId_idx" ON "PTCBooking"("schoolId");

-- CreateIndex
CREATE INDEX "PaymentReversal_schoolId_idx" ON "PaymentReversal"("schoolId");

-- CreateIndex
CREATE INDEX "PettyCashReplenishment_schoolId_idx" ON "PettyCashReplenishment"("schoolId");

-- CreateIndex
CREATE INDEX "PettyCashTransaction_schoolId_idx" ON "PettyCashTransaction"("schoolId");

-- CreateIndex
CREATE INDEX "ProgrammeSubject_schoolId_idx" ON "ProgrammeSubject"("schoolId");

-- CreateIndex
CREATE INDEX "QuizQuestion_schoolId_idx" ON "QuizQuestion"("schoolId");

-- CreateIndex
CREATE INDEX "RollCallRecord_schoolId_idx" ON "RollCallRecord"("schoolId");

-- CreateIndex
CREATE INDEX "RouteStop_schoolId_idx" ON "RouteStop"("schoolId");

-- CreateIndex
CREATE INDEX "StudentActivity_schoolId_idx" ON "StudentActivity"("schoolId");

-- CreateIndex
CREATE INDEX "StudentBillItem_schoolId_idx" ON "StudentBillItem"("schoolId");

-- CreateIndex
CREATE INDEX "StudentConduct_schoolId_idx" ON "StudentConduct"("schoolId");

-- CreateIndex
CREATE INDEX "StudentHouse_schoolId_idx" ON "StudentHouse"("schoolId");

-- CreateIndex
CREATE INDEX "StudentInstallment_schoolId_idx" ON "StudentInstallment"("schoolId");

-- CreateIndex
CREATE INDEX "StudentScholarship_schoolId_idx" ON "StudentScholarship"("schoolId");

-- CreateIndex
CREATE INDEX "StudentStandardMastery_schoolId_idx" ON "StudentStandardMastery"("schoolId");

-- CreateIndex
CREATE INDEX "StudentSubjectSelection_schoolId_idx" ON "StudentSubjectSelection"("schoolId");

-- CreateIndex
CREATE INDEX "StudentTransport_schoolId_idx" ON "StudentTransport"("schoolId");

-- CreateIndex
CREATE INDEX "SubsidyDisbursement_schoolId_idx" ON "SubsidyDisbursement"("schoolId");

-- CreateIndex
CREATE INDEX "TeacherSubjectAssignment_schoolId_idx" ON "TeacherSubjectAssignment"("schoolId");

-- AddForeignKey
ALTER TABLE "StudentSubjectSelection" ADD CONSTRAINT "StudentSubjectSelection_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentConduct" ADD CONSTRAINT "StudentConduct_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkAuditLog" ADD CONSTRAINT "MarkAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentActivity" ADD CONSTRAINT "StudentActivity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeatingArrangement" ADD CONSTRAINT "ExamSeatingArrangement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkStandardLink" ADD CONSTRAINT "MarkStandardLink_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStandardMastery" ADD CONSTRAINT "StudentStandardMastery_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTCBooking" ADD CONSTRAINT "PTCBooking_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeSubject" ADD CONSTRAINT "ProgrammeSubject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubjectAssignment" ADD CONSTRAINT "TeacherSubjectAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashTransaction" ADD CONSTRAINT "PettyCashTransaction_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashReplenishment" ADD CONSTRAINT "PettyCashReplenishment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaimItem" ADD CONSTRAINT "ExpenseClaimItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dormitory" ADD CONSTRAINT "Dormitory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedAllocation" ADD CONSTRAINT "BedAllocation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exeat" ADD CONSTRAINT "Exeat_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExeatApproval" ADD CONSTRAINT "ExeatApproval_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RollCall" ADD CONSTRAINT "RollCall_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RollCallRecord" ADD CONSTRAINT "RollCallRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationRecord" ADD CONSTRAINT "GraduationRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeItem" ADD CONSTRAINT "FeeItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBillItem" ADD CONSTRAINT "StudentBillItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentScholarship" ADD CONSTRAINT "StudentScholarship_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReversal" ADD CONSTRAINT "PaymentReversal_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeTemplateItem" ADD CONSTRAINT "FeeTemplateItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentSchedule" ADD CONSTRAINT "InstallmentSchedule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentInstallment" ADD CONSTRAINT "StudentInstallment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedPenalty" ADD CONSTRAINT "AppliedPenalty_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubsidyDisbursement" ADD CONSTRAINT "SubsidyDisbursement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorFundAllocation" ADD CONSTRAINT "DonorFundAllocation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementEntry" ADD CONSTRAINT "BankStatementEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employment" ADD CONSTRAINT "Employment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierContract" ADD CONSTRAINT "SupplierContract_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRating" ADD CONSTRAINT "SupplierRating_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemExpiryTracking" ADD CONSTRAINT "ItemExpiryTracking_storeItemId_fkey" FOREIGN KEY ("storeItemId") REFERENCES "StoreItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WastageRecord" ADD CONSTRAINT "WastageRecord_storeItemId_fkey" FOREIGN KEY ("storeItemId") REFERENCES "StoreItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCheckout" ADD CONSTRAINT "AssetCheckout_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetInsurance" ADD CONSTRAINT "AssetInsurance_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetWarranty" ADD CONSTRAINT "AssetWarranty_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookIssue" ADD CONSTRAINT "BookIssue_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsAssignment" ADD CONSTRAINT "LmsAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentHouse" ADD CONSTRAINT "StudentHouse_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionDocument" ADD CONSTRAINT "AdmissionDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableConfig" ADD CONSTRAINT "TimetableConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTransport" ADD CONSTRAINT "StudentTransport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
