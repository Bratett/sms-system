import { NextRequest, NextResponse } from "next/server";
import { getStudentNominalRollAction } from "@/modules/reports/actions/student-nominal-roll.action";
import { renderNominalRollXlsx } from "@/modules/reports/xlsx/student-reports";
import {
  authorizeReportRequest,
  fireReportAudit,
  isNextResponse,
  reportFileResponse,
  wrapReportRoute,
} from "@/modules/reports/route-helpers";

export const GET = wrapReportRoute(async (request: NextRequest) => {
  const session = await authorizeReportRequest();
  if (isNextResponse(session)) return session;

  const sp = request.nextUrl.searchParams;
  const academicYearId = sp.get("academicYearId") || undefined;
  const classArmId = sp.get("classArmId") || undefined;

  const result = await getStudentNominalRollAction({ academicYearId, classArmId });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const buffer = renderNominalRollXlsx({
    schoolName: session.schoolName,
    filterSummary: `Class arm ${classArmId ?? ""}`,
    generatedAt: new Date(),
    generatedBy: session.userName,
    rows: result.data!.rows,
  });

  fireReportAudit({
    userId: session.userId,
    schoolId: session.schoolId,
    reportSlug: "STUDENT_NOMINAL_ROLL",
    reportName: "Nominal Roll",
    format: "xlsx",
    filters: { academicYearId, classArmId },
    rowCount: result.data!.total,
  });

  return reportFileResponse({ buffer, format: "xlsx", filename: "nominal-roll" });
});
