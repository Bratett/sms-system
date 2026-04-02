"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

export async function getAuditReportAction(filters?: {
  module?: string;
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.AUDIT_REPORTS_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (filters?.module) {
    where.module = filters.module;
  }
  if (filters?.userId) {
    where.userId = filters.userId;
  }
  if (filters?.action) {
    where.action = filters.action;
  }
  if (filters?.startDate || filters?.endDate) {
    const timestampFilter: Record<string, unknown> = {};
    if (filters?.startDate) {
      timestampFilter.gte = new Date(filters.startDate);
    }
    if (filters?.endDate) {
      timestampFilter.lte = new Date(filters.endDate);
    }
    where.timestamp = timestampFilter;
  }

  // Paginated audit log entries
  const [entries, totalCount] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take: pageSize,
      include: {
        user: {
          select: { firstName: true, lastName: true, username: true },
        },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  const auditEntries = entries.map((entry) => ({
    id: entry.id,
    userName: `${entry.user.firstName} ${entry.user.lastName}`,
    username: entry.user.username,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    module: entry.module,
    description: entry.description,
    timestamp: entry.timestamp,
  }));

  // Summary counts by action type
  const byActionRaw = await db.auditLog.groupBy({
    by: ["action"],
    where,
    _count: { _all: true },
  });

  const byAction = byActionRaw
    .map((r) => ({
      action: r.action,
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  // Summary counts by module
  const byModuleRaw = await db.auditLog.groupBy({
    by: ["module"],
    where,
    _count: { _all: true },
  });

  const byModule = byModuleRaw
    .map((r) => ({
      module: r.module,
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    data: {
      entries: auditEntries,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
      byAction,
      byModule,
    },
  };
}
