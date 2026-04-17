-- Item-bank grader: student submissions + per-question responses.

CREATE TYPE "ItemBankSubmissionStatus" AS ENUM (
  'IN_PROGRESS', 'SUBMITTED', 'GRADED', 'PARTIALLY_GRADED', 'VOIDED'
);
CREATE TYPE "ItemBankResponseVerdict" AS ENUM (
  'CORRECT', 'INCORRECT', 'PARTIAL', 'NEEDS_REVIEW'
);

CREATE TABLE "ItemBankSubmission" (
    "id"             TEXT NOT NULL,
    "schoolId"       TEXT NOT NULL,
    "paperId"        TEXT NOT NULL,
    "studentId"      TEXT NOT NULL,
    "attemptedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt"    TIMESTAMP(3),
    "timeSpentSecs"  INTEGER,
    "status"         "ItemBankSubmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "rawScore"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxScore"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoGraded"     BOOLEAN NOT NULL DEFAULT false,
    "needsReview"    BOOLEAN NOT NULL DEFAULT false,
    "gradedBy"       TEXT,
    "gradedAt"       TIMESTAMP(3),
    CONSTRAINT "ItemBankSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ItemBankSubmission_paperId_studentId_attemptedAt_key"
  ON "ItemBankSubmission"("paperId", "studentId", "attemptedAt");
CREATE INDEX "ItemBankSubmission_schoolId_idx"  ON "ItemBankSubmission"("schoolId");
CREATE INDEX "ItemBankSubmission_paperId_idx"   ON "ItemBankSubmission"("paperId");
CREATE INDEX "ItemBankSubmission_studentId_idx" ON "ItemBankSubmission"("studentId");
CREATE INDEX "ItemBankSubmission_status_idx"    ON "ItemBankSubmission"("status");

ALTER TABLE "ItemBankSubmission"
  ADD CONSTRAINT "ItemBankSubmission_paperId_fkey"
  FOREIGN KEY ("paperId") REFERENCES "ItemBankPaper"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ItemBankResponse" (
    "id"           TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId"   TEXT NOT NULL,
    "schoolId"     TEXT NOT NULL,
    "rawAnswer"    JSONB NOT NULL,
    "correct"      BOOLEAN,
    "awardedScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxScore"     DOUBLE PRECISION NOT NULL DEFAULT 1,
    "feedback"     TEXT,
    "verdict"      "ItemBankResponseVerdict" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "gradedAt"     TIMESTAMP(3),
    "gradedBy"     TEXT,
    CONSTRAINT "ItemBankResponse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ItemBankResponse_submissionId_questionId_key"
  ON "ItemBankResponse"("submissionId", "questionId");
CREATE INDEX "ItemBankResponse_submissionId_idx" ON "ItemBankResponse"("submissionId");
CREATE INDEX "ItemBankResponse_questionId_idx"   ON "ItemBankResponse"("questionId");
CREATE INDEX "ItemBankResponse_schoolId_idx"     ON "ItemBankResponse"("schoolId");

ALTER TABLE "ItemBankResponse"
  ADD CONSTRAINT "ItemBankResponse_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "ItemBankSubmission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemBankResponse"
  ADD CONSTRAINT "ItemBankResponse_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "ItemBankQuestion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "ItemBankSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemBankSubmission" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ItemBankSubmission ON "ItemBankSubmission"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ItemBankResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemBankResponse" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ItemBankResponse ON "ItemBankResponse"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));
