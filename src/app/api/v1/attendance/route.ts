import { NextRequest } from "next/server";
import { authenticateApiRequest, hasApiPermission } from "@/lib/api/auth";
import { apiSuccess, apiError, apiPaginated } from "@/lib/api/response";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if ("error" in authResult) {
    return apiError(authResult.error, authResult.status);
  }

  if (!hasApiPermission(authResult, "attendance:read")) {
    return apiError("Insufficient permissions", 403);
  }

  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "25"), 100);
  const classArmId = searchParams.get("classArmId") || undefined;
  const date = searchParams.get("date") || undefined;
  const studentId = searchParams.get("studentId") || undefined;

  const where: Record<string, unknown> = {};
  if (classArmId) where.classArmId = classArmId;
  if (date) {
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);
    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);
    where.date = { gte: dateObj, lt: nextDay };
  }

  const recordsWhere = studentId ? { where: { studentId } } : {};

  const [registers, total] = await Promise.all([
    db.attendanceRegister.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { date: "desc" },
      include: {
        records: {
          ...recordsWhere,
          select: {
            studentId: true,
            status: true,
            remarks: true,
            arrivalTime: true,
          },
        },
      },
    }),
    db.attendanceRegister.count({ where }),
  ]);

  return apiPaginated(registers, total, page, pageSize);
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if ("error" in authResult) {
    return apiError(authResult.error, authResult.status);
  }

  if (!hasApiPermission(authResult, "attendance:create")) {
    return apiError("Insufficient permissions", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const { classArmId, date, type, periodId, records } = body as {
    classArmId?: string;
    date?: string;
    type?: string;
    periodId?: string;
    records?: Array<{
      studentId: string;
      status: string;
      remarks?: string;
      arrivalTime?: string;
    }>;
  };

  if (!classArmId || !date) {
    return apiError("classArmId and date are required", 400);
  }

  const school = await db.school.findFirst();
  if (!school) return apiError("No school configured", 500);

  const attendanceType = type === "PERIOD" ? "PERIOD" : "DAILY";
  const dateObj = new Date(date);
  dateObj.setHours(0, 0, 0, 0);

  // Create or get register
  let register = await db.attendanceRegister.findFirst({
    where: {
      classArmId,
      date: dateObj,
      type: attendanceType,
      periodId: periodId ?? null,
    },
  });

  if (!register) {
    register = await db.attendanceRegister.create({
      data: {
        schoolId: school.id,
        classArmId,
        date: dateObj,
        type: attendanceType,
        periodId: periodId ?? null,
        takenBy: authResult.apiKeyId,
      },
    });
  }

  if (register.status === "CLOSED") {
    return apiError("Register is closed and cannot be modified", 409);
  }

  // Record attendance if records provided
  if (records && Array.isArray(records) && records.length > 0) {
    const validStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED", "SICK"];
    const upserts = records
      .filter((r) => r.studentId && validStatuses.includes(r.status))
      .map((r) =>
        db.attendanceRecord.upsert({
          where: {
            registerId_studentId: {
              registerId: register.id,
              studentId: r.studentId,
            },
          },
          create: {
            registerId: register.id,
            studentId: r.studentId,
            status: r.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "SICK",
            remarks: r.remarks || null,
            arrivalTime: r.arrivalTime ? new Date(r.arrivalTime) : null,
          },
          update: {
            status: r.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "SICK",
            remarks: r.remarks || null,
            arrivalTime: r.arrivalTime ? new Date(r.arrivalTime) : null,
          },
        }),
      );

    await db.$transaction(upserts);
  }

  // Return the register with records
  const result = await db.attendanceRegister.findUnique({
    where: { id: register.id },
    include: {
      records: {
        select: {
          studentId: true,
          status: true,
          remarks: true,
          arrivalTime: true,
        },
      },
    },
  });

  return apiSuccess(result, 201);
}

export async function PUT(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if ("error" in authResult) {
    return apiError(authResult.error, authResult.status);
  }

  if (!hasApiPermission(authResult, "attendance:update")) {
    return apiError("Insufficient permissions", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const { registerId, action, records } = body as {
    registerId?: string;
    action?: "close";
    records?: Array<{
      studentId: string;
      status: string;
      remarks?: string;
    }>;
  };

  if (!registerId) {
    return apiError("registerId is required", 400);
  }

  const register = await db.attendanceRegister.findUnique({
    where: { id: registerId },
  });

  if (!register) return apiError("Register not found", 404);

  // Close register
  if (action === "close") {
    if (register.status === "CLOSED") {
      return apiError("Register is already closed", 409);
    }
    const updated = await db.attendanceRegister.update({
      where: { id: registerId },
      data: { status: "CLOSED" },
    });
    return apiSuccess(updated);
  }

  // Update records
  if (register.status === "CLOSED") {
    return apiError("Register is closed and cannot be modified", 409);
  }

  if (records && Array.isArray(records) && records.length > 0) {
    const validStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED", "SICK"];
    const upserts = records
      .filter((r) => r.studentId && validStatuses.includes(r.status))
      .map((r) =>
        db.attendanceRecord.upsert({
          where: {
            registerId_studentId: {
              registerId,
              studentId: r.studentId,
            },
          },
          create: {
            registerId,
            studentId: r.studentId,
            status: r.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "SICK",
            remarks: r.remarks || null,
          },
          update: {
            status: r.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "SICK",
            remarks: r.remarks || null,
          },
        }),
      );

    await db.$transaction(upserts);
  }

  const result = await db.attendanceRegister.findUnique({
    where: { id: registerId },
    include: {
      records: {
        select: { studentId: true, status: true, remarks: true },
      },
    },
  });

  return apiSuccess(result);
}
