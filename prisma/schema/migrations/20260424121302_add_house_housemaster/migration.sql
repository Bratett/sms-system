-- AlterTable
ALTER TABLE "House" ADD COLUMN     "housemasterId" TEXT;

-- CreateIndex
CREATE INDEX "House_housemasterId_idx" ON "House"("housemasterId");

-- AddForeignKey
ALTER TABLE "House" ADD CONSTRAINT "House_housemasterId_fkey" FOREIGN KEY ("housemasterId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
