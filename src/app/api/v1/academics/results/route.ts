import { NextRequest } from "next/server";
import { authenticateApiRequest, hasApiPermission } from "@/lib/api/auth";
import { apiError, apiPaginated } from "@/lib/api/response";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if ("error" in authResult) {
    return apiError(authResult.error, authResult.status);
  }

  if (!hasApiPermission(authResult, "academics:read")) {
    return apiError("Insufficient permissions", 403);
  }

  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "25"), 100);
  const studentId = searchParams.get("studentId") || undefined;
  const termId = searchParams.get("termId") || undefined;
  const classArmId = searchParams.get("classArmId") || undefined;

  const where: Record<string, unknown> = {};
  if (studentId) where.studentId = studentId;
  if (termId) where.termId = termId;
  if (classArmId) where.classArmId = classArmId;

  const [results, total] = await Promise.all([
    db.terminalResult.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { computedAt: "desc" },
      include: {
        subjectResults: {
          select: {
            subjectId: true,
            totalScore: true,
            grade: true,
            position: true,
          },
        },
      },
    }),
    db.terminalResult.count({ where }),
  ]);

  return apiPaginated(results, total, page, pageSize);
}
