"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createInspectionSchema } from "../schemas";

// ─── Hostel Inspections ──────────────────────────────────────────

export async function getInspectionsAction(filters?: {
  hostelId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
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
  if (filters?.type) where.type = filters.type;
  if (filters?.dateFrom || filters?.dateTo) {
    where.inspectionDate = {
      ...(filters?.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters?.dateTo ? { lte: new Date(filters.dateTo) } : {}),
    };
  }

  const [inspections, total] = await Promise.all([
    db.hostelInspection.findMany({
      where,
      orderBy: { inspectionDate: "desc" },
      take: pageSize,
      skip,
    }),
    db.hostelInspection.count({ where }),
  ]);

  // Resolve hostel names
  const hostelIds = [...new Set(inspections.map((i) => i.hostelId))];
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
    ...new Set(inspections.map((i) => i.dormitoryId).filter(Boolean)),
  ] as string[];
  let dormitoryMap = new Map<string, string>();
  if (dormitoryIds.length > 0) {
    const dormitories = await db.dormitory.findMany({
      where: { id: { in: dormitoryIds } },
      select: { id: true, name: true },
    });
    dormitoryMap = new Map(dormitories.map((d) => [d.id, d.name]));
  }

  // Resolve inspector names
  const inspectorIds = [...new Set(inspections.map((i) => i.inspectedBy))];
  let inspectorMap = new Map<string, string>();
  if (inspectorIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: inspectorIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    inspectorMap = new Map(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
    );
  }

  const data = inspections.map((i) => ({
    id: i.id,
    hostelId: i.hostelId,
    hostelName: hostelMap.get(i.hostelId) ?? "Unknown",
    dormitoryId: i.dormitoryId,
    dormitoryName: i.dormitoryId
      ? dormitoryMap.get(i.dormitoryId) ?? "Unknown"
      : null,
    inspectedBy: i.inspectedBy,
    inspectorName: inspectorMap.get(i.inspectedBy) ?? "Unknown",
    inspectionDate: i.inspectionDate,
    type: i.type,
    overallRating: i.overallRating,
    cleanlinessRating: i.cleanlinessRating,
    facilityRating: i.facilityRating,
    safetyRating: i.safetyRating,
    remarks: i.remarks,
    issues: i.issues,
    followUpRequired: i.followUpRequired,
    createdAt: i.createdAt,
  }));

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

export async function createInspectionAction(data: {
  hostelId: string;
  dormitoryId?: string;
  inspectionDate: string;
  type: string;
  overallRating: string;
  cleanlinessRating: string;
  facilityRating: string;
  safetyRating: string;
  remarks?: string;
  issues?: string;
  followUpRequired?: boolean;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = createInspectionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e: { message: string }) => e.message).join(", ") };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "School not found." };
  }

  const inspection = await db.hostelInspection.create({
    data: {
      schoolId: school.id,
      hostelId: parsed.data.hostelId,
      dormitoryId: parsed.data.dormitoryId || null,
      inspectedBy: session.user.id!,
      inspectionDate: new Date(parsed.data.inspectionDate),
      type: parsed.data.type as never,
      overallRating: parsed.data.overallRating as never,
      cleanlinessRating: parsed.data.cleanlinessRating as never,
      facilityRating: parsed.data.facilityRating as never,
      safetyRating: parsed.data.safetyRating as never,
      remarks: parsed.data.remarks || null,
      issues: parsed.data.issues || null,
      followUpRequired: parsed.data.followUpRequired ?? false,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "HostelInspection",
    entityId: inspection.id,
    module: "boarding",
    description: `Recorded hostel inspection for ${parsed.data.hostelId} on ${parsed.data.inspectionDate}`,
    newData: inspection,
  });

  return { data: inspection };
}

export async function getInspectionAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const inspection = await db.hostelInspection.findUnique({
    where: { id },
  });

  if (!inspection) {
    return { error: "Inspection not found." };
  }

  // Resolve hostel name
  const hostel = await db.hostel.findUnique({
    where: { id: inspection.hostelId },
    select: { id: true, name: true },
  });

  // Resolve dormitory name
  let dormitoryName: string | null = null;
  if (inspection.dormitoryId) {
    const dormitory = await db.dormitory.findUnique({
      where: { id: inspection.dormitoryId },
      select: { name: true },
    });
    dormitoryName = dormitory?.name ?? "Unknown";
  }

  // Resolve inspector name
  const inspector = await db.user.findUnique({
    where: { id: inspection.inspectedBy },
    select: { id: true, firstName: true, lastName: true },
  });

  const data = {
    id: inspection.id,
    schoolId: inspection.schoolId,
    hostelId: inspection.hostelId,
    hostelName: hostel?.name ?? "Unknown",
    dormitoryId: inspection.dormitoryId,
    dormitoryName,
    inspectedBy: inspection.inspectedBy,
    inspectorName: inspector
      ? `${inspector.firstName} ${inspector.lastName}`
      : "Unknown",
    inspectionDate: inspection.inspectionDate,
    type: inspection.type,
    overallRating: inspection.overallRating,
    cleanlinessRating: inspection.cleanlinessRating,
    facilityRating: inspection.facilityRating,
    safetyRating: inspection.safetyRating,
    remarks: inspection.remarks,
    issues: inspection.issues,
    followUpRequired: inspection.followUpRequired,
    createdAt: inspection.createdAt,
    updatedAt: inspection.updatedAt,
  };

  return { data };
}

export async function getInspectionTrendsAction(hostelId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const inspections = await db.hostelInspection.findMany({
    where: { hostelId },
    orderBy: { inspectionDate: "desc" },
    take: 20,
    select: {
      inspectionDate: true,
      overallRating: true,
      cleanlinessRating: true,
      facilityRating: true,
      safetyRating: true,
      type: true,
    },
  });

  const data = inspections.map((i) => ({
    date: i.inspectionDate,
    overallRating: i.overallRating,
    cleanlinessRating: i.cleanlinessRating,
    facilityRating: i.facilityRating,
    safetyRating: i.safetyRating,
    type: i.type,
  }));

  return { data };
}
