-- CreateEnum
CREATE TYPE "ExcuseRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "MedicalDisclosureCategory" AS ENUM ('ALLERGY', 'CONDITION', 'MEDICATION');

-- CreateEnum
CREATE TYPE "MedicalDisclosureStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "ExcuseRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "attachmentKey" TEXT,
    "attachmentName" TEXT,
    "attachmentSize" INTEGER,
    "attachmentMime" TEXT,
    "status" "ExcuseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerUserId" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcuseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalDisclosure" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "category" "MedicalDisclosureCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "attachmentKey" TEXT,
    "attachmentName" TEXT,
    "attachmentSize" INTEGER,
    "attachmentMime" TEXT,
    "status" "MedicalDisclosureStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerUserId" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resultingMedicalRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalDisclosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExcuseRequest_schoolId_status_idx" ON "ExcuseRequest"("schoolId", "status");

-- CreateIndex
CREATE INDEX "ExcuseRequest_studentId_status_idx" ON "ExcuseRequest"("studentId", "status");

-- CreateIndex
CREATE INDEX "ExcuseRequest_submittedByUserId_idx" ON "ExcuseRequest"("submittedByUserId");

-- CreateIndex
CREATE INDEX "ExcuseRequest_fromDate_toDate_idx" ON "ExcuseRequest"("fromDate", "toDate");

-- CreateIndex
CREATE INDEX "MedicalDisclosure_schoolId_status_idx" ON "MedicalDisclosure"("schoolId", "status");

-- CreateIndex
CREATE INDEX "MedicalDisclosure_schoolId_status_isUrgent_idx" ON "MedicalDisclosure"("schoolId", "status", "isUrgent");

-- CreateIndex
CREATE INDEX "MedicalDisclosure_studentId_status_idx" ON "MedicalDisclosure"("studentId", "status");

-- CreateIndex
CREATE INDEX "MedicalDisclosure_submittedByUserId_idx" ON "MedicalDisclosure"("submittedByUserId");

-- AddForeignKey
ALTER TABLE "ExcuseRequest" ADD CONSTRAINT "ExcuseRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcuseRequest" ADD CONSTRAINT "ExcuseRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcuseRequest" ADD CONSTRAINT "ExcuseRequest_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcuseRequest" ADD CONSTRAINT "ExcuseRequest_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalDisclosure" ADD CONSTRAINT "MedicalDisclosure_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalDisclosure" ADD CONSTRAINT "MedicalDisclosure_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalDisclosure" ADD CONSTRAINT "MedicalDisclosure_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalDisclosure" ADD CONSTRAINT "MedicalDisclosure_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
