import { PrismaClient } from "@prisma/client";
import { getActivePolicies, getCutoffDate, type RetentionPolicy } from "@/lib/retention/policy";
import { deleteFile } from "@/lib/storage/r2";
import { logger } from "@/lib/logger";

const db = new PrismaClient();
const log = logger.child({ worker: "retention" });

/** Parent-request retention window: 7 years after terminal review. */
const PARENT_REQUEST_RETENTION_DAYS = 365 * 7;

/**
 * Data Retention Worker
 *
 * Executes retention policies by deleting, archiving, or anonymizing
 * records that have exceeded their retention period.
 *
 * Designed to be run as a scheduled job (e.g., weekly via cron or BullMQ).
 */
export async function executeRetentionPolicies(): Promise<RetentionResult[]> {
  const policies = getActivePolicies();
  const results: RetentionResult[] = [];

  log.info("starting retention check", { policies: policies.length });

  // Parent-initiated request sweeps (R2 attachments + DB rows)
  try {
    const excuseResult = await sweepExcuseRequests();
    results.push(excuseResult);
    if (excuseResult.affectedCount > 0) {
      log.info("policy applied", {
        entity: excuseResult.entity,
        action: excuseResult.action,
        affected: excuseResult.affectedCount,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    log.error("policy failed", { entity: "ExcuseRequest (terminal)", error: msg });
    results.push({
      entity: "ExcuseRequest (terminal)",
      action: "delete",
      affectedCount: 0,
      error: msg,
    });
  }

  try {
    const disclosureResult = await sweepMedicalDisclosures();
    results.push(disclosureResult);
    if (disclosureResult.affectedCount > 0) {
      log.info("policy applied", {
        entity: disclosureResult.entity,
        action: disclosureResult.action,
        affected: disclosureResult.affectedCount,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    log.error("policy failed", { entity: "MedicalDisclosure (terminal)", error: msg });
    results.push({
      entity: "MedicalDisclosure (terminal)",
      action: "delete",
      affectedCount: 0,
      error: msg,
    });
  }

  for (const policy of policies) {
    try {
      const result = await executePolicy(policy);
      results.push(result);
      if (result.affectedCount > 0) {
        log.info("policy applied", {
          entity: policy.entity,
          action: result.action,
          affected: result.affectedCount,
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      log.error("policy failed", { entity: policy.entity, error: msg });
      results.push({
        entity: policy.entity,
        action: policy.action,
        affectedCount: 0,
        error: msg,
      });
    }
  }

  // Audit the retention run
  await db.auditLog.create({
    data: {
      userId: "system",
      action: "DELETE",
      entity: "RetentionPolicy",
      module: "system",
      description: `Retention cleanup: ${results.filter((r) => r.affectedCount > 0).length} policies affected`,
      metadata: JSON.parse(JSON.stringify({ results })),
    },
  });

  log.info("retention check complete");
  return results;
}

interface RetentionResult {
  entity: string;
  action: string;
  affectedCount: number;
  error?: string;
}

async function executePolicy(policy: RetentionPolicy): Promise<RetentionResult> {
  const cutoffDate = getCutoffDate(policy.retentionDays);

  const where: Record<string, unknown> = {
    [policy.dateField]: { lt: cutoffDate },
    ...policy.condition,
  };

  // Get the Prisma model dynamically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (db as any)[policy.model] as {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
    deleteMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }>;
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };

  if (!model) {
    return {
      entity: policy.entity,
      action: policy.action,
      affectedCount: 0,
      error: "Model not found",
    };
  }

  const count = await model.count({ where });

  if (count === 0) {
    return { entity: policy.entity, action: policy.action, affectedCount: 0 };
  }

  switch (policy.action) {
    case "delete": {
      const result = await model.deleteMany({ where });
      return { entity: policy.entity, action: "delete", affectedCount: result.count };
    }

    case "anonymize": {
      // For anonymization, we blank out PII fields but keep the record
      const anonymizeData: Record<string, unknown> = {};

      if (policy.model === "admissionApplication") {
        anonymizeData.firstName = "REDACTED";
        anonymizeData.lastName = "REDACTED";
        anonymizeData.guardianName = "REDACTED";
        anonymizeData.guardianPhone = "REDACTED";
        anonymizeData.guardianEmail = null;
        anonymizeData.guardianAddress = null;
        anonymizeData.jhsIndexNumber = null;
      }

      if (Object.keys(anonymizeData).length > 0) {
        const result = await model.updateMany({ where, data: anonymizeData });
        return { entity: policy.entity, action: "anonymize", affectedCount: result.count };
      }

      return { entity: policy.entity, action: "anonymize", affectedCount: 0 };
    }

    case "archive": {
      // Archive action: for now, log the count. Full archival to cold storage
      // would require exporting to CSV/JSON and uploading to R2 before deletion.
      // This is a placeholder that tracks what would be archived.
      log.info("records eligible for archival", {
        entity: policy.entity,
        count,
        olderThanDays: policy.retentionDays,
      });
      return { entity: policy.entity, action: "archive (logged)", affectedCount: count };
    }

    default:
      return { entity: policy.entity, action: policy.action, affectedCount: 0 };
  }
}

/**
 * Sweep terminal ExcuseRequest rows older than the retention window.
 *
 * - Targets rows with status in APPROVED, REJECTED, WITHDRAWN
 * - Uses `reviewedAt` as the age cutoff (falls back implicitly: only rows
 *   that have been reviewed have `reviewedAt`; withdrawn-without-review rows
 *   keep `reviewedAt` null and are excluded by the `not: null` clause).
 * - Deletes R2 attachments best-effort (404s swallowed) before deleting DB rows.
 */
async function sweepExcuseRequests(): Promise<RetentionResult> {
  const cutoff = getCutoffDate(PARENT_REQUEST_RETENTION_DAYS);
  const entity = "ExcuseRequest (terminal)";

  const rows = await db.excuseRequest.findMany({
    where: {
      status: { in: ["APPROVED", "REJECTED", "WITHDRAWN"] },
      reviewedAt: { lt: cutoff, not: null },
    },
    select: { id: true, attachmentKey: true },
  });

  if (rows.length === 0) {
    return { entity, action: "delete", affectedCount: 0 };
  }

  for (const row of rows) {
    if (row.attachmentKey) {
      await deleteFile(row.attachmentKey).catch(() => {});
    }
  }

  const result = await db.excuseRequest.deleteMany({
    where: { id: { in: rows.map((r) => r.id) } },
  });

  return { entity, action: "delete", affectedCount: result.count };
}

/**
 * Sweep terminal MedicalDisclosure rows older than the retention window.
 *
 * - Targets rows with status in APPROVED, REJECTED, WITHDRAWN
 * - Uses `reviewedAt` as the age cutoff.
 * - Deletes R2 attachments best-effort (404s swallowed) before deleting DB rows.
 * - Does NOT delete the linked MedicalRecord (those have their own retention).
 */
async function sweepMedicalDisclosures(): Promise<RetentionResult> {
  const cutoff = getCutoffDate(PARENT_REQUEST_RETENTION_DAYS);
  const entity = "MedicalDisclosure (terminal)";

  const rows = await db.medicalDisclosure.findMany({
    where: {
      status: { in: ["APPROVED", "REJECTED", "WITHDRAWN"] },
      reviewedAt: { lt: cutoff, not: null },
    },
    select: { id: true, attachmentKey: true },
  });

  if (rows.length === 0) {
    return { entity, action: "delete", affectedCount: 0 };
  }

  for (const row of rows) {
    if (row.attachmentKey) {
      await deleteFile(row.attachmentKey).catch(() => {});
    }
  }

  const result = await db.medicalDisclosure.deleteMany({
    where: { id: { in: rows.map((r) => r.id) } },
  });

  return { entity, action: "delete", affectedCount: result.count };
}
