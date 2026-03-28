"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PAGINATION_DEFAULT } from "@/lib/constants";
import type { AuditAction, Prisma } from "@prisma/client";

interface AuditLogFilters {
  userId?: string;
  module?: string;
  action?: AuditAction;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export async function getAuditLogsAction(filters: AuditLogFilters = {}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const page = filters.page ?? PAGINATION_DEFAULT.page;
  const pageSize = Math.min(
    filters.pageSize ?? PAGINATION_DEFAULT.pageSize,
    PAGINATION_DEFAULT.maxPageSize,
  );
  const skip = (page - 1) * pageSize;

  const where: Prisma.AuditLogWhereInput = {};

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.module) {
    where.module = filters.module;
  }

  if (filters.action) {
    where.action = filters.action;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.timestamp = {};
    if (filters.dateFrom) {
      where.timestamp.gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      where.timestamp.lte = new Date(filters.dateTo + "T23:59:59.999Z");
    }
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
      skip,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ]);

  const mapped = logs.map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    module: log.module,
    description: log.description,
    userName: `${log.user.firstName} ${log.user.lastName}`,
    userUsername: log.user.username,
  }));

  return {
    data: mapped,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getAuditModulesAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const modules = await db.auditLog.findMany({
    select: { module: true },
    distinct: ["module"],
    orderBy: { module: "asc" },
  });

  return { data: modules.map((m) => m.module) };
}

export async function getAuditUsersAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const users = await db.user.findMany({
    select: { id: true, firstName: true, lastName: true, username: true },
    orderBy: { firstName: "asc" },
  });

  return { data: users };
}
