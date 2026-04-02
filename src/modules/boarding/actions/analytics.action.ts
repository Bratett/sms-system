"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";

// ─── Occupancy Trends ──────────────────────────────────────────────

export async function getOccupancyTrendsAction(range?: {
  months?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  const permErr = requirePermission(session, PERMISSIONS.HOSTELS_READ);
  if (permErr) return permErr;

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const hostels = await db.hostel.findMany({
    where: { schoolId: school.id, status: "ACTIVE" },
    include: {
      dormitories: {
        where: { status: "ACTIVE" },
        include: { beds: { select: { status: true } } },
      },
    },
  });

  const occupancyByHostel = hostels.map((hostel) => {
    let total = 0;
    let occupied = 0;
    for (const dorm of hostel.dormitories) {
      for (const bed of dorm.beds) {
        total++;
        if (bed.status === "OCCUPIED") occupied++;
      }
    }
    return {
      hostelId: hostel.id,
      hostelName: hostel.name,
      gender: hostel.gender,
      totalBeds: total,
      occupiedBeds: occupied,
      availableBeds: total - occupied,
      occupancyRate: total > 0 ? Math.round((occupied / total) * 100 * 100) / 100 : 0,
    };
  });

  const totalBeds = occupancyByHostel.reduce((s, h) => s + h.totalBeds, 0);
  const totalOccupied = occupancyByHostel.reduce((s, h) => s + h.occupiedBeds, 0);

  return {
    data: {
      overall: {
        totalBeds,
        occupiedBeds: totalOccupied,
        availableBeds: totalBeds - totalOccupied,
        occupancyRate: totalBeds > 0 ? Math.round((totalOccupied / totalBeds) * 100 * 100) / 100 : 0,
      },
      byHostel: occupancyByHostel,
    },
  };
}

// ─── Exeat Analytics ───────────────────────────────────────────────

export async function getExeatAnalyticsAction(filters?: {
  termId?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  const permErr = requirePermission(session, PERMISSIONS.HOSTELS_READ);
  if (permErr) return permErr;

  const where: Record<string, unknown> = {};
  if (filters?.termId) where.termId = filters.termId;

  const exeats = await db.exeat.findMany({
    where,
    select: {
      id: true,
      type: true,
      status: true,
      reason: true,
      requestedAt: true,
      departureDate: true,
      expectedReturnDate: true,
      actualReturnDate: true,
      approvals: {
        select: { actionAt: true, action: true },
        orderBy: { actionAt: "asc" },
      },
    },
  });

  // By type
  const byType: Record<string, number> = {};
  // By status
  const byStatus: Record<string, number> = {};
  // By month
  const byMonth: Record<string, number> = {};

  let totalApprovalTime = 0;
  let approvalCount = 0;
  let overdueCount = 0;
  let totalDuration = 0;
  let durationCount = 0;

  for (const exeat of exeats) {
    byType[exeat.type] = (byType[exeat.type] ?? 0) + 1;
    byStatus[exeat.status] = (byStatus[exeat.status] ?? 0) + 1;

    const month = exeat.requestedAt.toISOString().slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + 1;

    // Approval turnaround
    if (exeat.approvals.length > 0) {
      const firstApproval = exeat.approvals[0];
      const turnaround = firstApproval.actionAt.getTime() - exeat.requestedAt.getTime();
      totalApprovalTime += turnaround;
      approvalCount++;
    }

    // Overdue tracking
    if (exeat.status === "OVERDUE") overdueCount++;

    // Average stay duration
    if (exeat.actualReturnDate && exeat.departureDate) {
      const duration = exeat.actualReturnDate.getTime() - exeat.departureDate.getTime();
      totalDuration += duration;
      durationCount++;
    }
  }

  const avgApprovalTimeMs = approvalCount > 0 ? totalApprovalTime / approvalCount : 0;
  const avgApprovalTimeHours = Math.round(avgApprovalTimeMs / (1000 * 60 * 60) * 10) / 10;
  const avgStayDurationMs = durationCount > 0 ? totalDuration / durationCount : 0;
  const avgStayDurationDays = Math.round(avgStayDurationMs / (1000 * 60 * 60 * 24) * 10) / 10;

  const approvalRate = exeats.length > 0
    ? Math.round(
        (exeats.filter((e) =>
          ["HOUSEMASTER_APPROVED", "HEADMASTER_APPROVED", "DEPARTED", "RETURNED"].includes(e.status)
        ).length / exeats.length) * 100
      )
    : 0;

  // Top reasons
  const reasonCounts: Record<string, number> = {};
  for (const exeat of exeats) {
    const r = exeat.reason.toLowerCase().trim();
    reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
  }
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  return {
    data: {
      total: exeats.length,
      byType,
      byStatus,
      byMonth,
      approvalRate,
      avgApprovalTimeHours,
      avgStayDurationDays,
      overdueCount,
      topReasons,
    },
  };
}

// ─── Roll Call Analytics ───────────────────────────────────────────

export async function getRollCallAnalyticsAction(filters?: {
  hostelId?: string;
  days?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  const permErr = requirePermission(session, PERMISSIONS.HOSTELS_READ);
  if (permErr) return permErr;

  const days = filters?.days ?? 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const where: Record<string, unknown> = {
    date: { gte: since },
  };
  if (filters?.hostelId) where.hostelId = filters.hostelId;

  const rollCalls = await db.rollCall.findMany({
    where,
    include: {
      records: {
        select: { studentId: true, status: true },
      },
    },
    orderBy: { date: "asc" },
  });

  // Daily attendance rates
  const dailyRates: { date: string; type: string; present: number; absent: number; exeat: number; sickBay: number; total: number }[] = [];
  const absenteeMap: Record<string, number> = {};

  for (const rc of rollCalls) {
    let present = 0, absent = 0, exeat = 0, sickBay = 0;
    for (const r of rc.records) {
      switch (r.status) {
        case "PRESENT": present++; break;
        case "ABSENT":
          absent++;
          absenteeMap[r.studentId] = (absenteeMap[r.studentId] ?? 0) + 1;
          break;
        case "EXEAT": exeat++; break;
        case "SICK_BAY": sickBay++; break;
      }
    }
    dailyRates.push({
      date: rc.date.toISOString().slice(0, 10),
      type: rc.type,
      present,
      absent,
      exeat,
      sickBay,
      total: rc.records.length,
    });
  }

  // Chronic absentees (>3 absences)
  const chronicAbsentees = Object.entries(absenteeMap)
    .filter(([, count]) => count > 3)
    .sort((a, b) => b[1] - a[1]);

  // Resolve student names
  const chronicStudentIds = chronicAbsentees.map(([id]) => id);
  let studentMap = new Map<string, string>();
  if (chronicStudentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: chronicStudentIds } },
      select: { id: true, firstName: true, lastName: true, studentId: true },
    });
    studentMap = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName} (${s.studentId})`]));
  }

  const chronicAbsenteeList = chronicAbsentees.map(([id, count]) => ({
    studentId: id,
    studentName: studentMap.get(id) ?? "Unknown",
    absenceCount: count,
  }));

  // Overall stats
  const totalRecords = rollCalls.reduce((s, rc) => s + rc.records.length, 0);
  const totalPresent = dailyRates.reduce((s, d) => s + d.present, 0);
  const overallAttendanceRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100 * 10) / 10 : 0;

  return {
    data: {
      totalRollCalls: rollCalls.length,
      overallAttendanceRate,
      dailyRates,
      chronicAbsentees: chronicAbsenteeList,
    },
  };
}

// ─── Incident Analytics ────────────────────────────────────────────

export async function getIncidentAnalyticsAction(filters?: {
  days?: number;
  hostelId?: string;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  const permErr = requirePermission(session, PERMISSIONS.HOSTELS_READ);
  if (permErr) return permErr;

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const days = filters?.days ?? 90;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const where: Record<string, unknown> = {
    schoolId: school.id,
    date: { gte: since },
  };
  if (filters?.hostelId) where.hostelId = filters.hostelId;

  const incidents = await db.boardingIncident.findMany({
    where,
    select: {
      category: true,
      severity: true,
      status: true,
      date: true,
      createdAt: true,
      resolvedAt: true,
      hostelId: true,
    },
  });

  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  const byHostel: Record<string, number> = {};
  let totalResolutionTime = 0;
  let resolvedCount = 0;

  for (const inc of incidents) {
    byCategory[inc.category] = (byCategory[inc.category] ?? 0) + 1;
    bySeverity[inc.severity] = (bySeverity[inc.severity] ?? 0) + 1;
    byStatus[inc.status] = (byStatus[inc.status] ?? 0) + 1;
    byHostel[inc.hostelId] = (byHostel[inc.hostelId] ?? 0) + 1;

    const month = inc.date.toISOString().slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + 1;

    if (inc.resolvedAt) {
      totalResolutionTime += inc.resolvedAt.getTime() - inc.createdAt.getTime();
      resolvedCount++;
    }
  }

  // Resolve hostel names
  const hostelIds = Object.keys(byHostel);
  const hostels = hostelIds.length > 0
    ? await db.hostel.findMany({ where: { id: { in: hostelIds } }, select: { id: true, name: true } })
    : [];
  const hostelMap = new Map(hostels.map((h) => [h.id, h.name]));

  const byHostelNamed = Object.entries(byHostel).map(([id, count]) => ({
    hostelName: hostelMap.get(id) ?? "Unknown",
    count,
  }));

  const avgResolutionDays = resolvedCount > 0
    ? Math.round((totalResolutionTime / resolvedCount / (1000 * 60 * 60 * 24)) * 10) / 10
    : 0;

  return {
    data: {
      total: incidents.length,
      byCategory,
      bySeverity,
      byStatus,
      byMonth,
      byHostel: byHostelNamed,
      avgResolutionDays,
    },
  };
}

// ─── Sick Bay Analytics ────────────────────────────────────────────

export async function getSickBayAnalyticsAction(filters?: {
  days?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  const permErr = requirePermission(session, PERMISSIONS.HOSTELS_READ);
  if (permErr) return permErr;

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const days = filters?.days ?? 90;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const admissions = await db.sickBayAdmission.findMany({
    where: {
      schoolId: school.id,
      admittedAt: { gte: since },
    },
    select: {
      severity: true,
      status: true,
      symptoms: true,
      admittedAt: true,
      dischargedAt: true,
    },
  });

  const bySeverity: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  let totalStayDuration = 0;
  let stayCount = 0;

  // Common symptoms
  const symptomCounts: Record<string, number> = {};

  for (const adm of admissions) {
    bySeverity[adm.severity] = (bySeverity[adm.severity] ?? 0) + 1;
    byStatus[adm.status] = (byStatus[adm.status] ?? 0) + 1;

    const month = adm.admittedAt.toISOString().slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + 1;

    if (adm.dischargedAt) {
      totalStayDuration += adm.dischargedAt.getTime() - adm.admittedAt.getTime();
      stayCount++;
    }

    // Parse symptoms
    const symptoms = adm.symptoms.toLowerCase().split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
    for (const symptom of symptoms) {
      symptomCounts[symptom] = (symptomCounts[symptom] ?? 0) + 1;
    }
  }

  const avgStayHours = stayCount > 0
    ? Math.round((totalStayDuration / stayCount / (1000 * 60 * 60)) * 10) / 10
    : 0;

  const referralRate = admissions.length > 0
    ? Math.round((admissions.filter((a) => a.status === "REFERRED").length / admissions.length) * 100)
    : 0;

  const commonSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([symptom, count]) => ({ symptom, count }));

  return {
    data: {
      total: admissions.length,
      bySeverity,
      byStatus,
      byMonth,
      avgStayHours,
      referralRate,
      commonSymptoms,
    },
  };
}

// ─── Comprehensive Boarding Overview ───────────────────────────────

export async function getBoardingOverviewAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  const permErr = requirePermission(session, PERMISSIONS.HOSTELS_READ);
  if (permErr) return permErr;

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const [
    totalHostels,
    bedStatusRaw,
    activeExeats,
    overdueExeats,
    currentSickBay,
    activeVisitors,
    pendingTransfers,
    openMaintenance,
    recentIncidents,
  ] = await Promise.all([
    db.hostel.count({ where: { schoolId: school.id, status: "ACTIVE" } }),
    db.bed.groupBy({
      by: ["status"],
      where: { dormitory: { hostel: { schoolId: school.id, status: "ACTIVE" } } },
      _count: { _all: true },
    }),
    db.exeat.count({ where: { status: "DEPARTED" } }),
    db.exeat.count({ where: { status: "OVERDUE" } }),
    db.sickBayAdmission.count({
      where: { schoolId: school.id, status: { in: ["ADMITTED", "UNDER_OBSERVATION"] } },
    }),
    db.boardingVisitor.count({
      where: { schoolId: school.id, status: "CHECKED_IN" },
    }),
    db.bedTransfer.count({
      where: { schoolId: school.id, status: "PENDING" },
    }),
    db.maintenanceRequest.count({
      where: { schoolId: school.id, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } },
    }),
    db.boardingIncident.count({
      where: {
        schoolId: school.id,
        status: { in: ["REPORTED", "INVESTIGATING"] },
      },
    }),
  ]);

  const totalBeds = bedStatusRaw.reduce((s, r) => s + r._count._all, 0);
  const occupiedBeds = bedStatusRaw.find((r) => r.status === "OCCUPIED")?._count._all ?? 0;
  const availableBeds = bedStatusRaw.find((r) => r.status === "AVAILABLE")?._count._all ?? 0;

  return {
    data: {
      totalHostels,
      totalBeds,
      occupiedBeds,
      availableBeds,
      occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100 * 100) / 100 : 0,
      activeExeats,
      overdueExeats,
      currentSickBay,
      activeVisitors,
      pendingTransfers,
      openMaintenance,
      activeIncidents: recentIncidents,
    },
  };
}
