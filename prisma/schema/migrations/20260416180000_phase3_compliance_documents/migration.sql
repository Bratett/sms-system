-- Phase 3: Ghana statutory compliance + document template registry + e-signature.

-- ─── School compliance identifiers ────────────────────────────────────

ALTER TABLE "School" ADD COLUMN "tin" TEXT;
ALTER TABLE "School" ADD COLUMN "ssnitEmployerNumber" TEXT;
ALTER TABLE "School" ADD COLUMN "getFundCode" TEXT;
ALTER TABLE "School" ADD COLUMN "graVatTin" TEXT;

-- ─── Teacher NTC licensure ────────────────────────────────────────────

CREATE TYPE "TeacherLicenceStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED');

CREATE TABLE "TeacherLicence" (
    "id"         TEXT NOT NULL,
    "schoolId"   TEXT NOT NULL,
    "staffId"    TEXT NOT NULL,
    "ntcNumber"  TEXT NOT NULL,
    "category"   TEXT NOT NULL,
    "issuedAt"   TIMESTAMP(3) NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "status"     "TeacherLicenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "documentId" TEXT,
    "notes"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherLicence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeacherLicence_ntcNumber_key" ON "TeacherLicence"("ntcNumber");
CREATE INDEX "TeacherLicence_schoolId_idx" ON "TeacherLicence"("schoolId");
CREATE INDEX "TeacherLicence_staffId_idx" ON "TeacherLicence"("staffId");
CREATE INDEX "TeacherLicence_expiresAt_idx" ON "TeacherLicence"("expiresAt");
CREATE INDEX "TeacherLicence_status_idx" ON "TeacherLicence"("status");

ALTER TABLE "TeacherLicence"
  ADD CONSTRAINT "TeacherLicence_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherLicence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeacherLicence" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_TeacherLicence ON "TeacherLicence"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

-- ─── Document Template Registry ──────────────────────────────────────

CREATE TYPE "DocumentTemplateEngine" AS ENUM ('HANDLEBARS_PDF', 'REACT_PDF');
CREATE TYPE "DocumentTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "DocumentInstanceStatus" AS ENUM (
  'PENDING_RENDER', 'RENDERED', 'AWAITING_SIGNATURES', 'SIGNED', 'VOIDED'
);
CREATE TYPE "DocumentSignatureMethod" AS ENUM (
  'TYPED', 'DRAWN', 'UPLOADED_CERT', 'SYSTEM'
);

