-- CreateEnum
CREATE TYPE "PromotionRunStatus" AS ENUM ('DRAFT', 'COMMITTED', 'REVERTED');

-- CreateEnum
CREATE TYPE "PromotionOutcome" AS ENUM ('PROMOTE', 'RETAIN', 'GRADUATE', 'WITHDRAW');

-- CreateTable
CREATE TABLE "PromotionRun" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sourceAcademicYearId" TEXT NOT NULL,
    "targetAcademicYearId" TEXT NOT NULL,
    "sourceClassArmId" TEXT NOT NULL,
    "status" "PromotionRunStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "committedAt" TIMESTAMP(3),
    "committedBy" TEXT,
    "revertedAt" TIMESTAMP(3),
    "revertedBy" TEXT,
    "revertReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRunItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "outcome" "PromotionOutcome" NOT NULL,
    "destinationClassArmId" TEXT,
    "previousEnrollmentId" TEXT NOT NULL,
    "previousStatus" "StudentStatus" NOT NULL,
    "newEnrollmentId" TEXT,
    "notes" TEXT,

    CONSTRAINT "PromotionRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromotionRun_schoolId_idx" ON "PromotionRun"("schoolId");

-- CreateIndex
CREATE INDEX "PromotionRun_status_idx" ON "PromotionRun"("status");

-- CreateIndex
CREATE INDEX "PromotionRun_sourceClassArmId_idx" ON "PromotionRun"("sourceClassArmId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRun_sourceClassArmId_sourceAcademicYearId_key" ON "PromotionRun"("sourceClassArmId", "sourceAcademicYearId");

-- CreateIndex
CREATE INDEX "PromotionRunItem_runId_idx" ON "PromotionRunItem"("runId");

-- CreateIndex
CREATE INDEX "PromotionRunItem_studentId_idx" ON "PromotionRunItem"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRunItem_runId_studentId_key" ON "PromotionRunItem"("runId", "studentId");

-- AddForeignKey
ALTER TABLE "PromotionRun" ADD CONSTRAINT "PromotionRun_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRun" ADD CONSTRAINT "PromotionRun_sourceAcademicYearId_fkey" FOREIGN KEY ("sourceAcademicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRun" ADD CONSTRAINT "PromotionRun_targetAcademicYearId_fkey" FOREIGN KEY ("targetAcademicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRun" ADD CONSTRAINT "PromotionRun_sourceClassArmId_fkey" FOREIGN KEY ("sourceClassArmId") REFERENCES "ClassArm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRunItem" ADD CONSTRAINT "PromotionRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PromotionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRunItem" ADD CONSTRAINT "PromotionRunItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRunItem" ADD CONSTRAINT "PromotionRunItem_destinationClassArmId_fkey" FOREIGN KEY ("destinationClassArmId") REFERENCES "ClassArm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
