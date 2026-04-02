"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

// ─── Vehicles ──────────────────────────────────────────────────────

export async function getVehiclesAction(filters?: {
  search?: string;
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSPORT_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Prisma.VehicleWhereInput = {
    schoolId: ctx.schoolId,
    ...(filters?.status && { status: filters.status as any }),
    ...(filters?.type && { type: filters.type as any }),
    ...(filters?.search && {
      OR: [
        { registrationNumber: { contains: filters.search, mode: "insensitive" } },
        { driverName: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
  };

  const [vehicles, total] = await Promise.all([
    db.vehicle.findMany({
      where,
      include: {
        _count: { select: { routes: true } },
      },
      orderBy: { registrationNumber: "asc" },
      skip,
      take: pageSize,
    }),
    db.vehicle.count({ where }),
  ]);

  const data = vehicles.map((v) => ({
    id: v.id,
    registrationNumber: v.registrationNumber,
    type: v.type,
    capacity: v.capacity,
    driverName: v.driverName,
    driverPhone: v.driverPhone,
    status: v.status,
    insuranceExpiry: v.insuranceExpiry,
    lastServiceDate: v.lastServiceDate,
    routeCount: v._count.routes,
    createdAt: v.createdAt,
  }));

  return { data, total, page, pageSize };
}

export async function createVehicleAction(data: {
  registrationNumber: string;
  type: "BUS" | "MINIBUS" | "VAN" | "CAR";
  capacity: number;
  driverName?: string;
  driverPhone?: string;
  insuranceExpiry?: Date;
  lastServiceDate?: Date;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSPORT_CREATE);
  if (denied) return denied;

  // Check duplicate registration number
  const existing = await db.vehicle.findUnique({
    where: {
      schoolId_registrationNumber: {
        schoolId: ctx.schoolId,
        registrationNumber: data.registrationNumber,
      },
    },
  });

  if (existing) {
    return { error: `A vehicle with registration "${data.registrationNumber}" already exists.` };
  }

  const vehicle = await db.vehicle.create({
    data: {
      schoolId: ctx.schoolId,
      registrationNumber: data.registrationNumber,
      type: data.type,
      capacity: data.capacity,
      driverName: data.driverName || null,
      driverPhone: data.driverPhone || null,
      insuranceExpiry: data.insuranceExpiry ?? null,
      lastServiceDate: data.lastServiceDate ?? null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Vehicle",
    entityId: vehicle.id,
    module: "transport",
    description: `Created vehicle "${vehicle.registrationNumber}"`,
    newData: vehicle,
  });

  return { data: vehicle };
}

export async function updateVehicleAction(
  id: string,
  data: {
    registrationNumber?: string;
    type?: "BUS" | "MINIBUS" | "VAN" | "CAR";
    capacity?: number;
    driverName?: string;
    driverPhone?: string;
    status?: "ACTIVE" | "MAINTENANCE" | "RETIRED";
    insuranceExpiry?: Date;
    lastServiceDate?: Date;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSPORT_UPDATE);
  if (denied) return denied;

  const existing = await db.vehicle.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Vehicle not found." };
  }

  if (data.registrationNumber && data.registrationNumber !== existing.registrationNumber) {
    const duplicate = await db.vehicle.findUnique({
      where: {
        schoolId_registrationNumber: {
          schoolId: ctx.schoolId,
          registrationNumber: data.registrationNumber,
        },
      },
    });
    if (duplicate) {
      return { error: `A vehicle with registration "${data.registrationNumber}" already exists.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.vehicle.update({
    where: { id },
    data: {
      registrationNumber: data.registrationNumber ?? existing.registrationNumber,
      type: data.type ?? existing.type,
      capacity: data.capacity !== undefined ? data.capacity : existing.capacity,
      driverName: data.driverName !== undefined ? data.driverName || null : existing.driverName,
      driverPhone: data.driverPhone !== undefined ? data.driverPhone || null : existing.driverPhone,
      status: data.status ?? existing.status,
      insuranceExpiry: data.insuranceExpiry !== undefined ? data.insuranceExpiry : existing.insuranceExpiry,
      lastServiceDate: data.lastServiceDate !== undefined ? data.lastServiceDate : existing.lastServiceDate,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "Vehicle",
    entityId: id,
    module: "transport",
    description: `Updated vehicle "${updated.registrationNumber}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteVehicleAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSPORT_DELETE);
  if (denied) return denied;

  const vehicle = await db.vehicle.findUnique({
    where: { id },
    include: {
      routes: {
        where: { status: "ACTIVE" },
      },
    },
  });

  if (!vehicle) {
    return { error: "Vehicle not found." };
  }

  if (vehicle.routes.length > 0) {
    return { error: "Cannot delete vehicle with active routes. Please reassign or deactivate routes first." };
  }

  await db.vehicle.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "Vehicle",
    entityId: id,
    module: "transport",
    description: `Deleted vehicle "${vehicle.registrationNumber}"`,
    previousData: vehicle,
  });

  return { success: true };
}

// ─── Routes ────────────────────────────────────────────────────────

export async function getRoutesAction(filters?: {
  search?: string;
  status?: string;
  vehicleId?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSPORT_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Prisma.RouteWhereInput = {
    schoolId: ctx.schoolId,
    ...(filters?.status && { status: filters.status as any }),
    ...(filters?.vehicleId && { vehicleId: filters.vehicleId }),
    ...(filters?.search && {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
  };

  const [routes, total] = await Promise.all([
    db.route.findMany({
      where,
      include: {
        vehicle: { select: { id: true, registrationNumber: true, type: true, driverName: true } },
        _count: { select: { stops: true, assignments: true } },
      },
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
    }),
    db.route.count({ where }),
  ]);

  const data = routes.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    vehicleId: r.vehicleId,
    vehicleRegistration: r.vehicle?.registrationNumber ?? null,
    vehicleType: r.vehicle?.type ?? null,
    driverName: r.vehicle?.driverName ?? null,
    startPoint: r.startPoint,
    endPoint: r.endPoint,
    distance: r.distance,
    estimatedDuration: r.estimatedDuration,
    fee: r.fee,
    status: r.status,
    stopCount: r._count.stops,
    studentCount: r._count.assignments,
    createdAt: r.createdAt,
  }));

  return { data, total, page, pageSize };
}

export async function getRouteAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSPORT_READ);
  if (denied) return denied;

  const route = await db.route.findUnique({
    where: { id },
    include: {
      vehicle: { select: { id: true, registrationNumber: true, type: true, capacity: true, driverName: true, driverPhone: true } },
      stops: { orderBy: { orderIndex: "asc" } },
      assignments: true,
    },
  });

  if (!route) {
    return { error: "Route not found." };
  }

  // Fetch student names for assignments
  const studentIds = route.assignments.map((a) => a.studentId);
  let studentMap = new Map<string, string>();
  if (studentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    studentMap = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
  }

  const data = {
    id: route.id,
    name: route.name,
    description: route.description,
    vehicleId: route.vehicleId,
    vehicle: route.vehicle,
    startPoint: route.startPoint,
    endPoint: route.endPoint,
    distance: route.distance,
    estimatedDuration: route.estimatedDuration,
    fee: route.fee,
    status: route.status,
    stops: route.stops.map((s) => ({
      id: s.id,
      name: s.name,
      orderIndex: s.orderIndex,
      pickupTime: s.pickupTime,
      dropoffTime: s.dropoffTime,
    })),
    assignments: route.assignments.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      studentName: studentMap.get(a.studentId) ?? "Unknown",
      stopId: a.stopId,
      academicYearId: a.academicYearId,
      pickupPoint: a.pickupPoint,
      dropoffPoint: a.dropoffPoint,
      assignedAt: a.assignedAt,
    })),
  };

  return { data };
}

export async function createRouteAction(data: {
  name: string;
  description?: string;
  vehicleId?: string;
  startPoint?: string;
  endPoint?: string;
  distance?: number;
  estimatedDuration?: number;
  fee?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSPORT_CREATE);
  if (denied) return denied;

  // Check duplicate name
  const existing = await db.route.findUnique({
    where: {
      schoolId_name: {
        schoolId: ctx.schoolId,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { error: `A route named "${data.name}" already exists.` };
  }

  const route = await db.route.create({
    data: {
      schoolId: ctx.schoolId,
      name: data.name,
      description: data.description || null,
      vehicleId: data.vehicleId || null,
      startPoint: data.startPoint || null,
      endPoint: data.endPoint || null,
      distance: data.distance ?? null,
      estimatedDuration: data.estimatedDuration ?? null,
      fee: data.fee ?? null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "Route",
    entityId: route.id,
    module: "transport",
    description: `Created route "${route.name}"`,
    newData: route,
  });

  return { data: route };
}

export async function updateRouteAction(
  id: string,
  data: {
    name?: string;
    description?: string;
    vehicleId?: string;
    startPoint?: string;
    endPoint?: string;
    distance?: number;
    estimatedDuration?: number;
    fee?: number;
    status?: "ACTIVE" | "INACTIVE";
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSPORT_UPDATE);
  if (denied) return denied;

  const existing = await db.route.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Route not found." };
  }

  if (data.name && data.name !== existing.name) {
    const duplicate = await db.route.findUnique({
      where: {
        schoolId_name: {
          schoolId: ctx.schoolId,
          name: data.name,
        },
      },
    });
    if (duplicate) {
      return { error: `A route named "${data.name}" already exists.` };
    }
  }

  const previousData = { ...existing };

  const updated = await db.route.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      description: data.description !== undefined ? data.description || null : existing.description,
      vehicleId: data.vehicleId !== undefined ? data.vehicleId || null : existing.vehicleId,
      startPoint: data.startPoint !== undefined ? data.startPoint || null : existing.startPoint,
      endPoint: data.endPoint !== undefined ? data.endPoint || null : existing.endPoint,
      distance: data.distance !== undefined ? data.distance : existing.distance,
      estimatedDuration: data.estimatedDuration !== undefined ? data.estimatedDuration : existing.estimatedDuration,
      fee: data.fee !== undefined ? data.fee : existing.fee,
      status: data.status ?? existing.status,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "Route",
    entityId: id,
    module: "transport",
    description: `Updated route "${updated.name}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

export async function deleteRouteAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSPORT_DELETE);
  if (denied) return denied;

  const route = await db.route.findUnique({
    where: { id },
    include: {
      _count: { select: { assignments: true } },
    },
  });

  if (!route) {
    return { error: "Route not found." };
  }

  if (route._count.assignments > 0) {
    return { error: "Cannot delete route with student assignments. Please remove all assignments first." };
  }

  await db.route.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "Route",
    entityId: id,
    module: "transport",
    description: `Deleted route "${route.name}"`,
    previousData: route,
  });

  return { success: true };
}

// ─── Route Stops ───────────────────────────────────────────────────

export async function addRouteStopAction(data: {
  routeId: string;
  name: string;
  pickupTime?: string;
  dropoffTime?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSPORT_CREATE);
  if (denied) return denied;

  const route = await db.route.findUnique({ where: { id: data.routeId } });
  if (!route) {
    return { error: "Route not found." };
  }

  // Get next orderIndex
  const lastStop = await db.routeStop.findFirst({
    where: { routeId: data.routeId },
    orderBy: { orderIndex: "desc" },
  });

  const orderIndex = (lastStop?.orderIndex ?? -1) + 1;

  const stop = await db.routeStop.create({
    data: {
      schoolId: ctx.schoolId,
      routeId: data.routeId,
      name: data.name,
      orderIndex,
      pickupTime: data.pickupTime || null,
      dropoffTime: data.dropoffTime || null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "RouteStop",
    entityId: stop.id,
    module: "transport",
    description: `Added stop "${stop.name}" to route "${route.name}"`,
    newData: stop,
  });

  return { data: stop };
}

export async function removeRouteStopAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSPORT_DELETE);
  if (denied) return denied;

  const stop = await db.routeStop.findUnique({
    where: { id },
    include: { route: { select: { name: true } } },
  });

  if (!stop) {
    return { error: "Route stop not found." };
  }

  await db.routeStop.delete({ where: { id } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "RouteStop",
    entityId: id,
    module: "transport",
    description: `Removed stop "${stop.name}" from route "${stop.route.name}"`,
    previousData: stop,
  });

  return { success: true };
}

// ─── Student Transport Assignments ─────────────────────────────────

export async function assignStudentToRouteAction(data: {
  studentId: string;
  routeId: string;
  stopId?: string;
  academicYearId: string;
  pickupPoint?: string;
  dropoffPoint?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSPORT_ASSIGN);
  if (denied) return denied;

  // Check if student already assigned for this academic year
  const existing = await db.studentTransport.findUnique({
    where: {
      studentId_academicYearId: {
        studentId: data.studentId,
        academicYearId: data.academicYearId,
      },
    },
  });

  if (existing) {
    return { error: "Student is already assigned to a route for this academic year." };
  }

  const route = await db.route.findUnique({ where: { id: data.routeId } });
  if (!route) {
    return { error: "Route not found." };
  }

  const assignment = await db.studentTransport.create({
    data: {
      schoolId: ctx.schoolId,
      studentId: data.studentId,
      routeId: data.routeId,
      stopId: data.stopId || null,
      academicYearId: data.academicYearId,
      pickupPoint: data.pickupPoint || null,
      dropoffPoint: data.dropoffPoint || null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "StudentTransport",
    entityId: assignment.id,
    module: "transport",
    description: `Assigned student ${data.studentId} to route "${route.name}"`,
    newData: assignment,
  });

  return { data: assignment };
}

export async function removeStudentFromRouteAction(assignmentId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSPORT_ASSIGN);
  if (denied) return denied;

  const assignment = await db.studentTransport.findUnique({
    where: { id: assignmentId },
    include: { route: { select: { name: true } } },
  });

  if (!assignment) {
    return { error: "Assignment not found." };
  }

  await db.studentTransport.delete({ where: { id: assignmentId } });

  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "StudentTransport",
    entityId: assignmentId,
    module: "transport",
    description: `Removed student ${assignment.studentId} from route "${assignment.route.name}"`,
    previousData: assignment,
  });

  return { success: true };
}

// ─── Transport Stats ───────────────────────────────────────────────

export async function getTransportStatsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.TRANSPORT_READ);
  if (denied) return denied;

  const [vehicles, activeRoutes, assignedStudents, allVehicles] = await Promise.all([
    db.vehicle.count({ where: { schoolId: ctx.schoolId, status: "ACTIVE" } }),
    db.route.count({ where: { schoolId: ctx.schoolId, status: "ACTIVE" } }),
    db.studentTransport.count({
      where: { route: { schoolId: ctx.schoolId } },
    }),
    db.vehicle.findMany({
      where: { schoolId: ctx.schoolId, status: "ACTIVE" },
      select: { capacity: true },
    }),
  ]);

  const totalCapacity = allVehicles.reduce((sum, v) => sum + v.capacity, 0);
  const availableCapacity = totalCapacity - assignedStudents;

  return {
    data: {
      totalVehicles: vehicles,
      activeRoutes,
      assignedStudents,
      totalCapacity,
      availableCapacity: Math.max(0, availableCapacity),
    },
  };
}
