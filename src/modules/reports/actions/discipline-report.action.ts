"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getDisciplineReportAction(filters?: {
  termId?: string;
  academicYearId?: string;
  status?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const where: Record<string, unknown> = { schoolId: school.id };

  // Apply date range filter if termId provided
  if (filters?.termId) {
    const term = await db.term.findUnique({
      where: { id: filters.termId },
    });
    if (term) {
      where.date = { gte: term.startDate, lte: term.endDate };
    }
  } else if (filters?.academicYearId) {
    const academicYear = await db.academicYear.findUnique({
      where: { id: filters.academicYearId },
    });
    if (academicYear) {
      where.date = { gte: academicYear.startDate, lte: academicYear.endDate };
    }
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  // Total incidents by severity
  const bySeverityRaw = await db.disciplinaryIncident.groupBy({
    by: ["severity"],
    where,
    _count: { _all: true },
  });

  const severityLevels = ["MINOR", "MODERATE", "MAJOR", "CRITICAL"];
  const bySeverity = severityLevels.map((s) => ({
    severity: s,
    count: bySeverityRaw.find((r) => r.severity === s)?._count._all ?? 0,
  }));

  const totalIncidents = bySeverity.reduce((sum, s) => sum + s.count, 0);

  // By status
  const byStatusRaw = await db.disciplinaryIncident.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  const statusLabels = ["REPORTED", "INVESTIGATING", "RESOLVED", "DISMISSED"];
  const byStatus = statusLabels.map((s) => ({
    status: s,
    count: byStatusRaw.find((r) => r.status === s)?._count._all ?? 0,
  }));

  // Top incident types
  const byTypeRaw = await db.disciplinaryIncident.groupBy({
    by: ["type"],
    where,
    _count: { _all: true },
    orderBy: { _count: { type: "desc" } },
    take: 10,
  });

  const topIncidentTypes = byTypeRaw.map((r) => ({
    type: r.type,
    count: r._count._all,
  }));

  // Recent incidents (last 20)
  const recentIncidents = await db.disciplinaryIncident.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      studentId: true,
      date: true,
      type: true,
      severity: true,
      status: true,
      description: true,
      createdAt: true,
    },
  });

  // Resolve student names
  const studentIds = recentIncidents.map((i) => i.studentId);
  let studentMap = new Map<string, string>();
  if (studentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    studentMap = new Map(
      students.map((s) => [s.id, `${s.firstName} ${s.lastName}`])
    );
  }

  const recentIncidentList = recentIncidents.map((i) => ({
    id: i.id,
    studentName: studentMap.get(i.studentId) ?? "Unknown",
    date: i.date,
    type: i.type,
    severity: i.severity,
    status: i.status,
    description: i.description,
    createdAt: i.createdAt,
  }));

  return {
    data: {
      totalIncidents,
      bySeverity,
      byStatus,
      topIncidentTypes,
      recentIncidents: recentIncidentList,
    },
  };
}
