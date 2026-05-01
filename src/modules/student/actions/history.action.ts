"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { PAGINATION_DEFAULT } from "@/lib/constants";
import type { AuditAction, Prisma } from "@prisma/client";

export interface StudentHistoryFilters {
  studentId: string;
  action?: AuditAction;
  page?: number;
  pageSize?: number;
}

export interface StudentHistoryRow {
  id: string;
  timestamp: Date;
  action: string;
  entity: string;
  entityId: string | null;
  module: string;
  description: string;
  userName: string | null;
  userUsername: string | null;
  previousData: unknown;
  newData: unknown;
}

export async function getStudentHistoryAction(filters: StudentHistoryFilters) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.AUDIT_LOG_READ);
  if (denied) return denied;

  // Verify the student belongs to the caller's school
  const student = await db.student.findFirst({
    where: { id: filters.studentId, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (!student) return { error: "Student not found" };

  // Fetch related-entity ID lists (school-scoped) in parallel
  const [medicalIds, documentIds, enrollmentIds, guardianLinkIds, houseAssignmentIds] = await Promise.all([
    db.medicalRecord.findMany({ where: { studentId: filters.studentId, schoolId: ctx.schoolId }, select: { id: true } }),
    db.studentDocument.findMany({ where: { studentId: filters.studentId, schoolId: ctx.schoolId }, select: { id: true } }),
    db.enrollment.findMany({ where: { studentId: filters.studentId, schoolId: ctx.schoolId }, select: { id: true } }),
    db.studentGuardian.findMany({ where: { studentId: filters.studentId, schoolId: ctx.schoolId }, select: { id: true } }),
    db.studentHouse.findMany({ where: { studentId: filters.studentId, schoolId: ctx.schoolId }, select: { id: true } }),
  ]);

  const relatedIds = [
    ...medicalIds.map((r) => r.id),
    ...documentIds.map((r) => r.id),
    ...enrollmentIds.map((r) => r.id),
    ...guardianLinkIds.map((r) => r.id),
    ...houseAssignmentIds.map((r) => r.id),
  ];

  const orClauses: Prisma.AuditLogWhereInput[] = [
    { entity: "Student", entityId: filters.studentId },
  ];
  if (relatedIds.length > 0) {
    orClauses.push({ entityId: { in: relatedIds } });
  }

  const where: Prisma.AuditLogWhereInput = {
    schoolId: ctx.schoolId,
    OR: orClauses,
    ...(filters.action ? { action: filters.action } : {}),
  };

  const page = filters.page ?? PAGINATION_DEFAULT.page;
  const pageSize = Math.min(
    filters.pageSize ?? PAGINATION_DEFAULT.pageSize,
    PAGINATION_DEFAULT.maxPageSize,
  );
  const skip = (page - 1) * pageSize;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
      orderBy: { timestamp: "desc" },
      skip,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ]);

  const data: StudentHistoryRow[] = logs.map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    module: log.module,
    description: log.description,
    userName: log.user ? `${log.user.firstName} ${log.user.lastName}` : null,
    userUsername: log.user?.username ?? null,
    previousData: log.previousData,
    newData: log.newData,
  }));

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
