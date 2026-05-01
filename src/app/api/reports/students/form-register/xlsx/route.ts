import { NextRequest, NextResponse } from "next/server";
import { getStudentFormRegisterAction } from "@/modules/reports/actions/student-form-register.action";
import { renderFormRegisterXlsx } from "@/modules/reports/xlsx/student-reports";
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
  const weeks = sp.get("weeks") ? Number(sp.get("weeks")) : undefined;
  const daysPerWeek = sp.get("daysPerWeek") ? Number(sp.get("daysPerWeek")) : undefined;

  const result = await getStudentFormRegisterAction({ academicYearId, classArmId, weeks, daysPerWeek });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const buffer = renderFormRegisterXlsx({
    schoolName: session.schoolName,
    filterSummary: `Class arm ${classArmId ?? ""}`,
    generatedAt: new Date(),
    generatedBy: session.userName,
    rows: result.data!.rows,
    weeks: result.data!.weeks,
    daysPerWeek: result.data!.daysPerWeek,
  });

  fireReportAudit({
    userId: session.userId,
    schoolId: session.schoolId,
    reportSlug: "STUDENT_FORM_REGISTER",
    reportName: "Form Master's Register",
    format: "xlsx",
    filters: { academicYearId, classArmId, weeks, daysPerWeek },
    rowCount: result.data!.total,
  });

  return reportFileResponse({ buffer, format: "xlsx", filename: "form-register", schoolSlug: session.schoolSlug });
});
