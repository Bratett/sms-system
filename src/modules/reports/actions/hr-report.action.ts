"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getHrReportAction(filters?: {
  academicYearId?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Total staff
  const totalStaff = await db.staff.count({
    where: { schoolId: school.id },
  });

  // By type (teaching / non-teaching)
  const byTypeRaw = await db.staff.groupBy({
    by: ["staffType"],
    where: { schoolId: school.id },
    _count: { _all: true },
  });

  const byType = {
    TEACHING: byTypeRaw.find((r) => r.staffType === "TEACHING")?._count._all ?? 0,
    NON_TEACHING:
      byTypeRaw.find((r) => r.staffType === "NON_TEACHING")?._count._all ?? 0,
  };

  // By status
  const byStatusRaw = await db.staff.groupBy({
    by: ["status"],
    where: { schoolId: school.id },
    _count: { _all: true },
  });

  const staffStatuses = ["ACTIVE", "ON_LEAVE", "TERMINATED", "RETIRED", "TRANSFERRED"];
  const byStatus = staffStatuses.map((s) => ({
    status: s,
    count: byStatusRaw.find((r) => r.status === s)?._count._all ?? 0,
  }));

  // Department distribution
  const departments = await db.department.findMany({
    where: { schoolId: school.id },
    select: { id: true, name: true },
  });

  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  const byDeptRaw = await db.employment.groupBy({
    by: ["departmentId"],
    where: {
      status: "ACTIVE",
      departmentId: { not: null },
    },
    _count: { _all: true },
  });

  const departmentDistribution = byDeptRaw
    .filter((r) => r.departmentId !== null)
    .map((r) => ({
      department: deptMap.get(r.departmentId!) ?? "Unknown",
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  // Leave summary
  const leaveWhere: Record<string, unknown> = {};
  if (filters?.academicYearId) {
    // Filter leave requests by date range of the academic year
    const academicYear = await db.academicYear.findUnique({
      where: { id: filters.academicYearId },
    });
    if (academicYear) {
      leaveWhere.appliedAt = {
        gte: academicYear.startDate,
        lte: academicYear.endDate,
      };
    }
  }

  const totalLeaveRequests = await db.leaveRequest.count({
    where: leaveWhere,
  });

  const leaveByStatusRaw = await db.leaveRequest.groupBy({
    by: ["status"],
    where: leaveWhere,
    _count: { _all: true },
  });

  const leaveSummary = {
    total: totalLeaveRequests,
    approved:
      leaveByStatusRaw.find((r) => r.status === "APPROVED")?._count._all ?? 0,
    pending:
      leaveByStatusRaw.find((r) => r.status === "PENDING")?._count._all ?? 0,
    rejected:
      leaveByStatusRaw.find((r) => r.status === "REJECTED")?._count._all ?? 0,
  };

  // Staff count by appointment type
  const byAppointmentRaw = await db.employment.groupBy({
    by: ["appointmentType"],
    where: { status: "ACTIVE" },
    _count: { _all: true },
  });

  const appointmentTypes = [
    "PERMANENT",
    "CONTRACT",
    "NATIONAL_SERVICE",
    "VOLUNTEER",
  ];
  const byAppointmentType = appointmentTypes.map((type) => ({
    type,
    count:
      byAppointmentRaw.find((r) => r.appointmentType === type)?._count._all ??
      0,
  }));

  return {
    data: {
      totalStaff,
      byType,
      byStatus,
      departmentDistribution,
      leaveSummary,
      byAppointmentType,
    },
  };
}
