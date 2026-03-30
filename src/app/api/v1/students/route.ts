import { NextRequest } from "next/server";
import { authenticateApiRequest, hasApiPermission } from "@/lib/api/auth";
import { apiSuccess, apiError, apiPaginated } from "@/lib/api/response";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if ("error" in authResult) {
    return apiError(authResult.error, authResult.status);
  }

  if (!hasApiPermission(authResult, "students:read")) {
    return apiError("Insufficient permissions", 403);
  }

  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "25"), 100);
  const search = searchParams.get("search") || undefined;
  const status = searchParams.get("status") || undefined;

  const where: Record<string, unknown> = { schoolId: authResult.schoolId };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { studentId: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status;

  const [students, total] = await Promise.all([
    db.student.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        otherNames: true,
        gender: true,
        dateOfBirth: true,
        boardingStatus: true,
        status: true,
        createdAt: true,
      },
    }),
    db.student.count({ where }),
  ]);

  return apiPaginated(students, total, page, pageSize);
}
