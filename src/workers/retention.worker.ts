import { PrismaClient } from "@prisma/client";
import { getActivePolicies, getCutoffDate, type RetentionPolicy } from "@/lib/retention/policy";

const db = new PrismaClient();

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

  console.log(`[Retention] Starting retention check for ${policies.length} policies...`);

  for (const policy of policies) {
    try {
      const result = await executePolicy(policy);
      results.push(result);
      if (result.affectedCount > 0) {
        console.log(
          `[Retention] ${policy.entity}: ${result.action} ${result.affectedCount} records`,
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Retention] Error processing ${policy.entity}:`, msg);
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

  console.log("[Retention] Retention check complete.");
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
      console.log(
        `[Retention] ${policy.entity}: ${count} records eligible for archival (older than ${policy.retentionDays} days)`,
      );
      return { entity: policy.entity, action: "archive (logged)", affectedCount: count };
    }

    default:
      return { entity: policy.entity, action: policy.action, affectedCount: 0 };
  }
}
