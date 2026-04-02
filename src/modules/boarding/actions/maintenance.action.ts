"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { createMaintenanceSchema } from "../schemas";

// ─── Maintenance Requests ─────────────────────────────────────────

export async function getMaintenanceRequestsAction(filters?: {
  hostelId?: string;
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.MAINTENANCE_READ);
  if (permErr) return permErr;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (filters?.hostelId) where.hostelId = filters.hostelId;
  if (filters?.status) where.status = filters.status;
  if (filters?.priority) where.priority = filters.priority;
  if (filters?.category) where.category = filters.category;

  const [requests, total] = await Promise.all([
    db.maintenanceRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    }),
    db.maintenanceRequest.count({ where }),
  ]);

  // Resolve hostel names
  const hostelIds = [...new Set(requests.map((r) => r.hostelId))];
  let hostelMap = new Map<string, string>();
  if (hostelIds.length > 0) {
    const hostels = await db.hostel.findMany({
      where: { id: { in: hostelIds } },
      select: { id: true, name: true },
    });
    hostelMap = new Map(hostels.map((h) => [h.id, h.name]));
  }

  // Resolve dormitory names
  const dormitoryIds = [
    ...new Set(requests.map((r) => r.dormitoryId).filter(Boolean)),
  ] as string[];
  let dormitoryMap = new Map<string, string>();
  if (dormitoryIds.length > 0) {
    const dormitories = await db.dormitory.findMany({
      where: { id: { in: dormitoryIds } },
      select: { id: true, name: true },
    });
    dormitoryMap = new Map(dormitories.map((d) => [d.id, d.name]));
  }

  // Resolve bed numbers
  const bedIds = [
    ...new Set(requests.map((r) => r.bedId).filter(Boolean)),
  ] as string[];
  let bedMap = new Map<string, string>();
  if (bedIds.length > 0) {
    const beds = await db.bed.findMany({
      where: { id: { in: bedIds } },
      select: { id: true, bedNumber: true },
    });
    bedMap = new Map(beds.map((b) => [b.id, b.bedNumber]));
  }

  // Resolve user names (reporter, assignee, resolver)
  const userIds = [
    ...new Set([
      ...requests.map((r) => r.reportedBy),
      ...requests.map((r) => r.assignedTo).filter(Boolean),
      ...requests.map((r) => r.resolvedBy).filter(Boolean),
    ]),
  ] as string[];
  let userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    userMap = new Map(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
    );
  }

  let data = requests.map((r) => ({
    id: r.id,
    requestNumber: r.requestNumber,
    hostelId: r.hostelId,
    hostelName: hostelMap.get(r.hostelId) ?? "Unknown",
    dormitoryId: r.dormitoryId,
    dormitoryName: r.dormitoryId
      ? dormitoryMap.get(r.dormitoryId) ?? "Unknown"
      : null,
    bedId: r.bedId,
    bedNumber: r.bedId ? bedMap.get(r.bedId) ?? "Unknown" : null,
    reportedBy: r.reportedBy,
    reporterName: userMap.get(r.reportedBy) ?? "Unknown",
    assignedTo: r.assignedTo,
    assigneeName: r.assignedTo
      ? userMap.get(r.assignedTo) ?? "Unknown"
      : null,
    resolvedBy: r.resolvedBy,
    resolverName: r.resolvedBy
      ? userMap.get(r.resolvedBy) ?? "Unknown"
      : null,
    title: r.title,
    description: r.description,
    category: r.category,
    priority: r.priority,
    status: r.status,
    assignedAt: r.assignedAt,
    resolvedAt: r.resolvedAt,
    resolutionNotes: r.resolutionNotes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  if (filters?.search) {
    const search = filters.search.toLowerCase();
    data = data.filter(
      (r) =>
        r.title.toLowerCase().includes(search) ||
        r.requestNumber.toLowerCase().includes(search) ||
        r.reporterName.toLowerCase().includes(search) ||
        (r.assigneeName && r.assigneeName.toLowerCase().includes(search)),
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

export async function createMaintenanceRequestAction(data: {
  hostelId: string;
  dormitoryId?: string;
  bedId?: string;
  title: string;
  description: string;
  category: string;
  priority: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.MAINTENANCE_CREATE);
  if (permErr) return permErr;

  const parsed = createMaintenanceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e: { message: string }) => e.message).join(", ") };
  }

  // Generate request number: MNT/YYYY/NNNN
  const year = new Date().getFullYear();
  const count = await db.maintenanceRequest.count({
    where: {
      requestNumber: { startsWith: `MNT/${year}/` },
    },
  });
  const requestNumber = `MNT/${year}/${String(count + 1).padStart(4, "0")}`;

  const request = await db.maintenanceRequest.create({
    data: {
      schoolId: ctx.schoolId,
      requestNumber,
      hostelId: parsed.data.hostelId,
      dormitoryId: parsed.data.dormitoryId || null,
      bedId: parsed.data.bedId || null,
      reportedBy: ctx.session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category as never,
      priority: parsed.data.priority as never,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "MaintenanceRequest",
    entityId: request.id,
    module: "boarding",
    description: `Created maintenance request ${requestNumber}`,
    newData: request,
  });

  if (parsed.data.priority === "URGENT") {
    dispatch({
      event: NOTIFICATION_EVENTS.MAINTENANCE_URGENT,
      title: "Urgent Maintenance Request",
      message: `Urgent maintenance request: ${parsed.data.title}`,
      recipients: [],
      schoolId: ctx.schoolId,
    }).catch(() => {});
  }

  return { data: request };
}

export async function assignMaintenanceAction(id: string, staffId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.MAINTENANCE_ASSIGN);
  if (permErr) return permErr;

  const request = await db.maintenanceRequest.findUnique({ where: { id } });
  if (!request) {
    return { error: "Maintenance request not found." };
  }

  if (request.status !== "OPEN" && request.status !== "ASSIGNED") {
    return {
      error: "Can only assign requests with status OPEN or ASSIGNED.",
    };
  }

  const updated = await db.maintenanceRequest.update({
    where: { id },
    data: {
      assignedTo: staffId,
      assignedAt: new Date(),
      status: "ASSIGNED",
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "MaintenanceRequest",
    entityId: id,
    module: "boarding",
    description: `Assigned maintenance request ${request.requestNumber} to staff ${staffId}`,
    previousData: {
      assignedTo: request.assignedTo,
      status: request.status,
    },
    newData: {
      assignedTo: staffId,
      status: "ASSIGNED",
    },
  });

  return { data: updated };
}

export async function updateMaintenanceStatusAction(
  id: string,
  status: string,
  notes?: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.MAINTENANCE_UPDATE);
  if (permErr) return permErr;

  const request = await db.maintenanceRequest.findUnique({ where: { id } });
  if (!request) {
    return { error: "Maintenance request not found." };
  }

  // Validate status transitions
  const validTransitions: Record<string, string[]> = {
    ASSIGNED: ["IN_PROGRESS"],
    IN_PROGRESS: ["RESOLVED"],
  };

  const currentStatus = request.status as string;
  const allowedNext = validTransitions[currentStatus] ?? [];

  // Any status can transition to CLOSED
  if (status !== "CLOSED" && !allowedNext.includes(status)) {
    return {
      error: `Cannot transition from ${currentStatus} to ${status}.`,
    };
  }

  const updateData: Record<string, unknown> = { status };

  if (status === "RESOLVED") {
    updateData.resolvedAt = new Date();
    updateData.resolvedBy = ctx.session.user.id;
    if (notes) updateData.resolutionNotes = notes;
  }

  const updated = await db.maintenanceRequest.update({
    where: { id },
    data: updateData,
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "MaintenanceRequest",
    entityId: id,
    module: "boarding",
    description: `Updated maintenance request ${request.requestNumber} status to ${status}`,
    previousData: { status: request.status },
    newData: { status, ...(notes ? { resolutionNotes: notes } : {}) },
  });

  return { data: updated };
}

export async function resolveMaintenanceAction(id: string, notes: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.MAINTENANCE_UPDATE);
  if (permErr) return permErr;

  const request = await db.maintenanceRequest.findUnique({ where: { id } });
  if (!request) {
    return { error: "Maintenance request not found." };
  }

  const updated = await db.maintenanceRequest.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedBy: ctx.session.user.id,
      resolutionNotes: notes,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "MaintenanceRequest",
    entityId: id,
    module: "boarding",
    description: `Resolved maintenance request ${request.requestNumber}`,
    previousData: { status: request.status },
    newData: {
      status: "RESOLVED",
      resolutionNotes: notes,
    },
  });

  return { data: updated };
}

