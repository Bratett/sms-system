import { NextRequest } from "next/server";
import { authenticateApiRequest, hasApiPermission } from "@/lib/api/auth";
import { apiSuccess, apiError, apiPaginated } from "@/lib/api/response";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if ("error" in authResult) {
    return apiError(authResult.error, authResult.status);
  }

  if (!hasApiPermission(authResult, "finance:read")) {
    return apiError("Insufficient permissions", 403);
  }

  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "25"), 100);
  const studentId = searchParams.get("studentId") || undefined;

  const where: Record<string, unknown> = {};
  if (studentId) where.studentId = studentId;

  // Scope to school via studentBill
  where.studentBill = { feeStructure: { schoolId: authResult.schoolId } };

  const [payments, total] = await Promise.all([
    db.payment.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { receivedAt: "desc" },
      select: {
        id: true,
        studentId: true,
        amount: true,
        paymentMethod: true,
        referenceNumber: true,
        status: true,
        receivedAt: true,
        notes: true,
        receipt: { select: { receiptNumber: true } },
      },
    }),
    db.payment.count({ where }),
  ]);

  return apiPaginated(payments, total, page, pageSize);
}
