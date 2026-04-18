-- CreateEnum
CREATE TYPE "InterviewOutcome" AS ENUM ('PASSED', 'CONDITIONAL', 'FAILED', 'NO_SHOW', 'WAIVED');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'UPHELD', 'DENIED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdmissionStatus" ADD VALUE 'PAYMENT_PENDING';
ALTER TYPE "AdmissionStatus" ADD VALUE 'DOCUMENTS_PENDING';
ALTER TYPE "AdmissionStatus" ADD VALUE 'INTERVIEW_SCHEDULED';
ALTER TYPE "AdmissionStatus" ADD VALUE 'AWAITING_DECISION';
ALTER TYPE "AdmissionStatus" ADD VALUE 'CONDITIONAL_ACCEPT';
ALTER TYPE "AdmissionStatus" ADD VALUE 'WAITLISTED';
ALTER TYPE "AdmissionStatus" ADD VALUE 'OFFER_EXPIRED';
ALTER TYPE "AdmissionStatus" ADD VALUE 'WITHDRAWN';

-- AlterTable
ALTER TABLE "AdmissionApplication" ADD COLUMN     "applicationFeeAmount" DECIMAL(18,2),
ADD COLUMN     "applicationFeePaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "applicationFeePaymentId" TEXT,
ADD COLUMN     "applicationFeeRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoDecision" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentStage" TEXT,
ADD COLUMN     "decisionReason" TEXT,
ADD COLUMN     "feeWaivedReason" TEXT,
ADD COLUMN     "interviewRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "interviewWaivedReason" TEXT,
ADD COLUMN     "offerAccepted" BOOLEAN,
ADD COLUMN     "offerAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "offerExpiryDate" TIMESTAMP(3),
ADD COLUMN     "placementVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "placementVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "placementVerifiedBy" TEXT,
ADD COLUMN     "programPlaced" TEXT,
ADD COLUMN     "withdrawalReason" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AdmissionDocument" ADD COLUMN     "fileKey" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- CreateTable
CREATE TABLE "AdmissionInterview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "panelMemberIds" TEXT[],
    "academicScore" DECIMAL(5,2),
    "behavioralScore" DECIMAL(5,2),
    "parentScore" DECIMAL(5,2),
    "totalScore" DECIMAL(5,2),
    "outcome" "InterviewOutcome",
    "notes" TEXT,
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionDecision" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "decision" "AdmissionStatus" NOT NULL,
    "decidedBy" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "approvedBy" TEXT,
    "autoDecision" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AdmissionDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionCondition" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "met" BOOLEAN NOT NULL DEFAULT false,
    "metAt" TIMESTAMP(3),
    "evidenceKey" TEXT,
    "verifiedBy" TEXT,

    CONSTRAINT "AdmissionCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionAppeal" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,

    CONSTRAINT "AdmissionAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionOffer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,

    CONSTRAINT "AdmissionOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdmissionInterview_applicationId_idx" ON "AdmissionInterview"("applicationId");

-- CreateIndex
CREATE INDEX "AdmissionInterview_schoolId_idx" ON "AdmissionInterview"("schoolId");

-- CreateIndex
CREATE INDEX "AdmissionInterview_scheduledAt_idx" ON "AdmissionInterview"("scheduledAt");

-- CreateIndex
CREATE INDEX "AdmissionInterview_outcome_idx" ON "AdmissionInterview"("outcome");

-- CreateIndex
CREATE INDEX "AdmissionDecision_applicationId_idx" ON "AdmissionDecision"("applicationId");

-- CreateIndex
CREATE INDEX "AdmissionDecision_schoolId_idx" ON "AdmissionDecision"("schoolId");

-- CreateIndex
CREATE INDEX "AdmissionDecision_decidedAt_idx" ON "AdmissionDecision"("decidedAt");

-- CreateIndex
CREATE INDEX "AdmissionCondition_decisionId_idx" ON "AdmissionCondition"("decisionId");

-- CreateIndex
CREATE INDEX "AdmissionCondition_deadline_idx" ON "AdmissionCondition"("deadline");

-- CreateIndex
CREATE INDEX "AdmissionCondition_met_idx" ON "AdmissionCondition"("met");

-- CreateIndex
CREATE INDEX "AdmissionAppeal_applicationId_idx" ON "AdmissionAppeal"("applicationId");

-- CreateIndex
CREATE INDEX "AdmissionAppeal_schoolId_idx" ON "AdmissionAppeal"("schoolId");

-- CreateIndex
CREATE INDEX "AdmissionAppeal_status_idx" ON "AdmissionAppeal"("status");

-- CreateIndex
CREATE INDEX "AdmissionOffer_applicationId_idx" ON "AdmissionOffer"("applicationId");

-- CreateIndex
CREATE INDEX "AdmissionOffer_schoolId_idx" ON "AdmissionOffer"("schoolId");

-- CreateIndex
CREATE INDEX "AdmissionOffer_expiryDate_idx" ON "AdmissionOffer"("expiryDate");

-- CreateIndex
CREATE INDEX "AdmissionApplication_currentStage_idx" ON "AdmissionApplication"("currentStage");

-- CreateIndex
CREATE INDEX "AdmissionApplication_offerExpiryDate_idx" ON "AdmissionApplication"("offerExpiryDate");

-- CreateIndex
CREATE INDEX "AdmissionApplication_placementVerified_idx" ON "AdmissionApplication"("placementVerified");

-- CreateIndex
CREATE INDEX "AdmissionDocument_verificationStatus_idx" ON "AdmissionDocument"("verificationStatus");

-- AddForeignKey
ALTER TABLE "AdmissionInterview" ADD CONSTRAINT "AdmissionInterview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionDecision" ADD CONSTRAINT "AdmissionDecision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionCondition" ADD CONSTRAINT "AdmissionCondition_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "AdmissionDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionAppeal" ADD CONSTRAINT "AdmissionAppeal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionOffer" ADD CONSTRAINT "AdmissionOffer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