export async function getMaintenanceStatsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.MAINTENANCE_READ);
  if (permErr) return permErr;

  // Count by status
  const [open, assigned, inProgress, resolved, closed] = await Promise.all([
    db.maintenanceRequest.count({ where: { status: "OPEN" } }),
    db.maintenanceRequest.count({ where: { status: "ASSIGNED" } }),
    db.maintenanceRequest.count({ where: { status: "IN_PROGRESS" } }),
    db.maintenanceRequest.count({ where: { status: "RESOLVED" } }),
    db.maintenanceRequest.count({ where: { status: "CLOSED" } }),
  ]);

  // Count by category
  const [
    plumbing,
    electrical,
    furniture,
    structural,
    cleaning,
    pestControl,
    security,
    otherCategory,
  ] = await Promise.all([
    db.maintenanceRequest.count({ where: { category: "PLUMBING" } }),
    db.maintenanceRequest.count({ where: { category: "ELECTRICAL" } }),
    db.maintenanceRequest.count({ where: { category: "FURNITURE" } }),
    db.maintenanceRequest.count({ where: { category: "STRUCTURAL" } }),
    db.maintenanceRequest.count({ where: { category: "CLEANING" } }),
    db.maintenanceRequest.count({ where: { category: "PEST_CONTROL" } }),
    db.maintenanceRequest.count({ where: { category: "SECURITY" } }),
    db.maintenanceRequest.count({ where: { category: "OTHER" } }),
  ]);

  // Count by priority
  const [low, medium, high, urgent] = await Promise.all([
    db.maintenanceRequest.count({ where: { priority: "LOW" } }),
    db.maintenanceRequest.count({ where: { priority: "MEDIUM" } }),
    db.maintenanceRequest.count({ where: { priority: "HIGH" } }),
    db.maintenanceRequest.count({ where: { priority: "URGENT" } }),
  ]);

  return {
    data: {
      open,
      assigned,
      inProgress,
      resolved,
      closed,
      byCategory: {
        plumbing,
        electrical,
        furniture,
        structural,
        cleaning,
        pestControl,
        security,
        other: otherCategory,
      },
      byPriority: {
        low,
        medium,
        high,
        urgent,
      },
    },
  };
}
