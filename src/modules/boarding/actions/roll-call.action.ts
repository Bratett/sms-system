"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// ─── Roll Call ──────────────────────────────────────────────────────

export async function conductRollCallAction(data: {
  hostelId: string;
  type: "MORNING" | "EVENING";
  records: Array<{
    studentId: string;
    status: "PRESENT" | "ABSENT" | "EXEAT" | "SICK_BAY";
    notes?: string;
  }>;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ROLL_CALL_CREATE);
  if (denied) return denied;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if roll call already exists for this hostel/date/type
  const existing = await db.rollCall.findUnique({
    where: {
      hostelId_date_type: {
        hostelId: data.hostelId,
        date: today,
        type: data.type,
      },
    },
  });

  if (existing) {
    // Update existing roll call records
    const upserts = data.records.map((record) =>
      db.rollCallRecord.upsert({
        where: {
          rollCallId_studentId: {
            rollCallId: existing.id,
            studentId: record.studentId,
          },
        },
        create: {
          schoolId: ctx.schoolId,
          rollCallId: existing.id,
          studentId: record.studentId,
          status: record.status,
          notes: record.notes || null,
        },
        update: {
          status: record.status,
          notes: record.notes || null,
        },
      }),
    );

    await db.$transaction(upserts);

    await audit({
      userId: ctx.session.user.id,
      action: "UPDATE",
      entity: "RollCall",
      entityId: existing.id,
      module: "boarding",
      description: `Updated ${data.type.toLowerCase()} roll call for ${data.records.length} students`,
      newData: { recordCount: data.records.length },
    });

    return { data: { id: existing.id, isUpdate: true } };
  }

  // Create new roll call
  const rollCall = await db.rollCall.create({
    data: {
      schoolId: ctx.schoolId,
      hostelId: data.hostelId,
      date: today,
      type: data.type,
      conductedBy: ctx.session.user.id,
      records: {
        create: data.records.map((record) => ({
          schoolId: ctx.schoolId,
          studentId: record.studentId,
          status: record.status,
          notes: record.notes || null,
        })),
      },
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "RollCall",
    entityId: rollCall.id,
    module: "boarding",
    description: `Conducted ${data.type.toLowerCase()} roll call with ${data.records.length} students`,
    newData: { hostelId: data.hostelId, type: data.type, recordCount: data.records.length },
  });

  return { data: { id: rollCall.id, isUpdate: false } };
}

export async function getRollCallHistoryAction(
  hostelId: string,
  filters?: {
    date?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ROLL_CALL_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { hostelId };
  if (filters?.date) {
    const dateObj = new Date(filters.date);
    dateObj.setHours(0, 0, 0, 0);
    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);
    where.date = { gte: dateObj, lt: nextDay };
  }

  const [rollCalls, total] = await Promise.all([
    db.rollCall.findMany({
      where,
      include: {
        records: true,
      },
      orderBy: { date: "desc" },
      take: pageSize,
      skip,
    }),
    db.rollCall.count({ where }),
  ]);

  // Fetch conductor names
  const conductorIds = [...new Set(rollCalls.map((rc) => rc.conductedBy))];
  let conductorMap = new Map<string, string>();
  if (conductorIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: conductorIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    conductorMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  const data = rollCalls.map((rc) => ({
    id: rc.id,
    hostelId: rc.hostelId,
    date: rc.date,
    type: rc.type,
    conductedBy: conductorMap.get(rc.conductedBy) ?? "Unknown",
    conductedAt: rc.conductedAt,
    totalRecords: rc.records.length,
    presentCount: rc.records.filter((r) => r.status === "PRESENT").length,
    absentCount: rc.records.filter((r) => r.status === "ABSENT").length,
    exeatCount: rc.records.filter((r) => r.status === "EXEAT").length,
    sickBayCount: rc.records.filter((r) => r.status === "SICK_BAY").length,
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

export async function getRollCallAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ROLL_CALL_READ);
  if (denied) return denied;

  const rollCall = await db.rollCall.findUnique({
    where: { id },
    include: {
      records: true,
    },
  });

  if (!rollCall) {
    return { error: "Roll call not found." };
  }

  // Fetch student names
  const studentIds = rollCall.records.map((r) => r.studentId);
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

  // Fetch conductor name
  const conductor = await db.user.findUnique({
    where: { id: rollCall.conductedBy },
    select: { firstName: true, lastName: true },
  });

  const data = {
    id: rollCall.id,
    hostelId: rollCall.hostelId,
    date: rollCall.date,
    type: rollCall.type,
    conductedBy: conductor ? `${conductor.firstName} ${conductor.lastName}` : "Unknown",
    conductedAt: rollCall.conductedAt,
    records: rollCall.records.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: studentMap.get(r.studentId)?.name ?? "Unknown",
      studentNumber: studentMap.get(r.studentId)?.studentNumber ?? "",
      status: r.status,
      notes: r.notes,
    })),
  };

  return { data };
}

export async function getBoardingStudentsAction(hostelId: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ROLL_CALL_READ);
  if (denied) return denied;

  // Get students who have active bed allocations in this hostel
  const allocations = await db.bedAllocation.findMany({
    where: {
      status: "ACTIVE",
      bed: {
        dormitory: {
          hostelId,
        },
      },
    },
    include: {
      bed: {
        include: {
          dormitory: true,
        },
      },
    },
  });

  const studentIds = allocations.map((a) => a.studentId);

  if (studentIds.length === 0) {
    return { data: [] };
  }

  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
    },
    orderBy: { firstName: "asc" },
  });

  const allocationMap = new Map(
    allocations.map((a) => [a.studentId, { dormitory: a.bed.dormitory.name, bed: a.bed.bedNumber }]),
  );

  const data = students.map((s) => ({
    id: s.id,
    studentId: s.studentId,
    firstName: s.firstName,
    lastName: s.lastName,
    photoUrl: s.photoUrl,
    dormitory: allocationMap.get(s.id)?.dormitory ?? "",
    bed: allocationMap.get(s.id)?.bed ?? "",
  }));

  return { data };
}
