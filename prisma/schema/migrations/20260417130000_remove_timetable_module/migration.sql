-- DropForeignKey
ALTER TABLE "TeacherAvailability" DROP CONSTRAINT "TeacherAvailability_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "TeacherPreference" DROP CONSTRAINT "TeacherPreference_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableConfig" DROP CONSTRAINT "TimetableConfig_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableSlot" DROP CONSTRAINT "TimetableSlot_academicYearId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableSlot" DROP CONSTRAINT "TimetableSlot_classArmId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableSlot" DROP CONSTRAINT "TimetableSlot_periodId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableSlot" DROP CONSTRAINT "TimetableSlot_roomId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableSlot" DROP CONSTRAINT "TimetableSlot_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableSlot" DROP CONSTRAINT "TimetableSlot_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableSlot" DROP CONSTRAINT "TimetableSlot_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableSlot" DROP CONSTRAINT "TimetableSlot_termId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableSubstitution" DROP CONSTRAINT "TimetableSubstitution_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableSubstitution" DROP CONSTRAINT "TimetableSubstitution_timetableSlotId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableVersion" DROP CONSTRAINT "TimetableVersion_schoolId_fkey";

-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "periodsPerWeek",
DROP COLUMN "preferredRoomType",
DROP COLUMN "requiresDouble";

-- DropTable
DROP TABLE "TeacherAvailability";

-- DropTable
DROP TABLE "TeacherPreference";

-- DropTable
DROP TABLE "TimetableConfig";

-- DropTable
DROP TABLE "TimetableSlot";

-- DropTable
DROP TABLE "TimetableSubstitution";

-- DropTable
DROP TABLE "TimetableVersion";

-- DropEnum
DROP TYPE "SubstitutionStatus";

-- DropEnum
DROP TYPE "TimetableVersionStatus";

