-- CreateEnum
CREATE TYPE "FeeItemType" AS ENUM ('TUITION', 'BOARDING', 'FEEDING', 'PTA', 'BOOKS', 'OTHER');

-- AlterTable
ALTER TABLE "FeeItem" ADD COLUMN     "type" "FeeItemType" NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX "FeeItem_type_idx" ON "FeeItem"("type");
