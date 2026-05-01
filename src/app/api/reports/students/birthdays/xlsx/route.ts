import { NextRequest, NextResponse } from "next/server";
import { getStudentBirthdayListAction } from "@/modules/reports/actions/student-birthday-list.action";
import { renderBirthdayListXlsx } from "@/modules/reports/xlsx/student-reports";
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
  const month = sp.get("month") ? Number(sp.get("month")) : undefined;
  const upcomingDays = sp.get("upcomingDays") ? Number(sp.get("upcomingDays")) : undefined;
  const includeGuardianPhone = sp.get("includeGuardianPhone") === "1";

  const result = await getStudentBirthdayListAction({ academicYearId, classArmId, month, upcomingDays, includeGuardianPhone });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const data = result.data!;
  const buffer = renderBirthdayListXlsx({
    schoolName: session.schoolName,
    filterSummary: data.mode === "month" ? `Month ${data.appliedMonth}` : `Next ${data.appliedUpcomingDays} days`,
    generatedAt: new Date(),
    generatedBy: session.userName,
    rows: data.rows,
    includeGuardianPhone,
    mode: data.mode as "month" | "upcomingDays",
  });

  fireReportAudit({
    userId: session.userId,
    schoolId: session.schoolId,
    reportSlug: "STUDENT_BIRTHDAYS",
    reportName: "Birthday List",
    format: "xlsx",
    filters: { academicYearId, classArmId, month, upcomingDays, includeGuardianPhone },
    rowCount: data.total,
  });

  return reportFileResponse({ buffer, format: "xlsx", filename: "birthdays", schoolSlug: session.schoolSlug });
});