CREATE TABLE "DocumentTemplate" (
    "id"              TEXT NOT NULL,
    "schoolId"        TEXT,
    "key"             TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "engine"          "DocumentTemplateEngine" NOT NULL DEFAULT 'HANDLEBARS_PDF',
    "bodyHtml"        TEXT,
    "componentKey"    TEXT,
    "variables"       JSONB,
    "activeVersionId" TEXT,
    "status"          "DocumentTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy"       TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentTemplate_schoolId_key_key" ON "DocumentTemplate"("schoolId", "key");
CREATE UNIQUE INDEX "DocumentTemplate_activeVersionId_key" ON "DocumentTemplate"("activeVersionId");
CREATE INDEX "DocumentTemplate_schoolId_idx" ON "DocumentTemplate"("schoolId");
CREATE INDEX "DocumentTemplate_key_idx" ON "DocumentTemplate"("key");
CREATE INDEX "DocumentTemplate_status_idx" ON "DocumentTemplate"("status");

CREATE TABLE "DocumentTemplateVersion" (
    "id"           TEXT NOT NULL,
    "templateId"   TEXT NOT NULL,
    "version"      INTEGER NOT NULL,
    "bodyHtml"     TEXT,
    "componentKey" TEXT,
    "variables"    JSONB,
    "createdBy"    TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentTemplateVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentTemplateVersion_templateId_version_key"
  ON "DocumentTemplateVersion"("templateId", "version");
CREATE INDEX "DocumentTemplateVersion_templateId_idx"
  ON "DocumentTemplateVersion"("templateId");

ALTER TABLE "DocumentTemplateVersion"
  ADD CONSTRAINT "DocumentTemplateVersion_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentTemplate"
  ADD CONSTRAINT "DocumentTemplate_activeVersionId_fkey"
  FOREIGN KEY ("activeVersionId") REFERENCES "DocumentTemplateVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DocumentInstance" (
    "id"              TEXT NOT NULL,
    "schoolId"        TEXT NOT NULL,
    "templateId"      TEXT NOT NULL,
    "versionId"       TEXT NOT NULL,
    "rendererPayload" JSONB NOT NULL,
    "pdfKey"          TEXT,
    "pdfSha256"       TEXT,
    "status"          "DocumentInstanceStatus" NOT NULL DEFAULT 'PENDING_RENDER',
    "documentId"      TEXT,
    "generatedBy"     TEXT NOT NULL,
    "entityType"      TEXT,
    "entityId"        TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentInstance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DocumentInstance_schoolId_idx" ON "DocumentInstance"("schoolId");
CREATE INDEX "DocumentInstance_templateId_idx" ON "DocumentInstance"("templateId");
CREATE INDEX "DocumentInstance_status_idx" ON "DocumentInstance"("status");
CREATE INDEX "DocumentInstance_entityType_entityId_idx"
  ON "DocumentInstance"("entityType", "entityId");

ALTER TABLE "DocumentInstance"
  ADD CONSTRAINT "DocumentInstance_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentInstance"
  ADD CONSTRAINT "DocumentInstance_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "DocumentTemplateVersion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DocumentSignature" (
    "id"         TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "signerId"   TEXT NOT NULL,
    "signerName" TEXT,
    "signerRole" TEXT,
    "method"     "DocumentSignatureMethod" NOT NULL,
    "hash"       TEXT NOT NULL,
    "signedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    "payload"    JSONB,
    CONSTRAINT "DocumentSignature_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DocumentSignature_instanceId_idx" ON "DocumentSignature"("instanceId");
CREATE INDEX "DocumentSignature_signerId_idx" ON "DocumentSignature"("signerId");

ALTER TABLE "DocumentSignature"
  ADD CONSTRAINT "DocumentSignature_instanceId_fkey"
  FOREIGN KEY ("instanceId") REFERENCES "DocumentInstance"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DocumentSignLink" (
    "id"          TEXT NOT NULL,
    "instanceId"  TEXT NOT NULL,
    "schoolId"    TEXT NOT NULL,
    "tokenHash"   TEXT NOT NULL,
    "signerEmail" TEXT,
    "signerPhone" TEXT,
    "signerName"  TEXT,
    "signerRole"  TEXT,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "consumedAt"  TIMESTAMP(3),
    "createdBy"   TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentSignLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentSignLink_tokenHash_key" ON "DocumentSignLink"("tokenHash");
CREATE INDEX "DocumentSignLink_instanceId_idx" ON "DocumentSignLink"("instanceId");
CREATE INDEX "DocumentSignLink_schoolId_idx" ON "DocumentSignLink"("schoolId");
CREATE INDEX "DocumentSignLink_expiresAt_idx" ON "DocumentSignLink"("expiresAt");

-- RLS. DocumentTemplate uses the same lenient pattern as NotificationTemplate
-- (null schoolId = global default, visible to every tenant). Everything else
-- is school-scoped strict.

ALTER TABLE "DocumentTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentTemplate" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DocumentTemplate ON "DocumentTemplate"
  USING ("schoolId" IS NULL OR "schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" IS NULL OR "schoolId" = current_setting('app.current_school_id', true));

-- DocumentTemplateVersion has no schoolId directly; RLS not applied — access
-- is gated by joining through DocumentTemplate which is already protected.

ALTER TABLE "DocumentInstance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentInstance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DocumentInstance ON "DocumentInstance"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

-- DocumentSignature cascades from DocumentInstance; no own schoolId. Queries
-- must always join through the instance, which carries the RLS policy.

ALTER TABLE "DocumentSignLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentSignLink" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DocumentSignLink ON "DocumentSignLink"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));
