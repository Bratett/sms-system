-- AlterTable
ALTER TABLE "Guardian" ADD COLUMN     "householdId" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "householdId" TEXT;

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Household_schoolId_idx" ON "Household"("schoolId");

-- CreateIndex
CREATE INDEX "Household_schoolId_name_idx" ON "Household"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Guardian_householdId_idx" ON "Guardian"("householdId");

-- CreateIndex
CREATE INDEX "Student_householdId_idx" ON "Student"("householdId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
