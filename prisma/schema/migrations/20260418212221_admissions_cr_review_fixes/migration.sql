/*
  Review-feedback follow-ups:
    1. Narrow `AdmissionDecision.decision` from the full `AdmissionStatus` enum
       to a new `AdmissionDecisionType` with exactly four outcomes. Copy
       existing values through a string cast — the four names overlap.
    2. Add `School` foreign-key constraints on AdmissionInterview/Decision/
       Appeal/Offer so deletes are restricted and tenant scope is enforced
       at the DB level.
    3. Add `AdmissionApplication.offerExpiryWarningSentAt` to gate repeat
       "offer expiring" notifications from the hourly scheduler.
    4. Best-effort backfill of obvious tuition FeeItem rows so Free-SHS
       billing waivers take effect without manual reclassification for the
       common case (name ILIKE '%tuition%'). Other categories stay OTHER.
*/

-- 1a. Create the narrow decision-outcome enum.
CREATE TYPE "AdmissionDecisionType" AS ENUM ('ACCEPTED', 'CONDITIONAL_ACCEPT', 'WAITLISTED', 'REJECTED');

-- 1b. Migrate AdmissionDecision.decision without dropping existing rows.
--     The old column used AdmissionStatus; the four decision values map 1:1.
ALTER TABLE "AdmissionDecision" ADD COLUMN "decision_new" "AdmissionDecisionType";
UPDATE "AdmissionDecision"
SET "decision_new" = CASE "decision"::text
    WHEN 'ACCEPTED' THEN 'ACCEPTED'::"AdmissionDecisionType"
    WHEN 'CONDITIONAL_ACCEPT' THEN 'CONDITIONAL_ACCEPT'::"AdmissionDecisionType"
    WHEN 'WAITLISTED' THEN 'WAITLISTED'::"AdmissionDecisionType"
    WHEN 'REJECTED' THEN 'REJECTED'::"AdmissionDecisionType"
    ELSE NULL
  END;
-- Defensive: any decision row whose value isn't one of the four is orphaned
-- data (invalid state) and cannot be honoured by the new type.
DELETE FROM "AdmissionDecision" WHERE "decision_new" IS NULL;
ALTER TABLE "AdmissionDecision" DROP COLUMN "decision";
ALTER TABLE "AdmissionDecision" RENAME COLUMN "decision_new" TO "decision";
ALTER TABLE "AdmissionDecision" ALTER COLUMN "decision" SET NOT NULL;

-- 2. School FK constraints on the four new admission models.
ALTER TABLE "AdmissionInterview"
  ADD CONSTRAINT "AdmissionInterview_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdmissionDecision"
  ADD CONSTRAINT "AdmissionDecision_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdmissionAppeal"
  ADD CONSTRAINT "AdmissionAppeal_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdmissionOffer"
  ADD CONSTRAINT "AdmissionOffer_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Offer-expiry warning dedup column.
ALTER TABLE "AdmissionApplication" ADD COLUMN "offerExpiryWarningSentAt" TIMESTAMP(3);

-- 4. Best-effort tuition backfill so Free-SHS billing skips obvious rows.
--    Schools with non-standard naming should reclassify remaining items via
--    the Fee Structure UI after this migration runs.
UPDATE "FeeItem"
SET "type" = 'TUITION'::"FeeItemType"
WHERE "type" = 'OTHER'::"FeeItemType"
  AND ("name" ILIKE '%tuition%' OR "name" ILIKE '%school fees%');
