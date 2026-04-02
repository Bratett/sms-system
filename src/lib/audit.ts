import { db } from "@/lib/db";
import type { AuditAction } from "@prisma/client";

interface AuditParams {
  userId: string;
  schoolId?: string;
  userRole?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  module: string;
  description: string;
  previousData?: unknown;
  newData?: unknown;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function audit(params: AuditParams): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await db.auditLog.create({
        data: {
          userId: params.userId,
          schoolId: params.schoolId ?? null,
          userRole: params.userRole,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          module: params.module,
          description: params.description,
          previousData: params.previousData ? JSON.parse(JSON.stringify(params.previousData)) : null,
          newData: params.newData ? JSON.parse(JSON.stringify(params.newData)) : null,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : null,
        },
      });
      return;
    } catch (error) {
      if (attempt === 3) {
        console.error("[AUDIT CRITICAL] Failed after 3 attempts:", error, JSON.stringify(params));
      }
    }
  }
}
