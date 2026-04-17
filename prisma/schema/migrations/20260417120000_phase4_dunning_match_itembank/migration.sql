-- Phase 4: Finance dunning engine, inventory 3-way match, assessments item bank.

-- ─── Dunning Engine ──────────────────────────────────────────────────

CREATE TYPE "DunningPolicyScope" AS ENUM (
  'ALL_OUTSTANDING', 'PROGRAMME', 'FEE_STRUCTURE', 'BOARDING_ONLY', 'DAY_ONLY'
);
CREATE TYPE "DunningTrigger"    AS ENUM ('MANUAL', 'SCHEDULED', 'WEBHOOK');
CREATE TYPE "DunningRunStatus"  AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "DunningCaseStatus" AS ENUM ('OPEN', 'ESCALATED', 'PAUSED', 'RESOLVED', 'CLOSED');
CREATE TYPE "DunningEventStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED');

CREATE TABLE "DunningPolicy" (
    "id"                    TEXT NOT NULL,
    "schoolId"              TEXT NOT NULL,
    "name"                  TEXT NOT NULL,
    "description"           TEXT,
    "scope"                 "DunningPolicyScope" NOT NULL DEFAULT 'ALL_OUTSTANDING',
    "programmeId"           TEXT,
    "feeStructureId"        TEXT,
    "boardingStatus"        "BoardingStatus",
    "minBalance"            DECIMAL(18,2) NOT NULL DEFAULT 0,
    "suppressOnInstallment" BOOLEAN NOT NULL DEFAULT true,
    "suppressOnAid"         BOOLEAN NOT NULL DEFAULT true,
    "isActive"              BOOLEAN NOT NULL DEFAULT true,
    "createdBy"             TEXT NOT NULL,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DunningPolicy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DunningPolicy_schoolId_idx" ON "DunningPolicy"("schoolId");
CREATE INDEX "DunningPolicy_isActive_idx" ON "DunningPolicy"("isActive");

CREATE TABLE "DunningStage" (
    "id"             TEXT NOT NULL,
    "policyId"       TEXT NOT NULL,
    "schoolId"       TEXT NOT NULL,
    "order"          INTEGER NOT NULL,
    "name"           TEXT NOT NULL,
    "daysOverdue"    INTEGER NOT NULL,
    "channels"       TEXT[] NOT NULL,
    "templateKey"    TEXT,
    "applyPenaltyId" TEXT,
    "escalateToRole" TEXT,
    "blockPortal"    BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DunningStage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DunningStage_policyId_order_key" ON "DunningStage"("policyId", "order");
CREATE INDEX "DunningStage_policyId_idx" ON "DunningStage"("policyId");
CREATE INDEX "DunningStage_schoolId_idx" ON "DunningStage"("schoolId");

ALTER TABLE "DunningStage"
  ADD CONSTRAINT "DunningStage_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "DunningPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DunningRun" (
    "id"             TEXT NOT NULL,
    "schoolId"       TEXT NOT NULL,
    "policyId"       TEXT NOT NULL,
    "triggeredBy"    TEXT NOT NULL,
    "triggerType"    "DunningTrigger" NOT NULL DEFAULT 'MANUAL',
    "status"         "DunningRunStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"    TIMESTAMP(3),
    "totalBills"     INTEGER NOT NULL DEFAULT 0,
    "casesCreated"   INTEGER NOT NULL DEFAULT 0,
    "casesEscalated" INTEGER NOT NULL DEFAULT 0,
    "casesResolved"  INTEGER NOT NULL DEFAULT 0,
    "eventsSent"     INTEGER NOT NULL DEFAULT 0,
    "errors"         INTEGER NOT NULL DEFAULT 0,
    "summary"        JSONB,
    CONSTRAINT "DunningRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DunningRun_schoolId_idx"  ON "DunningRun"("schoolId");
CREATE INDEX "DunningRun_policyId_idx"  ON "DunningRun"("policyId");
CREATE INDEX "DunningRun_status_idx"    ON "DunningRun"("status");
CREATE INDEX "DunningRun_startedAt_idx" ON "DunningRun"("startedAt");

ALTER TABLE "DunningRun"
  ADD CONSTRAINT "DunningRun_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "DunningPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DunningCase" (
    "id"             TEXT NOT NULL,
    "schoolId"       TEXT NOT NULL,
    "policyId"       TEXT NOT NULL,
    "studentBillId"  TEXT NOT NULL,
    "studentId"      TEXT NOT NULL,
    "currentStageId" TEXT,
    "stagesCleared"  INTEGER NOT NULL DEFAULT 0,
    "status"         "DunningCaseStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActionAt"   TIMESTAMP(3),
    "resolvedAt"     TIMESTAMP(3),
    "resolution"     TEXT,
    CONSTRAINT "DunningCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DunningCase_studentBillId_policyId_key"
  ON "DunningCase"("studentBillId", "policyId");
CREATE INDEX "DunningCase_schoolId_idx"      ON "DunningCase"("schoolId");
CREATE INDEX "DunningCase_policyId_idx"      ON "DunningCase"("policyId");
CREATE INDEX "DunningCase_studentBillId_idx" ON "DunningCase"("studentBillId");
CREATE INDEX "DunningCase_status_idx"        ON "DunningCase"("status");

ALTER TABLE "DunningCase"
  ADD CONSTRAINT "DunningCase_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "DunningPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DunningEvent" (
    "id"            TEXT NOT NULL,
    "schoolId"      TEXT NOT NULL,
    "runId"         TEXT,
    "caseId"        TEXT NOT NULL,
    "stageId"       TEXT,
    "stageOrder"    INTEGER NOT NULL,
    "studentBillId" TEXT NOT NULL,
    "studentId"     TEXT NOT NULL,
    "channel"       TEXT NOT NULL,
    "status"        "DunningEventStatus" NOT NULL DEFAULT 'PENDING',
    "templateKey"   TEXT,
    "payload"       JSONB,
    "externalRef"   TEXT,
    "errorMessage"  TEXT,
    "occurredAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DunningEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DunningEvent_schoolId_idx"   ON "DunningEvent"("schoolId");
CREATE INDEX "DunningEvent_runId_idx"      ON "DunningEvent"("runId");
CREATE INDEX "DunningEvent_caseId_idx"     ON "DunningEvent"("caseId");
CREATE INDEX "DunningEvent_occurredAt_idx" ON "DunningEvent"("occurredAt");
CREATE INDEX "DunningEvent_status_idx"     ON "DunningEvent"("status");

ALTER TABLE "DunningEvent"
  ADD CONSTRAINT "DunningEvent_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "DunningRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DunningEvent"
  ADD CONSTRAINT "DunningEvent_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "DunningCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "DunningPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DunningPolicy" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DunningPolicy ON "DunningPolicy"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "DunningStage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DunningStage" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DunningStage ON "DunningStage"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "DunningRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DunningRun" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DunningRun ON "DunningRun"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "DunningCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DunningCase" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DunningCase ON "DunningCase"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "DunningEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DunningEvent" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DunningEvent ON "DunningEvent"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

-- ─── Supplier Invoices & 3-Way Match ────────────────────────────────

CREATE TYPE "SupplierInvoiceStatus" AS ENUM (
  'RECEIVED', 'MATCHED', 'VARIANCE', 'APPROVED', 'PAID', 'REJECTED', 'VOIDED'
);
CREATE TYPE "ThreeWayMatchResult" AS ENUM (
  'PENDING', 'CLEAN', 'PRICE_VARIANCE', 'QUANTITY_VARIANCE',
  'MISSING_GRN', 'PO_MISMATCH', 'FAILED'
);

CREATE TABLE "SupplierInvoice" (
    "id"              TEXT NOT NULL,
    "schoolId"        TEXT NOT NULL,
    "supplierId"      TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "invoiceNumber"   TEXT NOT NULL,
    "invoiceDate"     TIMESTAMP(3) NOT NULL,
    "dueDate"         TIMESTAMP(3),
    "subTotal"        DECIMAL(18,2) NOT NULL,
    "taxAmount"       DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount"     DECIMAL(18,2) NOT NULL,
    "currency"        TEXT NOT NULL DEFAULT 'GHS',
    "status"          "SupplierInvoiceStatus" NOT NULL DEFAULT 'RECEIVED',
    "notes"           TEXT,
    "documentUrl"     TEXT,
    "receivedBy"      TEXT NOT NULL,
    "receivedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy"      TEXT,
    "approvedAt"      TIMESTAMP(3),
    "rejectedReason"  TEXT,
    "paidAt"          TIMESTAMP(3),
    "paymentRef"      TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupplierInvoice_supplierId_invoiceNumber_key"
  ON "SupplierInvoice"("supplierId", "invoiceNumber");
CREATE INDEX "SupplierInvoice_schoolId_idx"        ON "SupplierInvoice"("schoolId");
CREATE INDEX "SupplierInvoice_supplierId_idx"      ON "SupplierInvoice"("supplierId");
CREATE INDEX "SupplierInvoice_purchaseOrderId_idx" ON "SupplierInvoice"("purchaseOrderId");
CREATE INDEX "SupplierInvoice_status_idx"          ON "SupplierInvoice"("status");
CREATE INDEX "SupplierInvoice_dueDate_idx"         ON "SupplierInvoice"("dueDate");

CREATE TABLE "SupplierInvoiceItem" (
    "id"                  TEXT NOT NULL,
    "supplierInvoiceId"   TEXT NOT NULL,
    "schoolId"            TEXT NOT NULL,
    "storeItemId"         TEXT,
    "purchaseOrderItemId" TEXT,
    "description"         TEXT NOT NULL,
    "quantity"            DECIMAL(18,4) NOT NULL,
    "unitPrice"           DECIMAL(18,4) NOT NULL,
    "lineTotal"           DECIMAL(18,2) NOT NULL,
    "taxRate"             DECIMAL(5,2),
    CONSTRAINT "SupplierInvoiceItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupplierInvoiceItem_supplierInvoiceId_idx"   ON "SupplierInvoiceItem"("supplierInvoiceId");
CREATE INDEX "SupplierInvoiceItem_schoolId_idx"            ON "SupplierInvoiceItem"("schoolId");
CREATE INDEX "SupplierInvoiceItem_purchaseOrderItemId_idx" ON "SupplierInvoiceItem"("purchaseOrderItemId");

ALTER TABLE "SupplierInvoiceItem"
  ADD CONSTRAINT "SupplierInvoiceItem_supplierInvoiceId_fkey"
  FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MatchToleranceSetting" (
    "id"                       TEXT NOT NULL,
    "schoolId"                 TEXT NOT NULL,
    "priceTolerancePercent"    DECIMAL(5,2)  NOT NULL DEFAULT 0,
    "priceToleranceAbsolute"   DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quantityTolerancePercent" DECIMAL(5,2)  NOT NULL DEFAULT 0,
    "autoApproveClean"         BOOLEAN NOT NULL DEFAULT false,
    "requireGoodsReceived"     BOOLEAN NOT NULL DEFAULT true,
    "updatedBy"                TEXT NOT NULL,
    "updatedAt"                TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MatchToleranceSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatchToleranceSetting_schoolId_key" ON "MatchToleranceSetting"("schoolId");
CREATE INDEX "MatchToleranceSetting_schoolId_idx" ON "MatchToleranceSetting"("schoolId");

CREATE TABLE "ThreeWayMatch" (
    "id"                TEXT NOT NULL,
    "schoolId"          TEXT NOT NULL,
    "supplierInvoiceId" TEXT NOT NULL,
    "purchaseOrderId"   TEXT NOT NULL,
    "goodsReceivedId"   TEXT,
    "result"            "ThreeWayMatchResult" NOT NULL DEFAULT 'PENDING',
    "priceVariance"     DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quantityVariance"  DECIMAL(18,4) NOT NULL DEFAULT 0,
    "withinTolerance"   BOOLEAN NOT NULL DEFAULT false,
    "autoApproved"      BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy"        TEXT,
    "reviewedAt"        TIMESTAMP(3),
    "reviewNotes"       TEXT,
    "summary"           JSONB,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ThreeWayMatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ThreeWayMatch_supplierInvoiceId_purchaseOrderId_key"
  ON "ThreeWayMatch"("supplierInvoiceId", "purchaseOrderId");
CREATE INDEX "ThreeWayMatch_schoolId_idx"         ON "ThreeWayMatch"("schoolId");
CREATE INDEX "ThreeWayMatch_result_idx"           ON "ThreeWayMatch"("result");
CREATE INDEX "ThreeWayMatch_purchaseOrderId_idx"  ON "ThreeWayMatch"("purchaseOrderId");

ALTER TABLE "ThreeWayMatch"
  ADD CONSTRAINT "ThreeWayMatch_supplierInvoiceId_fkey"
  FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS on invoice tables
ALTER TABLE "SupplierInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierInvoice" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_SupplierInvoice ON "SupplierInvoice"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "SupplierInvoiceItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierInvoiceItem" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_SupplierInvoiceItem ON "SupplierInvoiceItem"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "MatchToleranceSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MatchToleranceSetting" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_MatchToleranceSetting ON "MatchToleranceSetting"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ThreeWayMatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ThreeWayMatch" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ThreeWayMatch ON "ThreeWayMatch"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

-- ─── Item Bank ───────────────────────────────────────────────────────

CREATE TYPE "ItemBankQuestionType" AS ENUM (
  'MULTIPLE_CHOICE', 'MULTI_SELECT', 'TRUE_FALSE', 'SHORT_ANSWER',
  'FILL_IN_BLANK', 'ESSAY', 'MATCHING', 'NUMERIC'
);
CREATE TYPE "ItemBankDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE "BloomLevel" AS ENUM (
  'REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'
);
CREATE TYPE "ItemBankQuestionStatus" AS ENUM (
  'DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'RETIRED'
);
CREATE TYPE "ItemBankPaperStatus" AS ENUM (
  'DRAFT', 'READY', 'PUBLISHED', 'ARCHIVED'
);

CREATE TABLE "ItemBankQuestion" (
    "id"          TEXT NOT NULL,
    "schoolId"    TEXT NOT NULL,
    "subjectId"   TEXT NOT NULL,
    "topic"       TEXT,
    "stem"        TEXT NOT NULL,
    "type"        "ItemBankQuestionType" NOT NULL,
    "difficulty"  "ItemBankDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "bloomLevel"  "BloomLevel" NOT NULL DEFAULT 'UNDERSTAND',
    "maxScore"    DOUBLE PRECISION NOT NULL DEFAULT 1,
    "explanation" TEXT,
    "correctText" TEXT,
    "metadata"    JSONB,
    "status"      "ItemBankQuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "authoredBy"  TEXT NOT NULL,
    "reviewedBy"  TEXT,
    "reviewedAt"  TIMESTAMP(3),
    "usageCount"  INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ItemBankQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ItemBankQuestion_schoolId_idx"    ON "ItemBankQuestion"("schoolId");
CREATE INDEX "ItemBankQuestion_subjectId_idx"   ON "ItemBankQuestion"("subjectId");
CREATE INDEX "ItemBankQuestion_difficulty_idx"  ON "ItemBankQuestion"("difficulty");
CREATE INDEX "ItemBankQuestion_status_idx"      ON "ItemBankQuestion"("status");
CREATE INDEX "ItemBankQuestion_bloomLevel_idx"  ON "ItemBankQuestion"("bloomLevel");
CREATE INDEX "ItemBankQuestion_schoolId_subjectId_status_idx"
  ON "ItemBankQuestion"("schoolId", "subjectId", "status");

CREATE TABLE "ItemBankChoice" (
    "id"          TEXT NOT NULL,
    "questionId"  TEXT NOT NULL,
    "schoolId"    TEXT NOT NULL,
    "text"        TEXT NOT NULL,
    "isCorrect"   BOOLEAN NOT NULL DEFAULT false,
    "order"       INTEGER NOT NULL DEFAULT 0,
    "explanation" TEXT,
    CONSTRAINT "ItemBankChoice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ItemBankChoice_questionId_idx" ON "ItemBankChoice"("questionId");
CREATE INDEX "ItemBankChoice_schoolId_idx"   ON "ItemBankChoice"("schoolId");

ALTER TABLE "ItemBankChoice"
  ADD CONSTRAINT "ItemBankChoice_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "ItemBankQuestion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ItemBankTag" (
    "id"       TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name"     TEXT NOT NULL,
    "color"    TEXT,
    CONSTRAINT "ItemBankTag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ItemBankTag_schoolId_name_key" ON "ItemBankTag"("schoolId", "name");
CREATE INDEX "ItemBankTag_schoolId_idx" ON "ItemBankTag"("schoolId");

CREATE TABLE "ItemBankQuestionTag" (
    "questionId" TEXT NOT NULL,
    "tagId"      TEXT NOT NULL,
    "schoolId"   TEXT NOT NULL,
    CONSTRAINT "ItemBankQuestionTag_pkey" PRIMARY KEY ("questionId", "tagId")
);
CREATE INDEX "ItemBankQuestionTag_tagId_idx"    ON "ItemBankQuestionTag"("tagId");
CREATE INDEX "ItemBankQuestionTag_schoolId_idx" ON "ItemBankQuestionTag"("schoolId");

ALTER TABLE "ItemBankQuestionTag"
  ADD CONSTRAINT "ItemBankQuestionTag_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "ItemBankQuestion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemBankQuestionTag"
  ADD CONSTRAINT "ItemBankQuestionTag_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "ItemBankTag"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ItemBankPaper" (
    "id"             TEXT NOT NULL,
    "schoolId"       TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "subjectId"      TEXT NOT NULL,
    "yearGroup"      INTEGER,
    "termId"         TEXT,
    "academicYearId" TEXT,
    "totalScore"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMins"   INTEGER,
    "instructions"   TEXT,
    "status"         "ItemBankPaperStatus" NOT NULL DEFAULT 'DRAFT',
    "generatorSpec"  JSONB,
    "createdBy"      TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ItemBankPaper_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ItemBankPaper_schoolId_idx"  ON "ItemBankPaper"("schoolId");
CREATE INDEX "ItemBankPaper_subjectId_idx" ON "ItemBankPaper"("subjectId");
CREATE INDEX "ItemBankPaper_status_idx"    ON "ItemBankPaper"("status");

CREATE TABLE "ItemBankPaperQuestion" (
    "id"            TEXT NOT NULL,
    "paperId"       TEXT NOT NULL,
    "questionId"    TEXT NOT NULL,
    "schoolId"      TEXT NOT NULL,
    "order"         INTEGER NOT NULL,
    "scoreOverride" DOUBLE PRECISION,
    CONSTRAINT "ItemBankPaperQuestion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ItemBankPaperQuestion_paperId_questionId_key"
  ON "ItemBankPaperQuestion"("paperId", "questionId");
CREATE UNIQUE INDEX "ItemBankPaperQuestion_paperId_order_key"
  ON "ItemBankPaperQuestion"("paperId", "order");
CREATE INDEX "ItemBankPaperQuestion_paperId_idx"    ON "ItemBankPaperQuestion"("paperId");
CREATE INDEX "ItemBankPaperQuestion_questionId_idx" ON "ItemBankPaperQuestion"("questionId");
CREATE INDEX "ItemBankPaperQuestion_schoolId_idx"   ON "ItemBankPaperQuestion"("schoolId");

ALTER TABLE "ItemBankPaperQuestion"
  ADD CONSTRAINT "ItemBankPaperQuestion_paperId_fkey"
  FOREIGN KEY ("paperId") REFERENCES "ItemBankPaper"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemBankPaperQuestion"
  ADD CONSTRAINT "ItemBankPaperQuestion_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "ItemBankQuestion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS on item bank
ALTER TABLE "ItemBankQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemBankQuestion" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ItemBankQuestion ON "ItemBankQuestion"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ItemBankChoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemBankChoice" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ItemBankChoice ON "ItemBankChoice"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ItemBankTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemBankTag" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ItemBankTag ON "ItemBankTag"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ItemBankQuestionTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemBankQuestionTag" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ItemBankQuestionTag ON "ItemBankQuestionTag"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ItemBankPaper" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemBankPaper" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ItemBankPaper ON "ItemBankPaper"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ItemBankPaperQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemBankPaperQuestion" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ItemBankPaperQuestion ON "ItemBankPaperQuestion"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));
