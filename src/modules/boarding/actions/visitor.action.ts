"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { checkInVisitorSchema } from "../schemas";

// ─── Visitors ──────────────────────────────────────────────────────

export async function getVisitorsAction(filters?: {
  hostelId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }
  const permErr = requirePermission(session, PERMISSIONS.BOARDING_VISITORS_READ);
  if (permErr) return permErr;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (filters?.hostelId) where.hostelId = filters.hostelId;
  if (filters?.status) where.status = filters.status;
  if (filters?.dateFrom || filters?.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (filters?.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
    if (filters?.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }
    where.checkInAt = dateFilter;
  }

  const [visitors, total] = await Promise.all([
    db.boardingVisitor.findMany({
      where,
      orderBy: { checkInAt: "desc" },
      take: pageSize,
      skip,
    }),
    db.boardingVisitor.count({ where }),
  ]);

  // Fetch student names
  const studentIds = [...new Set(visitors.map((v) => v.studentId))];
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

  // Fetch hostel names
  const hostelIds = [...new Set(visitors.map((v) => v.hostelId))];
  let hostelMap = new Map<string, string>();
  if (hostelIds.length > 0) {
    const hostels = await db.hostel.findMany({
      where: { id: { in: hostelIds } },
      select: { id: true, name: true },
    });
    hostelMap = new Map(hostels.map((h) => [h.id, h.name]));
  }

  // Fetch user names for checkedInBy / checkedOutBy
  const userIds = [
    ...new Set([
      ...visitors.map((v) => v.checkedInBy),
      ...visitors.filter((v) => v.checkedOutBy).map((v) => v.checkedOutBy!),
    ]),
  ];
  let userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  let data = visitors.map((v) => ({
    id: v.id,
    studentId: v.studentId,
    studentName: studentMap.get(v.studentId)?.name ?? "Unknown",
    studentNumber: studentMap.get(v.studentId)?.studentNumber ?? "",
    hostelId: v.hostelId,
    hostelName: hostelMap.get(v.hostelId) ?? "Unknown",
    visitorName: v.visitorName,
    relationship: v.relationship,
    visitorPhone: v.visitorPhone,
    visitorIdNumber: v.visitorIdNumber,
    purpose: v.purpose,
    checkInAt: v.checkInAt,
    checkOutAt: v.checkOutAt,
    checkedInBy: userMap.get(v.checkedInBy) ?? "Unknown",
    checkedOutBy: v.checkedOutBy ? (userMap.get(v.checkedOutBy) ?? "Unknown") : null,
    status: v.status,
    notes: v.notes,
  }));

  if (filters?.search) {
    const search = filters.search.toLowerCase();
    data = data.filter(
      (v) =>
        v.visitorName.toLowerCase().includes(search) ||
        v.studentName.toLowerCase().includes(search) ||
        v.studentNumber.toLowerCase().includes(search) ||
        v.visitorPhone.includes(search),
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

export async function checkInVisitorAction(data: {
  studentId: string;
  hostelId: string;
  visitorName: string;
  relationship: string;
  visitorPhone: string;
  visitorIdNumber?: string;
  purpose: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }
  const permErr = requirePermission(session, PERMISSIONS.BOARDING_VISITORS_CREATE);
  if (permErr) return permErr;

  const parsed = checkInVisitorSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "School not found." };
  }

  const visitor = await db.boardingVisitor.create({
    data: {
      schoolId: school.id,
      studentId: parsed.data.studentId,
      hostelId: parsed.data.hostelId,
      visitorName: parsed.data.visitorName,
      relationship: parsed.data.relationship,
      visitorPhone: parsed.data.visitorPhone,
      visitorIdNumber: parsed.data.visitorIdNumber || null,
      purpose: parsed.data.purpose,
      notes: parsed.data.notes || null,
      checkedInBy: session.user.id!,
      status: "CHECKED_IN",
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "BoardingVisitor",
    entityId: visitor.id,
    module: "boarding",
    description: `Checked in visitor ${parsed.data.visitorName} for student ${parsed.data.studentId}`,
    newData: visitor,
  });

  return { data: visitor };
}

export async function checkOutVisitorAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }
  const permErr = requirePermission(session, PERMISSIONS.BOARDING_VISITORS_CREATE);
  if (permErr) return permErr;

  const visitor = await db.boardingVisitor.findUnique({ where: { id } });
  if (!visitor) {
    return { error: "Visitor record not found." };
  }

  if (visitor.status === "CHECKED_OUT") {
    return { error: "Visitor is already checked out." };
  }

  const updated = await db.boardingVisitor.update({
    where: { id },
    data: {
      checkOutAt: new Date(),
      checkedOutBy: session.user.id!,
      status: "CHECKED_OUT",
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "BoardingVisitor",
    entityId: id,
    module: "boarding",
    description: `Checked out visitor ${visitor.visitorName}`,
    previousData: { status: visitor.status, checkOutAt: visitor.checkOutAt },
    newData: { status: "CHECKED_OUT", checkOutAt: updated.checkOutAt },
  });

  return { data: updated };
}

export async function getActiveVisitorsAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }
  const permErr = requirePermission(session, PERMISSIONS.BOARDING_VISITORS_READ);
  if (permErr) return permErr;

  const visitors = await db.boardingVisitor.findMany({
    where: { status: "CHECKED_IN" },
    orderBy: { checkInAt: "desc" },
  });

  // Fetch student names
  const studentIds = [...new Set(visitors.map((v) => v.studentId))];
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

  // Fetch hostel names
  const hostelIds = [...new Set(visitors.map((v) => v.hostelId))];
  let hostelMap = new Map<string, string>();
  if (hostelIds.length > 0) {
    const hostels = await db.hostel.findMany({
      where: { id: { in: hostelIds } },
      select: { id: true, name: true },
    });
    hostelMap = new Map(hostels.map((h) => [h.id, h.name]));
  }

  // Fetch user names for checkedInBy
  const userIds = [...new Set(visitors.map((v) => v.checkedInBy))];
  let userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  const data = visitors.map((v) => ({
    id: v.id,
    studentId: v.studentId,
    studentName: studentMap.get(v.studentId)?.name ?? "Unknown",
    studentNumber: studentMap.get(v.studentId)?.studentNumber ?? "",
    hostelId: v.hostelId,
    hostelName: hostelMap.get(v.hostelId) ?? "Unknown",
    visitorName: v.visitorName,
    relationship: v.relationship,
    visitorPhone: v.visitorPhone,
    purpose: v.purpose,
    checkInAt: v.checkInAt,
    checkedInBy: userMap.get(v.checkedInBy) ?? "Unknown",
    notes: v.notes,
  }));

  return { data };
}

