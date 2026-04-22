-- DropIndex
DROP INDEX "PromotionRun_sourceClassArmId_sourceAcademicYearId_key";

-- CreateIndex
CREATE INDEX "PromotionRun_sourceClassArmId_sourceAcademicYearId_idx" ON "PromotionRun"("sourceClassArmId", "sourceAcademicYearId");

-- CreateIndex
CREATE INDEX "PromotionRun_schoolId_status_idx" ON "PromotionRun"("schoolId", "status");

-- CreateIndex
CREATE INDEX "PromotionRun_targetAcademicYearId_idx" ON "PromotionRun"("targetAcademicYearId");

-- AddForeignKey
ALTER TABLE "PromotionRunItem" ADD CONSTRAINT "PromotionRunItem_previousEnrollmentId_fkey" FOREIGN KEY ("previousEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRunItem" ADD CONSTRAINT "PromotionRunItem_newEnrollmentId_fkey" FOREIGN KEY ("newEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
