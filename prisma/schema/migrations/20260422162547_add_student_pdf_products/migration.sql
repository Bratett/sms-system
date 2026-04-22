-- CreateEnum
CREATE TYPE "PdfJobKind" AS ENUM ('ID_CARD_BATCH', 'REPORT_CARD_BATCH', 'TRANSCRIPT_BATCH');

-- CreateEnum
CREATE TYPE "PdfJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETE', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "idCardCacheInvalidatedAt" TIMESTAMP(3),
ADD COLUMN     "idCardCachedAt" TIMESTAMP(3),
ADD COLUMN     "idCardPdfKey" TEXT;

-- AlterTable
ALTER TABLE "Transcript" ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "issuedBy" TEXT,
ADD COLUMN     "pdfKey" TEXT;

-- CreateTable
CREATE TABLE "ReportCardPdfCache" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "renderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renderedBy" TEXT NOT NULL,
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCardPdfCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfJob" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" "PdfJobKind" NOT NULL,
    "status" "PdfJobStatus" NOT NULL DEFAULT 'QUEUED',
    "params" JSONB NOT NULL,
    "totalItems" INTEGER NOT NULL,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "resultFileKey" TEXT,
    "error" TEXT,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PdfJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportCardPdfCache_schoolId_idx" ON "ReportCardPdfCache"("schoolId");

-- CreateIndex
CREATE INDEX "ReportCardPdfCache_termId_idx" ON "ReportCardPdfCache"("termId");

-- CreateIndex
CREATE INDEX "ReportCardPdfCache_invalidatedAt_idx" ON "ReportCardPdfCache"("invalidatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardPdfCache_studentId_termId_key" ON "ReportCardPdfCache"("studentId", "termId");

-- CreateIndex
CREATE INDEX "PdfJob_schoolId_idx" ON "PdfJob"("schoolId");

-- CreateIndex
CREATE INDEX "PdfJob_status_idx" ON "PdfJob"("status");

-- CreateIndex
CREATE INDEX "PdfJob_requestedBy_idx" ON "PdfJob"("requestedBy");

-- CreateIndex
CREATE INDEX "PdfJob_schoolId_status_idx" ON "PdfJob"("schoolId", "status");

-- AddForeignKey
ALTER TABLE "ReportCardPdfCache" ADD CONSTRAINT "ReportCardPdfCache_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardPdfCache" ADD CONSTRAINT "ReportCardPdfCache_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardPdfCache" ADD CONSTRAINT "ReportCardPdfCache_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfJob" ADD CONSTRAINT "PdfJob_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
