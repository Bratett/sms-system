"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getBoardingReportAction(filters?: {
  termId?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Total hostels
  const totalHostels = await db.hostel.count({
    where: { schoolId: school.id, status: "ACTIVE" },
  });

  // Total beds and their statuses
  const bedStatusRaw = await db.bed.groupBy({
    by: ["status"],
    where: {
      dormitory: {
        hostel: { schoolId: school.id, status: "ACTIVE" },
      },
    },
    _count: { _all: true },
  });

  const totalBeds = bedStatusRaw.reduce((sum, r) => sum + r._count._all, 0);
  const occupiedBeds =
    bedStatusRaw.find((r) => r.status === "OCCUPIED")?._count._all ?? 0;
  const availableBeds =
    bedStatusRaw.find((r) => r.status === "AVAILABLE")?._count._all ?? 0;

  // Occupancy rate per hostel
  const hostels = await db.hostel.findMany({
    where: { schoolId: school.id, status: "ACTIVE" },
    include: {
      dormitories: {
        where: { status: "ACTIVE" },
        include: {
          beds: {
            select: { status: true },
          },
        },
      },
    },
  });

  const occupancyByHostel = hostels.map((hostel) => {
    let hostelTotalBeds = 0;
    let hostelOccupied = 0;

    for (const dorm of hostel.dormitories) {
      for (const bed of dorm.beds) {
        hostelTotalBeds++;
        if (bed.status === "OCCUPIED") {
          hostelOccupied++;
        }
      }
    }

    return {
      hostelId: hostel.id,
      hostelName: hostel.name,
      gender: hostel.gender,
      totalBeds: hostelTotalBeds,
      occupiedBeds: hostelOccupied,
      availableBeds: hostelTotalBeds - hostelOccupied,
      occupancyRate:
        hostelTotalBeds > 0
          ? Math.round((hostelOccupied / hostelTotalBeds) * 100 * 100) / 100
          : 0,
    };
  });

  // Bed allocation by gender
  const bedsByGender = { MALE: 0, FEMALE: 0 };
  for (const hostel of occupancyByHostel) {
    const g = hostel.gender as string;
    if (g in bedsByGender) {
      bedsByGender[g as keyof typeof bedsByGender] += hostel.occupiedBeds;
    }
  }

  // Exeat data
  const exeatWhere: Record<string, unknown> = {};
  if (filters?.termId) {
    exeatWhere.termId = filters.termId;
  }

  // Active exeats (departed but not returned)
  const activeExeatCount = await db.exeat.count({
    where: {
      ...exeatWhere,
      status: "DEPARTED",
    },
  });

  // Overdue exeats
  const overdueExeatCount = await db.exeat.count({
    where: {
      ...exeatWhere,
      status: "OVERDUE",
    },
  });

  // Recent exeats (last 20)
  const recentExeats = await db.exeat.findMany({
    where: exeatWhere,
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      exeatNumber: true,
      studentId: true,
      reason: true,
      type: true,
      departureDate: true,
      expectedReturnDate: true,
      actualReturnDate: true,
      status: true,
    },
  });

  // Resolve student names for exeats
  const exeatStudentIds = recentExeats.map((e) => e.studentId);
  let studentMap = new Map<string, string>();
  if (exeatStudentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: exeatStudentIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    studentMap = new Map(
      students.map((s) => [s.id, `${s.firstName} ${s.lastName}`])
    );
  }

  const recentExeatList = recentExeats.map((e) => ({
    id: e.id,
    exeatNumber: e.exeatNumber,
    studentName: studentMap.get(e.studentId) ?? "Unknown",
    reason: e.reason,
    type: e.type,
    departureDate: e.departureDate,
    expectedReturnDate: e.expectedReturnDate,
    actualReturnDate: e.actualReturnDate,
    status: e.status,
  }));

  return {
    data: {
      totalHostels,
      totalBeds,
      occupiedBeds,
      availableBeds,
      occupancyByHostel,
      activeExeatCount,
      overdueExeatCount,
      recentExeats: recentExeatList,
      bedAllocationByGender: bedsByGender,
    },
  };
}
