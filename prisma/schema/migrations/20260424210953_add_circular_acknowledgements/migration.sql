-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "lastReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "requiresAcknowledgement" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CircularAcknowledgement" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "acknowledgedByUserId" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircularAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CircularAcknowledgement_announcementId_idx" ON "CircularAcknowledgement"("announcementId");

-- CreateIndex
CREATE INDEX "CircularAcknowledgement_householdId_idx" ON "CircularAcknowledgement"("householdId");

-- CreateIndex
CREATE INDEX "CircularAcknowledgement_acknowledgedByUserId_idx" ON "CircularAcknowledgement"("acknowledgedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CircularAcknowledgement_announcementId_householdId_key" ON "CircularAcknowledgement"("announcementId", "householdId");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_status_requiresAcknowledgement_idx" ON "Announcement"("schoolId", "status", "requiresAcknowledgement");

-- AddForeignKey
ALTER TABLE "CircularAcknowledgement" ADD CONSTRAINT "CircularAcknowledgement_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircularAcknowledgement" ADD CONSTRAINT "CircularAcknowledgement_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircularAcknowledgement" ADD CONSTRAINT "CircularAcknowledgement_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
