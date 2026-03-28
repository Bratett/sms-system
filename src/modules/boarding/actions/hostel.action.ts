"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// ─── Hostels ────────────────────────────────────────────────────────

export async function getHostelsAction() {
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

    return {
      id: hostel.id,
      name: hostel.name,
      gender: hostel.gender,
      capacity: hostel.capacity,
      wardenId: hostel.wardenId,
      description: hostel.description,
      status: hostel.status,
      dormitoryCount: hostel.dormitories.length,
      totalBeds,
      occupiedBeds,
      availableBeds,
      createdAt: hostel.createdAt,
    };
  });

  // Fetch warden names for hostels that have wardens
  const wardenIds = data.filter((h) => h.wardenId).map((h) => h.wardenId!);
  let wardenMap = new Map<string, string>();
  if (wardenIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: wardenIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    wardenMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  const result = data.map((h) => ({
    ...h,
    wardenName: h.wardenId ? wardenMap.get(h.wardenId) ?? null : null,
  }));

  return { data: result };
}

export async function getHostelAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const hostel = await db.hostel.findUnique({
    where: { id },
    include: {
      dormitories: {
        where: { status: "ACTIVE" },
        include: {
          beds: {
            include: {
              allocations: {
                where: { status: "ACTIVE" },
              },
            },
            orderBy: { bedNumber: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!hostel) {
    return { error: "Hostel not found." };
  }

  // Fetch student names for active allocations
  const studentIds = hostel.dormitories
    .flatMap((d) => d.beds)
    .flatMap((b) => b.allocations)
    .map((a) => a.studentId);

  let studentMap = new Map<string, string>();
  if (studentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    studentMap = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
  }

  const data = {
    id: hostel.id,
    name: hostel.name,
    gender: hostel.gender,
    capacity: hostel.capacity,
    wardenId: hostel.wardenId,
    description: hostel.description,
    status: hostel.status,
    dormitories: hostel.dormitories.map((d) => ({
      id: d.id,
      name: d.name,
      floor: d.floor,
      capacity: d.capacity,
      beds: d.beds.map((b) => {
        const activeAllocation = b.allocations[0] ?? null;
        return {
          id: b.id,
          bedNumber: b.bedNumber,
          status: b.status,
          studentName: activeAllocation
            ? studentMap.get(activeAllocation.studentId) ?? null
            : null,
          allocationId: activeAllocation?.id ?? null,
        };
      }),
    })),
  };

  return { data };
}

export async function createHostelAction(data: {
  name: string;
  gender: "MALE" | "FEMALE";
  capacity?: number;
  wardenId?: string;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Check duplicate name
  const existing = await db.hostel.findUnique({
    where: {
      schoolId_name: {
        schoolId: school.id,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { error: `A hostel named "${data.name}" already exists.` };
  }

  const hostel = await db.hostel.create({
    data: {
      schoolId: school.id,
      name: data.name,
      gender: data.gender,
      capacity: data.capacity ?? 0,
      wardenId: data.wardenId || null,
      description: data.description || null,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Hostel",
    entityId: hostel.id,
    module: "boarding",
    description: `Created hostel "${hostel.name}"`,
    newData: hostel,
  });

  return { data: hostel };
}

export async function updateHostelAction(
  id: string,
  data: {
    name?: string;
    gender?: "MALE" | "FEMALE";
    capacity?: number;
    wardenId?: string;
    description?: string;
    status?: "ACTIVE" | "INACTIVE";
  },
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const existing = await db.hostel.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Hostel not found." };
  }

  if (data.name && data.name !== existing.name) {
    const duplicate = await db.hostel.findUnique({
      where: {
        schoolId_name: {
          schoolId: school.id,
          name: data.name,
        },
      },
    });
    if (duplicate) {
      return { error: `A hostel named "${data.name}" already exists.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.hostel.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      gender: data.gender ?? existing.gender,
      capacity: data.capacity !== undefined ? data.capacity : existing.capacity,
      wardenId: data.wardenId !== undefined ? data.wardenId || null : existing.wardenId,
      description: data.description !== undefined ? data.description || null : existing.description,
      status: data.status ?? existing.status,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Hostel",
    entityId: id,
    module: "boarding",
    description: `Updated hostel "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteHostelAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const hostel = await db.hostel.findUnique({
    where: { id },
    include: {
      dormitories: {
        include: {
          beds: {
            where: { status: "OCCUPIED" },
          },
        },
      },
    },
  });

  if (!hostel) {
    return { error: "Hostel not found." };
  }

  const occupiedBeds = hostel.dormitories.flatMap((d) => d.beds).length;
  if (occupiedBeds > 0) {
    return { error: "Cannot delete hostel with occupied beds. Please vacate all beds first." };
  }

  await db.hostel.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "Hostel",
    entityId: id,
    module: "boarding",
    description: `Deleted hostel "${hostel.name}"`,
    previousData: hostel,
  });

  return { success: true };
}

// ─── Dormitories ────────────────────────────────────────────────────

export async function getDormitoriesAction(hostelId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const dormitories = await db.dormitory.findMany({
    where: { hostelId, status: "ACTIVE" },
    include: {
      beds: true,
    },
    orderBy: { name: "asc" },
  });

  const data = dormitories.map((d) => ({
    id: d.id,
    hostelId: d.hostelId,
    name: d.name,
    floor: d.floor,
    capacity: d.capacity,
    totalBeds: d.beds.length,
    occupiedBeds: d.beds.filter((b) => b.status === "OCCUPIED").length,
    availableBeds: d.beds.filter((b) => b.status === "AVAILABLE").length,
    maintenanceBeds: d.beds.filter((b) => b.status === "MAINTENANCE").length,
  }));

  return { data };
}

export async function createDormitoryAction(data: {
  hostelId: string;
  name: string;
  floor?: string;
  capacity?: number;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  // Check duplicate
  const existing = await db.dormitory.findUnique({
    where: {
      hostelId_name: {
        hostelId: data.hostelId,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { error: `A dormitory named "${data.name}" already exists in this hostel.` };
  }

  const dormitory = await db.dormitory.create({
    data: {
      hostelId: data.hostelId,
      name: data.name,
      floor: data.floor || null,
      capacity: data.capacity ?? 0,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Dormitory",
    entityId: dormitory.id,
    module: "boarding",
    description: `Created dormitory "${dormitory.name}"`,
    newData: dormitory,
  });

  return { data: dormitory };
}

export async function updateDormitoryAction(
  id: string,
  data: {
    name?: string;
    floor?: string;
    capacity?: number;
  },
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const existing = await db.dormitory.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Dormitory not found." };
  }

  if (data.name && data.name !== existing.name) {
    const duplicate = await db.dormitory.findUnique({
      where: {
        hostelId_name: {
          hostelId: existing.hostelId,
          name: data.name,
        },
      },
    });
    if (duplicate) {
      return { error: `A dormitory named "${data.name}" already exists in this hostel.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.dormitory.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      floor: data.floor !== undefined ? data.floor || null : existing.floor,
      capacity: data.capacity !== undefined ? data.capacity : existing.capacity,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Dormitory",
    entityId: id,
    module: "boarding",
    description: `Updated dormitory "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteDormitoryAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const dormitory = await db.dormitory.findUnique({
    where: { id },
    include: {
      beds: {
        where: { status: "OCCUPIED" },
      },
    },
  });

  if (!dormitory) {
    return { error: "Dormitory not found." };
  }

  if (dormitory.beds.length > 0) {
    return { error: "Cannot delete dormitory with occupied beds. Please vacate all beds first." };
  }

  await db.dormitory.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "Dormitory",
    entityId: id,
    module: "boarding",
    description: `Deleted dormitory "${dormitory.name}"`,
    previousData: dormitory,
  });

  return { success: true };
}

// ─── Beds ───────────────────────────────────────────────────────────

export async function getBedsAction(dormitoryId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const beds = await db.bed.findMany({
    where: { dormitoryId },
    include: {
      allocations: {
        where: { status: "ACTIVE" },
      },
    },
    orderBy: { bedNumber: "asc" },
  });

  // Fetch student names
  const studentIds = beds
    .flatMap((b) => b.allocations)
    .map((a) => a.studentId);

  let studentMap = new Map<string, string>();
  if (studentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    studentMap = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
  }

  const data = beds.map((b) => {
    const activeAllocation = b.allocations[0] ?? null;
    return {
      id: b.id,
      bedNumber: b.bedNumber,
      status: b.status,
      studentName: activeAllocation
        ? studentMap.get(activeAllocation.studentId) ?? null
        : null,
      studentId: activeAllocation?.studentId ?? null,
      allocationId: activeAllocation?.id ?? null,
    };
  });

  return { data };
}

export async function createBedsAction(
  dormitoryId: string,
  count: number,
  prefix?: string,
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const dormitory = await db.dormitory.findUnique({ where: { id: dormitoryId } });
  if (!dormitory) {
    return { error: "Dormitory not found." };
  }

  // Get current highest bed number
  const existingBeds = await db.bed.findMany({
    where: { dormitoryId },
    orderBy: { bedNumber: "asc" },
  });

  const startNumber = existingBeds.length + 1;
  const bedPrefix = prefix || "Bed";

  const bedsToCreate = [];
  for (let i = 0; i < count; i++) {
    bedsToCreate.push({
      dormitoryId,
      bedNumber: `${bedPrefix} ${startNumber + i}`,
    });
  }

  await db.bed.createMany({
    data: bedsToCreate,
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Bed",
    entityId: dormitoryId,
    module: "boarding",
    description: `Created ${count} beds in dormitory "${dormitory.name}"`,
    newData: { count, prefix: bedPrefix },
  });

  return { success: true, count };
}

export async function deleteBedAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const bed = await db.bed.findUnique({ where: { id } });
  if (!bed) {
    return { error: "Bed not found." };
  }

  if (bed.status !== "AVAILABLE") {
    return { error: "Can only delete beds that are available. Please vacate the bed first." };
  }

  await db.bed.delete({ where: { id } });

  await audit({
    userId: session.user.id!,
    action: "DELETE",
    entity: "Bed",
    entityId: id,
    module: "boarding",
    description: `Deleted bed "${bed.bedNumber}"`,
    previousData: bed,
  });

  return { success: true };
}
