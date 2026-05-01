import { NextRequest, NextResponse } from "next/server";
import { getStudentCensusAction, type CensusGroupBy } from "@/modules/reports/actions/student-census.action";
import { renderCensusXlsx } from "@/modules/reports/xlsx/student-reports";
import {
  authorizeReportRequest,
  fireReportAudit,
  isNextResponse,
  reportFileResponse,
  wrapReportRoute,
} from "@/modules/reports/route-helpers";

const ALLOWED: CensusGroupBy[] = ["class", "programme", "region", "gender", "boarding", "religion"];

export const GET = wrapReportRoute(async (request: NextRequest) => {
  const session = await authorizeReportRequest();
  if (isNextResponse(session)) return session;

  const sp = request.nextUrl.searchParams;
  const academicYearId = sp.get("academicYearId") || undefined;
  const groupParam = sp.get("groupBy");
  const groupBy = (ALLOWED.includes(groupParam as CensusGroupBy) ? groupParam : "class") as CensusGroupBy;

  const result = await getStudentCensusAction({ academicYearId, groupBy });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const buffer = renderCensusXlsx({
    schoolName: session.schoolName,
    generatedAt: new Date(),
    generatedBy: session.userName,
    groupBy,
    rows: result.data!.rows,
  });

  fireReportAudit({
    userId: session.userId,
    schoolId: session.schoolId,
    reportSlug: "STUDENT_CENSUS",
    reportName: "Student Census",
    format: "xlsx",
    filters: { academicYearId, groupBy },
    rowCount: result.data!.rows.length,
  });

  return reportFileResponse({ buffer, format: "xlsx", filename: `student-census-${groupBy}` });
});
