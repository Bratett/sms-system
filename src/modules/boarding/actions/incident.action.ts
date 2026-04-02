"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { reportIncidentSchema, updateIncidentSchema } from "../schemas";

// ─── Boarding Incidents ────────────────────────────────────────────

export async function getIncidentsAction(filters?: {
  hostelId?: string;
  status?: string;
  severity?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (filters?.hostelId) where.hostelId = filters.hostelId;
  if (filters?.status) where.status = filters.status;
  if (filters?.severity) where.severity = filters.severity;
  if (filters?.category) where.category = filters.category;

  const [incidents, total] = await Promise.all([
    db.boardingIncident.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    }),
    db.boardingIncident.count({ where }),
  ]);

  // Resolve student names from studentIds arrays
  const allStudentIds = [...new Set(incidents.flatMap((i) => i.studentIds))];
  let studentMap = new Map<string, { name: string; studentNumber: string }>();
  if (allStudentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: allStudentIds } },
      select: { id: true, firstName: true, lastName: true, studentId: true },
    });
    studentMap = new Map(
      students.map((s) => [
        s.id,
        { name: `${s.firstName} ${s.lastName}`, studentNumber: s.studentId },
      ]),
    );
  }

  // Resolve reporter names
  const reporterIds = [...new Set(incidents.map((i) => i.reportedBy))];
  let reporterMap = new Map<string, string>();
  if (reporterIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: reporterIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    reporterMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  // Resolve hostel names
  const hostelIds = [...new Set(incidents.map((i) => i.hostelId))];
  let hostelMap = new Map<string, string>();
  if (hostelIds.length > 0) {
    const hostels = await db.hostel.findMany({
      where: { id: { in: hostelIds } },
      select: { id: true, name: true },
    });
    hostelMap = new Map(hostels.map((h) => [h.id, h.name]));
  }

  // Resolve dormitory names
  const dormitoryIds = [...new Set(incidents.map((i) => i.dormitoryId).filter(Boolean))] as string[];
  let dormitoryMap = new Map<string, string>();
  if (dormitoryIds.length > 0) {
    const dormitories = await db.dormitory.findMany({
      where: { id: { in: dormitoryIds } },
      select: { id: true, name: true },
    });
    dormitoryMap = new Map(dormitories.map((d) => [d.id, d.name]));
  }

  let data = incidents.map((i) => ({
    id: i.id,
    incidentNumber: i.incidentNumber,
    hostelId: i.hostelId,
    hostelName: hostelMap.get(i.hostelId) ?? "Unknown",
    dormitoryId: i.dormitoryId,
    dormitoryName: i.dormitoryId ? dormitoryMap.get(i.dormitoryId) ?? "Unknown" : null,
    studentIds: i.studentIds,
    studentNames: i.studentIds.map(
      (sid) => studentMap.get(sid)?.name ?? "Unknown",
    ),
    reportedBy: i.reportedBy,
    reporterName: reporterMap.get(i.reportedBy) ?? "Unknown",
    date: i.date,
    time: i.time,
    category: i.category,
    severity: i.severity,
    title: i.title,
    description: i.description,
    actionTaken: i.actionTaken,
    status: i.status,
    resolution: i.resolution,
    parentNotified: i.parentNotified,
    createdAt: i.createdAt,
  }));

  if (filters?.search) {
    const search = filters.search.toLowerCase();
    data = data.filter(
      (i) =>
        i.title.toLowerCase().includes(search) ||
        i.incidentNumber.toLowerCase().includes(search) ||
        i.studentNames.some((name) => name.toLowerCase().includes(search)) ||
        i.reporterName.toLowerCase().includes(search),
    );
  }

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

export async function getIncidentAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const incident = await db.boardingIncident.findUnique({
    where: { id },
  });

  if (!incident) {
    return { error: "Incident not found." };
  }

  // Resolve student names
  let studentMap = new Map<string, { name: string; studentNumber: string }>();
  if (incident.studentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: incident.studentIds } },
      select: { id: true, firstName: true, lastName: true, studentId: true },
    });
    studentMap = new Map(
      students.map((s) => [
        s.id,
        { name: `${s.firstName} ${s.lastName}`, studentNumber: s.studentId },
      ]),
    );
  }

  // Resolve reporter name
  const reporter = await db.user.findUnique({
    where: { id: incident.reportedBy },
    select: { id: true, firstName: true, lastName: true },
  });

  // Resolve resolver name
  let resolverName: string | null = null;
  if (incident.resolvedBy) {
    const resolver = await db.user.findUnique({
      where: { id: incident.resolvedBy },
      select: { firstName: true, lastName: true },
    });
    resolverName = resolver ? `${resolver.firstName} ${resolver.lastName}` : "Unknown";
  }

  // Resolve hostel name
  const hostel = await db.hostel.findUnique({
    where: { id: incident.hostelId },
    select: { id: true, name: true },
  });

  // Resolve dormitory name
  let dormitoryName: string | null = null;
  if (incident.dormitoryId) {
    const dormitory = await db.dormitory.findUnique({
      where: { id: incident.dormitoryId },
      select: { name: true },
    });
    dormitoryName = dormitory?.name ?? "Unknown";
  }

  const data = {
    id: incident.id,
    incidentNumber: incident.incidentNumber,
    schoolId: incident.schoolId,
    hostelId: incident.hostelId,
    hostelName: hostel?.name ?? "Unknown",
    dormitoryId: incident.dormitoryId,
    dormitoryName,
    studentIds: incident.studentIds,
    students: incident.studentIds.map((sid) => ({
      id: sid,
      name: studentMap.get(sid)?.name ?? "Unknown",
      studentNumber: studentMap.get(sid)?.studentNumber ?? "",
    })),
    reportedBy: incident.reportedBy,
    reporterName: reporter ? `${reporter.firstName} ${reporter.lastName}` : "Unknown",
    date: incident.date,
    time: incident.time,
    category: incident.category,
    severity: incident.severity,
    title: incident.title,
    description: incident.description,
    actionTaken: incident.actionTaken,
    status: incident.status,
    resolvedBy: incident.resolvedBy,
    resolverName,
    resolvedAt: incident.resolvedAt,
    resolution: incident.resolution,
    linkedDisciplineId: incident.linkedDisciplineId,
    parentNotified: incident.parentNotified,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
  };

  return { data };
}

