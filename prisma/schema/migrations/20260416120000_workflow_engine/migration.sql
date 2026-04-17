-- Workflow engine tables: generic state-machine instance + transition tracking.
-- Definitions live in application code (src/lib/workflow/definitions/); nothing here.

-- CreateEnum
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "definitionKey" TEXT NOT NULL,
    "definitionVersion" INTEGER NOT NULL DEFAULT 1,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "currentState" TEXT NOT NULL,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "slaDueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "startedBy" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTransition" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT,
    "reason" TEXT,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowInstance_entityType_entityId_key" ON "WorkflowInstance"("entityType", "entityId");
CREATE INDEX "WorkflowInstance_schoolId_idx" ON "WorkflowInstance"("schoolId");
CREATE INDEX "WorkflowInstance_definitionKey_idx" ON "WorkflowInstance"("definitionKey");
CREATE INDEX "WorkflowInstance_entityType_entityId_idx" ON "WorkflowInstance"("entityType", "entityId");
CREATE INDEX "WorkflowInstance_status_idx" ON "WorkflowInstance"("status");
CREATE INDEX "WorkflowInstance_slaDueAt_idx" ON "WorkflowInstance"("slaDueAt");

CREATE INDEX "WorkflowTransition_instanceId_idx" ON "WorkflowTransition"("instanceId");
CREATE INDEX "WorkflowTransition_schoolId_idx" ON "WorkflowTransition"("schoolId");
CREATE INDEX "WorkflowTransition_occurredAt_idx" ON "WorkflowTransition"("occurredAt");

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security: tenant isolation via app.current_school_id
ALTER TABLE "WorkflowInstance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowInstance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_WorkflowInstance ON "WorkflowInstance"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "WorkflowTransition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowTransition" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_WorkflowTransition ON "WorkflowTransition"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));
