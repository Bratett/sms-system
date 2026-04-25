-- CreateTable
CREATE TABLE "ReportCardRelease" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "classArmId" TEXT NOT NULL,
    "releasedByUserId" TEXT,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCardRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCardAcknowledgement" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "acknowledgedByUserId" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportCardAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportCardRelease_schoolId_termId_idx" ON "ReportCardRelease"("schoolId", "termId");

-- CreateIndex
CREATE INDEX "ReportCardRelease_classArmId_idx" ON "ReportCardRelease"("classArmId");

-- CreateIndex
CREATE INDEX "ReportCardRelease_releasedByUserId_idx" ON "ReportCardRelease"("releasedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardRelease_termId_classArmId_key" ON "ReportCardRelease"("termId", "classArmId");

-- CreateIndex
CREATE INDEX "ReportCardAcknowledgement_releaseId_idx" ON "ReportCardAcknowledgement"("releaseId");

-- CreateIndex
CREATE INDEX "ReportCardAcknowledgement_studentId_idx" ON "ReportCardAcknowledgement"("studentId");

-- CreateIndex
CREATE INDEX "ReportCardAcknowledgement_householdId_idx" ON "ReportCardAcknowledgement"("householdId");

-- CreateIndex
CREATE INDEX "ReportCardAcknowledgement_acknowledgedByUserId_idx" ON "ReportCardAcknowledgement"("acknowledgedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardAcknowledgement_releaseId_studentId_householdId_key" ON "ReportCardAcknowledgement"("releaseId", "studentId", "householdId");

-- AddForeignKey
ALTER TABLE "ReportCardRelease" ADD CONSTRAINT "ReportCardRelease_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardRelease" ADD CONSTRAINT "ReportCardRelease_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardRelease" ADD CONSTRAINT "ReportCardRelease_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "ClassArm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardRelease" ADD CONSTRAINT "ReportCardRelease_releasedByUserId_fkey" FOREIGN KEY ("releasedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardAcknowledgement" ADD CONSTRAINT "ReportCardAcknowledgement_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ReportCardRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardAcknowledgement" ADD CONSTRAINT "ReportCardAcknowledgement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardAcknowledgement" ADD CONSTRAINT "ReportCardAcknowledgement_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardAcknowledgement" ADD CONSTRAINT "ReportCardAcknowledgement_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
