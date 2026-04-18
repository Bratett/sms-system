/*
  AdmissionDocument file field consolidation:
   1. Backfill fileKey from the legacy fileUrl for any rows added before Phase 1.
   2. Drop the legacy fileUrl column.
   3. Make fileKey non-null going forward.

  Rollback note: to restore fileUrl, re-add it as TEXT and UPDATE ... SET fileUrl = fileKey.
*/

-- 1. Backfill fileKey from legacy fileUrl where fileKey is still null.
UPDATE "AdmissionDocument" SET "fileKey" = "fileUrl" WHERE "fileKey" IS NULL;

-- 2. Drop legacy column + 3. require fileKey.
ALTER TABLE "AdmissionDocument" DROP COLUMN "fileUrl",
ALTER COLUMN "fileKey" SET NOT NULL;
