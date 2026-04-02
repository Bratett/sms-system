"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { PERMISSIONS, denyPermission } from "@/lib/permissions";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";

// ─── Report Staff Disciplinary Incident ────────────────────────────

export async function reportStaffDisciplinaryAction(data: {
  staffId: string;
  date: string;
  type: string;
  description: string;
  severity?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.STAFF_DISCIPLINE_CREATE)) return { error: "Insufficient permissions" };

  const record = await db.staffDisciplinary.create({
    data: {
      schoolId: ctx.schoolId,
      staffId: data.staffId,
      reportedBy: ctx.session.user.id,
      date: new Date(data.date),
      type: data.type,
      description: data.description,
      severity: data.severity || "MINOR",
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "StaffDisciplinary",
    entityId: record.id,
    module: "hr",
    description: `Reported staff disciplinary: ${data.type} for staff ${data.staffId}`,
  });

  // Notify the staff member about the disciplinary report
  const staffMember = await db.staff.findUnique({
    where: { id: data.staffId },
    select: { userId: true, firstName: true, lastName: true },
  });
  if (staffMember?.userId) {
    dispatch({
      event: NOTIFICATION_EVENTS.STAFF_DISCIPLINE_REPORTED,
      title: "Disciplinary Report Filed",
      message: `A disciplinary report (${data.type}) has been filed. Please contact HR for details.`,
      recipients: [{ userId: staffMember.userId, name: `${staffMember.firstName} ${staffMember.lastName}` }],
      schoolId: ctx.schoolId,
    }).catch(() => {});
  }

  return { data: record };
}

// ─── Get Staff Disciplinary Records ────────────────────────────────

export async function getStaffDisciplinaryRecordsAction(filters?: {
  staffId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.STAFF_DISCIPLINE_READ)) return { error: "Insufficient permissions" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.staffId) where.staffId = filters.staffId;
  if (filters?.status) where.status = filters.status;

  const [records, total] = await Promise.all([
    db.staffDisciplinary.findMany({
      where,
      include: { staff: { select: { firstName: true, lastName: true, staffId: true } } },
      orderBy: { date: "desc" },
      skip,
      take: pageSize,
    }),
    db.staffDisciplinary.count({ where }),
  ]);

  return {
    data: records,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// ─── Resolve Staff Disciplinary ────────────────────────────────────

export async function resolveStaffDisciplinaryAction(
  id: string,
  data: { sanction?: string; status: string; notes?: string },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  if (denyPermission(ctx.session, PERMISSIONS.STAFF_DISCIPLINE_CREATE)) return { error: "Insufficient permissions" };

  const previous = await db.staffDisciplinary.findUnique({ where: { id } });
  if (!previous) return { error: "Record not found" };

  const record = await db.staffDisciplinary.update({
    where: { id },
    data: {
      sanction: data.sanction,
      status: data.status,
      notes: data.notes,
      resolvedBy: ctx.session.user.id,
      resolvedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "StaffDisciplinary",
    entityId: id,
    module: "hr",
    description: `Resolved staff disciplinary: ${data.status}`,
    previousData: previous,
    newData: record,
  });

  return { data: record };
}
