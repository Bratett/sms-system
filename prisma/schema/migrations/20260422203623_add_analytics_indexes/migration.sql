-- CreateIndex
CREATE INDEX "Enrollment_academicYearId_isFreeShsPlacement_idx" ON "Enrollment"("academicYearId", "isFreeShsPlacement");

-- CreateIndex
CREATE INDEX "Student_schoolId_region_status_idx" ON "Student"("schoolId", "region", "status");

-- CreateIndex
CREATE INDEX "Student_schoolId_religion_status_idx" ON "Student"("schoolId", "religion", "status");
