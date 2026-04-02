"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Get Incidents (paginated) ──────────────────────────────────────

export async function getIncidentsAction(filters?: {
  studentId?: string;
  status?: string;
  severity?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DISCIPLINE_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };

  if (filters?.studentId) {
    where.studentId = filters.studentId;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.severity) {
    where.severity = filters.severity;
  }

  const [incidents, total] = await Promise.all([
    db.disciplinaryIncident.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.disciplinaryIncident.count({ where }),
  ]);

  // Fetch student names
  const studentIds = [...new Set(incidents.map((i) => i.studentId))];
  let studentMap = new Map<string, string>();
  if (studentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    studentMap = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
  }

  // Fetch reporter names
  const reporterIds = [...new Set(incidents.map((i) => i.reportedBy))];
  let reporterMap = new Map<string, string>();
  if (reporterIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: reporterIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    reporterMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  const data = incidents.map((i) => ({
    ...i,
    studentName: studentMap.get(i.studentId) ?? "Unknown",
    reportedByName: reporterMap.get(i.reportedBy) ?? "Unknown",
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

// ─── Create Incident ────────────────────────────────────────────────

export async function createIncidentAction(data: {
  studentId: string;
  date: string;
  type: string;
  description: string;
  severity: string;
  sanction?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DISCIPLINE_CREATE);
  if (denied) return denied;

  const student = await db.student.findUnique({
    where: { id: data.studentId },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!student) {
    return { error: "Student not found." };
  }

  const incident = await db.disciplinaryIncident.create({
    data: {
      schoolId: ctx.schoolId,
      studentId: data.studentId,
      reportedBy: ctx.session.user.id,
      date: new Date(data.date),
      type: data.type,
      description: data.description,
      severity: data.severity,
      sanction: data.sanction || null,
      status: "REPORTED",
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "DisciplinaryIncident",
    entityId: incident.id,
    module: "discipline",
    description: `Reported ${data.type} incident for ${student.firstName} ${student.lastName}`,
    newData: incident,
  });

  return { data: incident };
}

// ─── Update Incident ────────────────────────────────────────────────

export async function updateIncidentAction(
  id: string,
  data: {
    type?: string;
    description?: string;
    severity?: string;
    sanction?: string;
    status?: string;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DISCIPLINE_UPDATE);
  if (denied) return denied;

  const existing = await db.disciplinaryIncident.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Incident not found." };
  }

  const previousData = { ...existing };

  const updated = await db.disciplinaryIncident.update({
    where: { id },
    data: {
      type: data.type ?? existing.type,
      description: data.description ?? existing.description,
      severity: data.severity ?? existing.severity,
      sanction: data.sanction !== undefined ? data.sanction || null : existing.sanction,
      status: data.status ?? existing.status,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "DisciplinaryIncident",
    entityId: id,
    module: "discipline",
    description: `Updated disciplinary incident`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

// ─── Resolve Incident ───────────────────────────────────────────────

export async function resolveIncidentAction(id: string, notes?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DISCIPLINE_APPROVE);
  if (denied) return denied;

  const existing = await db.disciplinaryIncident.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Incident not found." };
  }

  const previousData = { ...existing };

  const updated = await db.disciplinaryIncident.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedBy: ctx.session.user.id,
      resolvedAt: new Date(),
      notes: notes || existing.notes,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "DisciplinaryIncident",
    entityId: id,
    module: "discipline",
    description: `Resolved disciplinary incident`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

// ─── Get Incident Types ─────────────────────────────────────────────

export async function getIncidentTypesAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DISCIPLINE_READ);
  if (denied) return denied;

  return {
    data: [
      "Fighting",
      "Truancy",
      "Vandalism",
      "Disobedience",
      "Theft",
      "Bullying",
      "Drug Use",
      "Cheating",
      "Dress Code Violation",
      "Other",
    ],
  };
}

// ─── Search Students (for incident form) ────────────────────────────

export async function searchStudentsForDisciplineAction(search: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.DISCIPLINE_READ);
  if (denied) return denied;

  if (!search || search.length < 2) {
    return { data: [] };
  }

  const students = await db.student.findMany({
    where: {
      schoolId: ctx.schoolId,
      status: "ACTIVE",
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
    },
    take: 10,
    orderBy: { firstName: "asc" },
  });

  return { data: students };
}
