-- Backfill for a missing migration. The following tables exist in the Prisma
-- schema (boarding.prisma, inventory.prisma) and are referenced by the later
-- migration `20260402110000_add_schoolid_to_child_tables`, but no earlier
-- migration ever created them. As a result, `prisma migrate deploy` on a
-- clean database fails at that later step.
--
-- This migration reconciles the history by creating the missing tables here,
-- slotted immediately before the one that references them.
--
-- IDEMPOTENCY: every DDL statement is guarded so re-running against an
-- environment that already has these tables (e.g. an env that was bootstrapped
-- via `db push`) is a no-op. Such environments should mark this migration as
-- applied with `prisma migrate resolve --applied 20260402100000_create_missing_tables`.

-- ─── Enums (DO-blocks for existence check) ────────────────────────────

DO $$ BEGIN
  CREATE TYPE "BoardingIncidentCategory" AS ENUM (
    'CURFEW_VIOLATION','PROPERTY_DAMAGE','BULLYING','FIGHTING',
    'UNAUTHORIZED_ABSENCE','SUBSTANCE_ABUSE','THEFT','NOISE_DISTURBANCE',
    'HEALTH_EMERGENCY','SAFETY_HAZARD','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BoardingIncidentSeverity" AS ENUM ('MINOR','MODERATE','MAJOR','CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BoardingIncidentStatus" AS ENUM (
    'REPORTED','INVESTIGATING','ACTION_TAKEN','RESOLVED','ESCALATED','DISMISSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SickBaySeverity" AS ENUM ('MILD','MODERATE','SEVERE','EMERGENCY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SickBayStatus" AS ENUM ('ADMITTED','UNDER_OBSERVATION','DISCHARGED','REFERRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VisitorStatus" AS ENUM ('CHECKED_IN','CHECKED_OUT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BedTransferReason" AS ENUM (
    'STUDENT_REQUEST','DISCIPLINARY','MEDICAL','MAINTENANCE',
    'CONFLICT_RESOLUTION','REBALANCING','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BedTransferStatus" AS ENUM ('PENDING','APPROVED','COMPLETED','REJECTED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InspectionType" AS ENUM ('ROUTINE','SURPRISE','FOLLOW_UP','END_OF_TERM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InspectionRating" AS ENUM ('EXCELLENT','GOOD','FAIR','POOR','CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MaintenanceCategory" AS ENUM (
    'PLUMBING','ELECTRICAL','FURNITURE','STRUCTURAL','CLEANING',
    'PEST_CONTROL','SECURITY','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MaintenancePriority" AS ENUM ('LOW','MEDIUM','HIGH','URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TransferStatus" AS ENUM ('PENDING','APPROVED','IN_TRANSIT','RECEIVED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RequisitionStatus" AS ENUM (
    'PENDING','APPROVED','REJECTED','PARTIALLY_ISSUED','ISSUED','CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StockTakeStatus" AS ENUM ('PLANNED','IN_PROGRESS','COMPLETED','APPROVED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Boarding tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "BoardingIncident" (
    "id"                 TEXT NOT NULL,
    "schoolId"           TEXT NOT NULL,
    "incidentNumber"     TEXT NOT NULL,
    "hostelId"           TEXT NOT NULL,
    "dormitoryId"        TEXT,
    "studentIds"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "reportedBy"         TEXT NOT NULL,
    "date"               TIMESTAMP(3) NOT NULL,
    "time"               TEXT,
    "category"           "BoardingIncidentCategory" NOT NULL,
    "severity"           "BoardingIncidentSeverity" NOT NULL DEFAULT 'MINOR',
    "title"              TEXT NOT NULL,
    "description"        TEXT NOT NULL,
    "actionTaken"        TEXT,
    "status"             "BoardingIncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "resolvedBy"         TEXT,
    "resolvedAt"         TIMESTAMP(3),
    "resolution"         TEXT,
    "linkedDisciplineId" TEXT,
    "parentNotified"     BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BoardingIncident_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BoardingIncident_incidentNumber_key" ON "BoardingIncident"("incidentNumber");
CREATE INDEX IF NOT EXISTS "BoardingIncident_schoolId_idx"   ON "BoardingIncident"("schoolId");
CREATE INDEX IF NOT EXISTS "BoardingIncident_hostelId_idx"   ON "BoardingIncident"("hostelId");
CREATE INDEX IF NOT EXISTS "BoardingIncident_status_idx"     ON "BoardingIncident"("status");
CREATE INDEX IF NOT EXISTS "BoardingIncident_category_idx"   ON "BoardingIncident"("category");
CREATE INDEX IF NOT EXISTS "BoardingIncident_severity_idx"   ON "BoardingIncident"("severity");

CREATE TABLE IF NOT EXISTS "SickBayAdmission" (
    "id"               TEXT NOT NULL,
    "schoolId"         TEXT NOT NULL,
    "admissionNumber"  TEXT NOT NULL,
    "studentId"        TEXT NOT NULL,
    "hostelId"         TEXT NOT NULL,
    "admittedBy"       TEXT NOT NULL,
    "admittedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symptoms"         TEXT NOT NULL,
    "initialDiagnosis" TEXT,
    "temperature"      DECIMAL(65,30),
    "severity"         "SickBaySeverity" NOT NULL DEFAULT 'MILD',
    "status"           "SickBayStatus" NOT NULL DEFAULT 'ADMITTED',
    "treatmentNotes"   TEXT,
    "dischargedBy"     TEXT,
    "dischargedAt"     TIMESTAMP(3),
    "dischargeNotes"   TEXT,
    "referredTo"       TEXT,
    "parentNotified"   BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SickBayAdmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SickBayAdmission_admissionNumber_key" ON "SickBayAdmission"("admissionNumber");
CREATE INDEX IF NOT EXISTS "SickBayAdmission_schoolId_idx"  ON "SickBayAdmission"("schoolId");
CREATE INDEX IF NOT EXISTS "SickBayAdmission_studentId_idx" ON "SickBayAdmission"("studentId");
CREATE INDEX IF NOT EXISTS "SickBayAdmission_hostelId_idx"  ON "SickBayAdmission"("hostelId");
CREATE INDEX IF NOT EXISTS "SickBayAdmission_status_idx"    ON "SickBayAdmission"("status");

CREATE TABLE IF NOT EXISTS "MedicationLog" (
    "id"                 TEXT NOT NULL,
    "sickBayAdmissionId" TEXT NOT NULL,
    "schoolId"           TEXT NOT NULL,
    "medicationName"     TEXT NOT NULL,
    "dosage"             TEXT NOT NULL,
    "administeredBy"     TEXT NOT NULL,
    "administeredAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"              TEXT,
    CONSTRAINT "MedicationLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MedicationLog_sickBayAdmissionId_idx" ON "MedicationLog"("sickBayAdmissionId");
CREATE INDEX IF NOT EXISTS "MedicationLog_schoolId_idx"           ON "MedicationLog"("schoolId");

DO $$ BEGIN
  ALTER TABLE "MedicationLog"
    ADD CONSTRAINT "MedicationLog_sickBayAdmissionId_fkey"
    FOREIGN KEY ("sickBayAdmissionId") REFERENCES "SickBayAdmission"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MedicationLog"
    ADD CONSTRAINT "MedicationLog_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BoardingVisitor" (
    "id"              TEXT NOT NULL,
    "schoolId"        TEXT NOT NULL,
    "studentId"       TEXT NOT NULL,
    "visitorName"     TEXT NOT NULL,
    "relationship"    TEXT NOT NULL,
    "visitorPhone"    TEXT NOT NULL,
    "visitorIdNumber" TEXT,
    "purpose"         TEXT NOT NULL,
    "checkInAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt"      TIMESTAMP(3),
    "checkedInBy"     TEXT NOT NULL,
    "checkedOutBy"    TEXT,
    "status"          "VisitorStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "hostelId"        TEXT NOT NULL,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoardingVisitor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BoardingVisitor_schoolId_idx"   ON "BoardingVisitor"("schoolId");
CREATE INDEX IF NOT EXISTS "BoardingVisitor_studentId_idx"  ON "BoardingVisitor"("studentId");
CREATE INDEX IF NOT EXISTS "BoardingVisitor_hostelId_idx"   ON "BoardingVisitor"("hostelId");
CREATE INDEX IF NOT EXISTS "BoardingVisitor_status_idx"     ON "BoardingVisitor"("status");
CREATE INDEX IF NOT EXISTS "BoardingVisitor_checkInAt_idx"  ON "BoardingVisitor"("checkInAt");

CREATE TABLE IF NOT EXISTS "BedTransfer" (
    "id"              TEXT NOT NULL,
    "schoolId"        TEXT NOT NULL,
    "transferNumber"  TEXT NOT NULL,
    "studentId"       TEXT NOT NULL,
    "fromBedId"       TEXT NOT NULL,
    "toBedId"         TEXT NOT NULL,
    "reason"          "BedTransferReason" NOT NULL,
    "reasonDetails"   TEXT,
    "requestedBy"     TEXT NOT NULL,
    "requestedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"          "BedTransferStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy"      TEXT,
    "approvedAt"      TIMESTAMP(3),
    "effectiveDate"   TIMESTAMP(3),
    "completedAt"     TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BedTransfer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BedTransfer_transferNumber_key" ON "BedTransfer"("transferNumber");
CREATE INDEX IF NOT EXISTS "BedTransfer_schoolId_idx"   ON "BedTransfer"("schoolId");
CREATE INDEX IF NOT EXISTS "BedTransfer_studentId_idx"  ON "BedTransfer"("studentId");
CREATE INDEX IF NOT EXISTS "BedTransfer_status_idx"     ON "BedTransfer"("status");

CREATE TABLE IF NOT EXISTS "HostelInspection" (
    "id"                TEXT NOT NULL,
    "schoolId"          TEXT NOT NULL,
    "hostelId"          TEXT NOT NULL,
    "dormitoryId"       TEXT,
    "inspectedBy"       TEXT NOT NULL,
    "inspectionDate"    TIMESTAMP(3) NOT NULL,
    "type"              "InspectionType" NOT NULL DEFAULT 'ROUTINE',
    "overallRating"     "InspectionRating" NOT NULL,
    "cleanlinessRating" "InspectionRating" NOT NULL,
    "facilityRating"    "InspectionRating" NOT NULL,
    "safetyRating"      "InspectionRating" NOT NULL,
    "remarks"           TEXT,
    "issues"            TEXT,
    "followUpRequired"  BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HostelInspection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HostelInspection_schoolId_idx"       ON "HostelInspection"("schoolId");
CREATE INDEX IF NOT EXISTS "HostelInspection_hostelId_idx"       ON "HostelInspection"("hostelId");
CREATE INDEX IF NOT EXISTS "HostelInspection_inspectionDate_idx" ON "HostelInspection"("inspectionDate");

CREATE TABLE IF NOT EXISTS "MaintenanceRequest" (
    "id"              TEXT NOT NULL,
    "schoolId"        TEXT NOT NULL,
    "requestNumber"   TEXT NOT NULL,
    "hostelId"        TEXT NOT NULL,
    "dormitoryId"     TEXT,
    "bedId"           TEXT,
    "reportedBy"      TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "description"     TEXT NOT NULL,
    "category"        "MaintenanceCategory" NOT NULL,
    "priority"        "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "status"          "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "assignedTo"      TEXT,
    "assignedAt"      TIMESTAMP(3),
    "resolvedAt"      TIMESTAMP(3),
    "resolvedBy"      TEXT,
    "resolutionNotes" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MaintenanceRequest_requestNumber_key" ON "MaintenanceRequest"("requestNumber");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_schoolId_idx" ON "MaintenanceRequest"("schoolId");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_hostelId_idx" ON "MaintenanceRequest"("hostelId");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_status_idx"   ON "MaintenanceRequest"("status");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_priority_idx" ON "MaintenanceRequest"("priority");

-- ─── Inventory tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "StoreTransfer" (
    "id"             TEXT NOT NULL,
    "schoolId"       TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "fromStoreId"    TEXT NOT NULL,
    "toStoreId"      TEXT NOT NULL,
    "requestedBy"    TEXT NOT NULL,
    "approvedBy"     TEXT,
    "status"         "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "reason"         TEXT,
    "requestedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt"     TIMESTAMP(3),
    "completedAt"    TIMESTAMP(3),
    CONSTRAINT "StoreTransfer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StoreTransfer_transferNumber_key" ON "StoreTransfer"("transferNumber");
CREATE INDEX IF NOT EXISTS "StoreTransfer_schoolId_idx"    ON "StoreTransfer"("schoolId");
CREATE INDEX IF NOT EXISTS "StoreTransfer_fromStoreId_idx" ON "StoreTransfer"("fromStoreId");
CREATE INDEX IF NOT EXISTS "StoreTransfer_toStoreId_idx"   ON "StoreTransfer"("toStoreId");
CREATE INDEX IF NOT EXISTS "StoreTransfer_status_idx"      ON "StoreTransfer"("status");

CREATE TABLE IF NOT EXISTS "StoreTransferItem" (
    "id"              TEXT NOT NULL,
    "storeTransferId" TEXT NOT NULL,
    "storeItemId"     TEXT NOT NULL,
    "targetItemId"    TEXT,
    "quantity"        INTEGER NOT NULL,
    "receivedQty"     INTEGER,
    CONSTRAINT "StoreTransferItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StoreTransferItem_storeTransferId_idx" ON "StoreTransferItem"("storeTransferId");

DO $$ BEGIN
  ALTER TABLE "StoreTransferItem"
    ADD CONSTRAINT "StoreTransferItem_storeTransferId_fkey"
    FOREIGN KEY ("storeTransferId") REFERENCES "StoreTransfer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Requisition" (
    "id"                TEXT NOT NULL,
    "schoolId"          TEXT NOT NULL,
    "requisitionNumber" TEXT NOT NULL,
    "storeId"           TEXT NOT NULL,
    "department"        TEXT NOT NULL,
    "requestedBy"       TEXT NOT NULL,
    "approvedBy"        TEXT,
    "status"            "RequisitionStatus" NOT NULL DEFAULT 'PENDING',
    "purpose"           TEXT,
    "requestedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt"        TIMESTAMP(3),
    "issuedAt"          TIMESTAMP(3),
    "issuedBy"          TEXT,
    CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Requisition_requisitionNumber_key" ON "Requisition"("requisitionNumber");
CREATE INDEX IF NOT EXISTS "Requisition_schoolId_idx"   ON "Requisition"("schoolId");
CREATE INDEX IF NOT EXISTS "Requisition_storeId_idx"    ON "Requisition"("storeId");
CREATE INDEX IF NOT EXISTS "Requisition_department_idx" ON "Requisition"("department");
CREATE INDEX IF NOT EXISTS "Requisition_status_idx"     ON "Requisition"("status");

CREATE TABLE IF NOT EXISTS "RequisitionItem" (
    "id"                TEXT NOT NULL,
    "requisitionId"     TEXT NOT NULL,
    "storeItemId"       TEXT NOT NULL,
    "quantityRequested" INTEGER NOT NULL,
    "quantityIssued"    INTEGER,
    CONSTRAINT "RequisitionItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RequisitionItem_requisitionId_idx" ON "RequisitionItem"("requisitionId");

DO $$ BEGIN
  ALTER TABLE "RequisitionItem"
    ADD CONSTRAINT "RequisitionItem_requisitionId_fkey"
    FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "StockTake" (
    "id"            TEXT NOT NULL,
    "schoolId"      TEXT NOT NULL,
    "storeId"       TEXT NOT NULL,
    "reference"     TEXT NOT NULL,
    "status"        "StockTakeStatus" NOT NULL DEFAULT 'PLANNED',
    "scheduledDate" TIMESTAMP(3),
    "startedAt"     TIMESTAMP(3),
    "completedAt"   TIMESTAMP(3),
    "conductedBy"   TEXT,
    "approvedBy"    TEXT,
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockTake_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StockTake_reference_key" ON "StockTake"("reference");
CREATE INDEX IF NOT EXISTS "StockTake_schoolId_idx" ON "StockTake"("schoolId");
CREATE INDEX IF NOT EXISTS "StockTake_storeId_idx"  ON "StockTake"("storeId");
CREATE INDEX IF NOT EXISTS "StockTake_status_idx"   ON "StockTake"("status");

CREATE TABLE IF NOT EXISTS "StockTakeItem" (
    "id"               TEXT NOT NULL,
    "stockTakeId"      TEXT NOT NULL,
    "storeItemId"      TEXT NOT NULL,
    "itemName"         TEXT NOT NULL,
    "systemQuantity"   INTEGER NOT NULL,
    "physicalQuantity" INTEGER,
    "variance"         INTEGER,
    "varianceReason"   TEXT,
    "adjusted"         BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT "StockTakeItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StockTakeItem_stockTakeId_idx" ON "StockTakeItem"("stockTakeId");

DO $$ BEGIN
  ALTER TABLE "StockTakeItem"
    ADD CONSTRAINT "StockTakeItem_stockTakeId_fkey"
    FOREIGN KEY ("stockTakeId") REFERENCES "StockTake"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AssetAudit" (
    "id"            TEXT NOT NULL,
    "schoolId"      TEXT NOT NULL,
    "reference"     TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3),
    "completedAt"   TIMESTAMP(3),
    "conductedBy"   TEXT,
    "status"        "StockTakeStatus" NOT NULL DEFAULT 'PLANNED',
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetAudit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AssetAudit_reference_key" ON "AssetAudit"("reference");
CREATE INDEX IF NOT EXISTS "AssetAudit_schoolId_idx" ON "AssetAudit"("schoolId");
CREATE INDEX IF NOT EXISTS "AssetAudit_status_idx"   ON "AssetAudit"("status");

CREATE TABLE IF NOT EXISTS "AssetAuditItem" (
    "id"               TEXT NOT NULL,
    "assetAuditId"     TEXT NOT NULL,
    "fixedAssetId"     TEXT NOT NULL,
    "found"            BOOLEAN,
    "condition"        "AssetCondition",
    "locationVerified" BOOLEAN,
    "notes"            TEXT,
    CONSTRAINT "AssetAuditItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AssetAuditItem_assetAuditId_idx" ON "AssetAuditItem"("assetAuditId");
CREATE INDEX IF NOT EXISTS "AssetAuditItem_fixedAssetId_idx" ON "AssetAuditItem"("fixedAssetId");

DO $$ BEGIN
  ALTER TABLE "AssetAuditItem"
    ADD CONSTRAINT "AssetAuditItem_assetAuditId_fkey"
    FOREIGN KEY ("assetAuditId") REFERENCES "AssetAudit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssetAuditItem"
    ADD CONSTRAINT "AssetAuditItem_fixedAssetId_fkey"
    FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