export async function reportIncidentAction(data: {
  hostelId: string;
  dormitoryId?: string;
  studentIds: string[];
  date: string;
  time?: string;
  category: string;
  severity: string;
  title: string;
  description: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = reportIncidentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e: { message: string }) => e.message).join(", ") };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "School not found." };
  }

  // Generate incident number
  const year = new Date().getFullYear();
  const count = await db.boardingIncident.count({
    where: {
      incidentNumber: { startsWith: `BIN/${year}/` },
    },
  });
  const incidentNumber = `BIN/${year}/${String(count + 1).padStart(4, "0")}`;

  const incident = await db.boardingIncident.create({
    data: {
      schoolId: school.id,
      incidentNumber,
      hostelId: parsed.data.hostelId,
      dormitoryId: parsed.data.dormitoryId || null,
      studentIds: parsed.data.studentIds,
      reportedBy: session.user.id!,
      date: new Date(parsed.data.date),
      time: parsed.data.time || null,
      category: parsed.data.category as never,
      severity: parsed.data.severity as never,
      title: parsed.data.title,
      description: parsed.data.description,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "BoardingIncident",
    entityId: incident.id,
    module: "boarding",
    description: `Reported boarding incident ${incidentNumber}`,
    newData: incident,
  });

  return { data: incident };
}

export async function updateIncidentAction(
  id: string,
  data: {
    status?: string;
    actionTaken?: string;
    resolution?: string;
    severity?: string;
  },
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = updateIncidentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e: { message: string }) => e.message).join(", ") };
  }

  const incident = await db.boardingIncident.findUnique({ where: { id } });
  if (!incident) {
    return { error: "Incident not found." };
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status) updateData.status = parsed.data.status;
  if (parsed.data.actionTaken !== undefined) updateData.actionTaken = parsed.data.actionTaken;
  if (parsed.data.resolution !== undefined) updateData.resolution = parsed.data.resolution;
  if (parsed.data.severity) updateData.severity = parsed.data.severity;

  // If resolving, set resolver info
  if (parsed.data.status === "RESOLVED") {
    updateData.resolvedBy = session.user.id!;
    updateData.resolvedAt = new Date();
  }

  const updated = await db.boardingIncident.update({
    where: { id },
    data: updateData,
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "BoardingIncident",
    entityId: id,
    module: "boarding",
    description: `Updated boarding incident ${incident.incidentNumber}`,
    previousData: {
      status: incident.status,
      severity: incident.severity,
      actionTaken: incident.actionTaken,
      resolution: incident.resolution,
    },
    newData: updateData,
  });

  return { data: updated };
}

