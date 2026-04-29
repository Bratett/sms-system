-- CreateEnum
CREATE TYPE "AlumniEventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RsvpResponse" AS ENUM ('YES', 'NO', 'MAYBE');

-- CreateTable
CREATE TABLE "AlumniEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "virtualLink" TEXT,
    "capacity" INTEGER,
    "maxGuestsPerRsvp" INTEGER NOT NULL DEFAULT 0,
    "rsvpDeadline" TIMESTAMP(3),
    "status" "AlumniEventStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlumniEventRsvp" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "alumniProfileId" TEXT NOT NULL,
    "response" "RsvpResponse" NOT NULL,
    "guestCount" INTEGER NOT NULL DEFAULT 0,
    "waitlisted" BOOLEAN NOT NULL DEFAULT false,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniEventRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlumniEvent_schoolId_status_startAt_idx" ON "AlumniEvent"("schoolId", "status", "startAt");

-- CreateIndex
CREATE INDEX "AlumniEvent_schoolId_startAt_idx" ON "AlumniEvent"("schoolId", "startAt");

-- CreateIndex
CREATE INDEX "AlumniEvent_createdByUserId_idx" ON "AlumniEvent"("createdByUserId");

-- CreateIndex
CREATE INDEX "AlumniEventRsvp_eventId_response_idx" ON "AlumniEventRsvp"("eventId", "response");

-- CreateIndex
CREATE INDEX "AlumniEventRsvp_alumniProfileId_idx" ON "AlumniEventRsvp"("alumniProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniEventRsvp_eventId_alumniProfileId_key" ON "AlumniEventRsvp"("eventId", "alumniProfileId");

-- AddForeignKey
ALTER TABLE "AlumniEvent" ADD CONSTRAINT "AlumniEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlumniEvent" ADD CONSTRAINT "AlumniEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlumniEventRsvp" ADD CONSTRAINT "AlumniEventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AlumniEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlumniEventRsvp" ADD CONSTRAINT "AlumniEventRsvp_alumniProfileId_fkey" FOREIGN KEY ("alumniProfileId") REFERENCES "AlumniProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
