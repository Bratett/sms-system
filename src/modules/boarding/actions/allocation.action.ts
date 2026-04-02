"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Allocations ────────────────────────────────────────────────────

export async function getAllocationsAction(filters?: {
  hostelId?: string;
  termId?: string;
  status?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.termId) where.termId = filters.termId;

  const allocations = await db.bedAllocation.findMany({
    where,
    include: {
      bed: {
        include: {
          dormitory: {
            include: {
              hostel: true,
            },
          },
        },
      },
    },
    orderBy: { allocatedAt: "desc" },
  });

  // Filter by hostelId if provided
  let filtered = allocations;
  if (filters?.hostelId) {
    filtered = allocations.filter((a) => a.bed.dormitory.hostel.id === filters.hostelId);
  }

  // Fetch student names
  const studentIds = filtered.map((a) => a.studentId);
  let studentMap = new Map<string, { name: string; studentNumber: string }>();
  if (studentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, studentId: true },
    });
    studentMap = new Map(
      students.map((s) => [
        s.id,
        { name: `${s.firstName} ${s.lastName}`, studentNumber: s.studentId },
      ]),
    );
  }

  const data = filtered.map((a) => ({
    id: a.id,
    studentId: a.studentId,
    studentNumber: studentMap.get(a.studentId)?.studentNumber ?? "",
    studentName: studentMap.get(a.studentId)?.name ?? "Unknown",
    hostelName: a.bed.dormitory.hostel.name,
    hostelId: a.bed.dormitory.hostel.id,
    dormitoryName: a.bed.dormitory.name,
    bedId: a.bed.id,
    bedNumber: a.bed.bedNumber,
    allocatedAt: a.allocatedAt,
    status: a.status,
    termId: a.termId,
    academicYearId: a.academicYearId,
  }));

  return { data };
}

export async function allocateBedAction(data: {
  studentId: string;
  bedId: string;
  termId: string;
  academicYearId: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  // Check student exists and is boarding
  const student = await db.student.findUnique({
    where: { id: data.studentId },
    select: { id: true, firstName: true, lastName: true, boardingStatus: true },
  });

  if (!student) {
    return { error: "Student not found." };
  }

  if (student.boardingStatus !== "BOARDING") {
    return { error: "Student is not a boarding student." };
  }

  // Check bed is available
  const bed = await db.bed.findUnique({
    where: { id: data.bedId },
    include: {
      dormitory: {
        include: { hostel: true },
      },
    },
  });

  if (!bed) {
    return { error: "Bed not found." };
  }

  if (bed.status !== "AVAILABLE") {
    return { error: "Bed is not available." };
  }

  // Check student not already allocated for this term
  const existingAllocation = await db.bedAllocation.findUnique({
    where: {
      studentId_termId: {
        studentId: data.studentId,
        termId: data.termId,
      },
    },
  });

  if (existingAllocation) {
    return { error: "Student already has a bed allocation for this term." };
  }

  // Create allocation and update bed status in a transaction
  const [allocation] = await db.$transaction([
    db.bedAllocation.create({
      data: {
        bedId: data.bedId,
        studentId: data.studentId,
        termId: data.termId,
        academicYearId: data.academicYearId,
        allocatedBy: session.user.id!,
      },
    }),
    db.bed.update({
      where: { id: data.bedId },
      data: { status: "OCCUPIED" },
    }),
  ]);

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "BedAllocation",
    entityId: allocation.id,
    module: "boarding",
    description: `Allocated ${student.firstName} ${student.lastName} to bed ${bed.bedNumber} in ${bed.dormitory.hostel.name}/${bed.dormitory.name}`,
    newData: allocation,
  });

  return { data: allocation };
}

export async function vacateBedAction(allocationId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const allocation = await db.bedAllocation.findUnique({
    where: { id: allocationId },
    include: {
      bed: {
        include: {
          dormitory: {
            include: { hostel: true },
          },
        },
      },
    },
  });

  if (!allocation) {
    return { error: "Allocation not found." };
  }

  if (allocation.status === "VACATED") {
    return { error: "Bed is already vacated." };
  }

  await db.$transaction([
    db.bedAllocation.update({
      where: { id: allocationId },
      data: {
        status: "VACATED",
        vacatedAt: new Date(),
      },
    }),
    db.bed.update({
      where: { id: allocation.bedId },
      data: { status: "AVAILABLE" },
    }),
  ]);

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "BedAllocation",
    entityId: allocationId,
    module: "boarding",
    description: `Vacated bed ${allocation.bed.bedNumber} in ${allocation.bed.dormitory.hostel.name}/${allocation.bed.dormitory.name}`,
    previousData: allocation,
  });

  return { success: true };
}

export async function bulkAllocateAction(
  allocations: Array<{ studentId: string; bedId: string }>,
  termId: string,
  academicYearId: string,
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const errors: string[] = [];
  let successCount = 0;

  for (const alloc of allocations) {
    const result = await allocateBedAction({
      studentId: alloc.studentId,
      bedId: alloc.bedId,
      termId,
      academicYearId,
    });

    if (result.error) {
      errors.push(`Student ${alloc.studentId}: ${result.error}`);
    } else {
      successCount++;
    }
  }

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "BedAllocation",
    module: "boarding",
    description: `Bulk allocated ${successCount} beds (${errors.length} errors)`,
    newData: { successCount, errorCount: errors.length },
  });

  return {
    success: true,
    successCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function getOccupancyReportAction(termId?: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const hostels = await db.hostel.findMany({
    where: { schoolId: school.id, status: "ACTIVE" },
    include: {
      dormitories: {
        where: { status: "ACTIVE" },
        include: {
          beds: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = hostels.map((hostel) => {
    const allBeds = hostel.dormitories.flatMap((d) => d.beds);
    const totalBeds = allBeds.length;
    const occupiedBeds = allBeds.filter((b) => b.status === "OCCUPIED").length;
    const availableBeds = allBeds.filter((b) => b.status === "AVAILABLE").length;
    const occupancyPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return {
      hostelId: hostel.id,
      hostelName: hostel.name,
      gender: hostel.gender,
      totalBeds,
      occupiedBeds,
      availableBeds,
      occupancyPercent,
    };
  });

  return { data };
}