export async function escalateIncidentAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const incident = await db.boardingIncident.findUnique({ where: { id } });
  if (!incident) {
    return { error: "Incident not found." };
  }

  if (incident.status === "ESCALATED") {
    return { error: "Incident is already escalated." };
  }

  if (incident.status === "RESOLVED" || incident.status === "DISMISSED") {
    return { error: "Cannot escalate a resolved or dismissed incident." };
  }

  const [disciplinaryIncident] = await db.$transaction([
    db.disciplinaryIncident.create({
      data: {
        schoolId: incident.schoolId,
        studentId: incident.studentIds[0],
        reportedBy: incident.reportedBy,
        date: incident.date,
        type: incident.category.replace(/_/g, " "),
        description: `[Escalated from Boarding Incident ${incident.incidentNumber}] ${incident.description}`,
        severity: incident.severity as string,
        status: "REPORTED",
      },
    }),
    db.boardingIncident.update({
      where: { id },
      data: {
        status: "ESCALATED",
        // linkedDisciplineId will be set after transaction
      },
    }),
  ]);

  // Update linkedDisciplineId with the created disciplinary incident id
  await db.boardingIncident.update({
    where: { id },
    data: { linkedDisciplineId: disciplinaryIncident.id },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "BoardingIncident",
    entityId: id,
    module: "boarding",
    description: `Escalated boarding incident ${incident.incidentNumber} to disciplinary incident ${disciplinaryIncident.id}`,
    previousData: { status: incident.status },
    newData: { status: "ESCALATED", linkedDisciplineId: disciplinaryIncident.id },
  });

  return { data: { incidentId: id, disciplinaryIncidentId: disciplinaryIncident.id } };
}

export async function getIncidentStatsAction(filters?: {
  hostelId?: string;
  termId?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const where: Record<string, unknown> = {};
  if (filters?.hostelId) where.hostelId = filters.hostelId;

  // Count by status
  const [
    total,
    reported,
    investigating,
    actionTaken,
    resolved,
    escalated,
    dismissed,
  ] = await Promise.all([
    db.boardingIncident.count({ where }),
    db.boardingIncident.count({ where: { ...where, status: "REPORTED" } }),
    db.boardingIncident.count({ where: { ...where, status: "INVESTIGATING" } }),
    db.boardingIncident.count({ where: { ...where, status: "ACTION_TAKEN" } }),
    db.boardingIncident.count({ where: { ...where, status: "RESOLVED" } }),
    db.boardingIncident.count({ where: { ...where, status: "ESCALATED" } }),
    db.boardingIncident.count({ where: { ...where, status: "DISMISSED" } }),
  ]);

  // Count by category
  const [
    curfewViolation,
    propertyDamage,
    bullying,
    fighting,
    unauthorizedAbsence,
    substanceAbuse,
    theft,
    noiseDisturbance,
    healthEmergency,
    safetyHazard,
    otherCategory,
  ] = await Promise.all([
    db.boardingIncident.count({ where: { ...where, category: "CURFEW_VIOLATION" } }),
    db.boardingIncident.count({ where: { ...where, category: "PROPERTY_DAMAGE" } }),
    db.boardingIncident.count({ where: { ...where, category: "BULLYING" } }),
    db.boardingIncident.count({ where: { ...where, category: "FIGHTING" } }),
    db.boardingIncident.count({ where: { ...where, category: "UNAUTHORIZED_ABSENCE" } }),
    db.boardingIncident.count({ where: { ...where, category: "SUBSTANCE_ABUSE" } }),
    db.boardingIncident.count({ where: { ...where, category: "THEFT" } }),
    db.boardingIncident.count({ where: { ...where, category: "NOISE_DISTURBANCE" } }),
    db.boardingIncident.count({ where: { ...where, category: "HEALTH_EMERGENCY" } }),
    db.boardingIncident.count({ where: { ...where, category: "SAFETY_HAZARD" } }),
    db.boardingIncident.count({ where: { ...where, category: "OTHER" } }),
  ]);

  // Count by severity
  const [minor, moderate, major, critical] = await Promise.all([
    db.boardingIncident.count({ where: { ...where, severity: "MINOR" } }),
    db.boardingIncident.count({ where: { ...where, severity: "MODERATE" } }),
    db.boardingIncident.count({ where: { ...where, severity: "MAJOR" } }),
    db.boardingIncident.count({ where: { ...where, severity: "CRITICAL" } }),
  ]);

  return {
    data: {
      total,
      byStatus: {
        reported,
        investigating,
        actionTaken,
        resolved,
        escalated,
        dismissed,
      },
      byCategory: {
        curfewViolation,
        propertyDamage,
        bullying,
        fighting,
        unauthorizedAbsence,
        substanceAbuse,
        theft,
        noiseDisturbance,
        healthEmergency,
        safetyHazard,
        other: otherCategory,
      },
      bySeverity: {
        minor,
        moderate,
        major,
        critical,
      },
    },
  };
}
