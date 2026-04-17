-- Phase 2 schema additions:
--   * NotificationTemplate / NotificationPreference / NotificationChannel
--     → DB-backed notification templates + per-user channel preferences.
--   * CommunicationCampaign / CommunicationCampaignStatus
--     → scheduled bulk messaging.
--   * ExeatOtp / ExeatOtpChannel / ExeatOtpStatus
--     → guardian OTP verification gating gate release.
--   * ExeatMovement / ExeatMovementKind
--     → depart/return audit log with geolocation + officer identity.

-- ─── Enums ────────────────────────────────────────────────────────────

CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'SMS', 'EMAIL', 'WHATSAPP', 'PUSH');
CREATE TYPE "CommunicationCampaignStatus" AS ENUM ('SCHEDULED', 'DISPATCHING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "ExeatOtpChannel" AS ENUM ('SMS', 'WHATSAPP');
CREATE TYPE "ExeatOtpStatus" AS ENUM ('SENT', 'VERIFIED', 'EXPIRED', 'FAILED');
CREATE TYPE "ExeatMovementKind" AS ENUM ('DEPART', 'RETURN');

-- ─── NotificationTemplate ────────────────────────────────────────────

CREATE TABLE "NotificationTemplate" (
    "id"        TEXT NOT NULL,
    "schoolId"  TEXT,                    -- null = global default
    "key"       TEXT NOT NULL,
    "channel"   "NotificationChannel" NOT NULL,
    "locale"    TEXT NOT NULL DEFAULT 'en',
    "subject"   TEXT,
    "body"      TEXT NOT NULL,
    "variables" JSONB,
    "active"    BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationTemplate_schoolId_key_channel_locale_key"
  ON "NotificationTemplate"("schoolId", "key", "channel", "locale");
CREATE INDEX "NotificationTemplate_schoolId_idx" ON "NotificationTemplate"("schoolId");
CREATE INDEX "NotificationTemplate_key_channel_idx" ON "NotificationTemplate"("key", "channel");

-- RLS: lenient policy — null schoolId rows are visible to every tenant
-- (that's the "global default" case) but schooled rows obey tenant isolation.
ALTER TABLE "NotificationTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationTemplate" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_NotificationTemplate ON "NotificationTemplate"
  USING (
    "schoolId" IS NULL
    OR "schoolId" = current_setting('app.current_school_id', true)
  )
  WITH CHECK (
    "schoolId" IS NULL
    OR "schoolId" = current_setting('app.current_school_id', true)
  );

-- ─── NotificationPreference ──────────────────────────────────────────

CREATE TABLE "NotificationPreference" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "eventKey"  TEXT NOT NULL,
    "channels"  "NotificationChannel"[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationPreference_userId_eventKey_key"
  ON "NotificationPreference"("userId", "eventKey");
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- No RLS on NotificationPreference: it is user-owned, not school-scoped.
-- Filtering is enforced at the application layer via the authenticated userId.

-- ─── CommunicationCampaign ───────────────────────────────────────────

CREATE TABLE "CommunicationCampaign" (
    "id"            TEXT NOT NULL,
    "schoolId"      TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "templateId"    TEXT,
    "channel"       "NotificationChannel" NOT NULL,
    "subject"       TEXT,
    "body"          TEXT NOT NULL,
    "audienceQuery" JSONB NOT NULL,
    "scheduledAt"   TIMESTAMP(3) NOT NULL,
    "status"        "CommunicationCampaignStatus" NOT NULL DEFAULT 'SCHEDULED',
    "dispatchedAt"  TIMESTAMP(3),
    "sentCount"     INTEGER NOT NULL DEFAULT 0,
    "failedCount"   INTEGER NOT NULL DEFAULT 0,
    "createdBy"     TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunicationCampaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CommunicationCampaign_schoolId_idx" ON "CommunicationCampaign"("schoolId");
CREATE INDEX "CommunicationCampaign_status_scheduledAt_idx" ON "CommunicationCampaign"("status", "scheduledAt");

ALTER TABLE "CommunicationCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommunicationCampaign" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_CommunicationCampaign ON "CommunicationCampaign"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

-- ─── ExeatOtp ────────────────────────────────────────────────────────

CREATE TABLE "ExeatOtp" (
    "id"          TEXT NOT NULL,
    "exeatId"     TEXT NOT NULL,
    "schoolId"    TEXT NOT NULL,
    "codeHash"    TEXT NOT NULL,
    "channel"     "ExeatOtpChannel" NOT NULL,
    "sentTo"      TEXT NOT NULL,
    "sentAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "verifiedAt"  TIMESTAMP(3),
    "attempts"    INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "status"      "ExeatOtpStatus" NOT NULL DEFAULT 'SENT',
    CONSTRAINT "ExeatOtp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExeatOtp_exeatId_idx" ON "ExeatOtp"("exeatId");
CREATE INDEX "ExeatOtp_schoolId_idx" ON "ExeatOtp"("schoolId");
CREATE INDEX "ExeatOtp_status_expiresAt_idx" ON "ExeatOtp"("status", "expiresAt");

ALTER TABLE "ExeatOtp"
  ADD CONSTRAINT "ExeatOtp_exeatId_fkey"
  FOREIGN KEY ("exeatId") REFERENCES "Exeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExeatOtp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExeatOtp" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ExeatOtp ON "ExeatOtp"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

-- ─── ExeatMovement ───────────────────────────────────────────────────

CREATE TABLE "ExeatMovement" (
    "id"         TEXT NOT NULL,
    "exeatId"    TEXT NOT NULL,
    "schoolId"   TEXT NOT NULL,
    "kind"       "ExeatMovementKind" NOT NULL,
    "officerId"  TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geoLat"     DECIMAL(10,7),
    "geoLng"     DECIMAL(10,7),
    "notes"      TEXT,
    CONSTRAINT "ExeatMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExeatMovement_exeatId_idx" ON "ExeatMovement"("exeatId");
CREATE INDEX "ExeatMovement_schoolId_idx" ON "ExeatMovement"("schoolId");
CREATE INDEX "ExeatMovement_occurredAt_idx" ON "ExeatMovement"("occurredAt");
CREATE INDEX "ExeatMovement_kind_idx" ON "ExeatMovement"("kind");

ALTER TABLE "ExeatMovement"
  ADD CONSTRAINT "ExeatMovement_exeatId_fkey"
  FOREIGN KEY ("exeatId") REFERENCES "Exeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExeatMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExeatMovement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ExeatMovement ON "ExeatMovement"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));