export async function getStudentVisitHistoryAction(studentId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }
  const permErr = requirePermission(session, PERMISSIONS.BOARDING_VISITORS_READ);
  if (permErr) return permErr;

  const visitors = await db.boardingVisitor.findMany({
    where: { studentId },
    orderBy: { checkInAt: "desc" },
  });

  // Fetch hostel names
  const hostelIds = [...new Set(visitors.map((v) => v.hostelId))];
  let hostelMap = new Map<string, string>();
  if (hostelIds.length > 0) {
    const hostels = await db.hostel.findMany({
      where: { id: { in: hostelIds } },
      select: { id: true, name: true },
    });
    hostelMap = new Map(hostels.map((h) => [h.id, h.name]));
  }

  // Fetch user names for checkedInBy / checkedOutBy
  const userIds = [
    ...new Set([
      ...visitors.map((v) => v.checkedInBy),
      ...visitors.filter((v) => v.checkedOutBy).map((v) => v.checkedOutBy!),
    ]),
  ];
  let userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  const data = visitors.map((v) => ({
    id: v.id,
    hostelId: v.hostelId,
    hostelName: hostelMap.get(v.hostelId) ?? "Unknown",
    visitorName: v.visitorName,
    relationship: v.relationship,
    visitorPhone: v.visitorPhone,
    visitorIdNumber: v.visitorIdNumber,
    purpose: v.purpose,
    checkInAt: v.checkInAt,
    checkOutAt: v.checkOutAt,
    checkedInBy: userMap.get(v.checkedInBy) ?? "Unknown",
    checkedOutBy: v.checkedOutBy ? (userMap.get(v.checkedOutBy) ?? "Unknown") : null,
    status: v.status,
    notes: v.notes,
  }));

  return { data };
}

export async function getVisitorStatsAction(filters?: {
  hostelId?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }
  const permErr = requirePermission(session, PERMISSIONS.BOARDING_VISITORS_READ);
  if (permErr) return permErr;

  const where: Record<string, unknown> = {};
  if (filters?.hostelId) where.hostelId = filters.hostelId;

  // Active visitors (currently checked in)
  const activeVisitors = await db.boardingVisitor.count({
    where: { ...where, status: "CHECKED_IN" },
  });

  // Today's visitors
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayTotal = await db.boardingVisitor.count({
    where: {
      ...where,
      checkInAt: { gte: todayStart, lte: todayEnd },
    },
  });

  // This week's visitors
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekTotal = await db.boardingVisitor.count({
    where: {
      ...where,
      checkInAt: { gte: weekStart },
    },
  });

  // Breakdown by relationship
  const allVisitors = await db.boardingVisitor.findMany({
    where: {
      ...where,
      checkInAt: { gte: weekStart },
    },
    select: { relationship: true },
  });

  const byRelationship: Record<string, number> = {};
  for (const v of allVisitors) {
    byRelationship[v.relationship] = (byRelationship[v.relationship] || 0) + 1;
  }

  return {
    data: {
      activeVisitors,
      todayTotal,
      weekTotal,
      byRelationship,
    },
  };
}
