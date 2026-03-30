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

  const where: Record<string, unknown> = {};
  if (classArmId) where.classArmId = classArmId;
  if (date) {
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);
    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);
    where.date = { gte: dateObj, lt: nextDay };
  }

  const [registers, total] = await Promise.all([
    db.attendanceRegister.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { date: "desc" },
      include: {
        records: {
          select: {
            studentId: true,
            status: true,
            remarks: true,
          },
        },
      },
    }),
    db.attendanceRegister.count({ where }),
  ]);

  return apiPaginated(registers, total, page, pageSize);
}
