import { NextRequest, NextResponse } from "next/server";
import { getStudentRegisterReportAction } from "@/modules/reports/actions/student-report.action";
import { renderRosterXlsx } from "@/modules/reports/xlsx/student-reports";
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

  const result = await getStudentRegisterReportAction({ academicYearId, classArmId });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const buffer = renderRosterXlsx({
    schoolName: session.schoolName,
    filterSummary: classArmId ? `Class arm filter applied` : "All class arms",
    generatedAt: new Date(),
    generatedBy: session.userName,
    data: result.data!,
  });

  fireReportAudit({
    userId: session.userId,
    schoolId: session.schoolId,
    reportSlug: "STUDENT_ROSTER",
    reportName: "Class Roster",
    format: "xlsx",
    filters: { academicYearId, classArmId },
    rowCount: result.data!.totalStudents,
  });

  return reportFileResponse({ buffer, format: "xlsx", filename: "roster", schoolSlug: session.schoolSlug });
});
