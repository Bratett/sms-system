import { NextRequest, NextResponse } from "next/server";
import { getStudentMissingDocsAction } from "@/modules/reports/actions/student-missing-docs.action";
import { renderMissingDocsXlsx } from "@/modules/reports/xlsx/student-reports";
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
  const documentTypeId = sp.get("documentTypeId") || undefined;
  const includeExpired = sp.get("includeExpired") !== "0";

  const result = await getStudentMissingDocsAction({ academicYearId, classArmId, documentTypeId, includeExpired });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const buffer = renderMissingDocsXlsx({
    schoolName: session.schoolName,
    filterSummary: documentTypeId ? `Single document type` : "All required types",
    generatedAt: new Date(),
    generatedBy: session.userName,
    rows: result.data!.rows,
    note: result.data!.note,
  });

  fireReportAudit({
    userId: session.userId,
    schoolId: session.schoolId,
    reportSlug: "STUDENT_MISSING_DOCS",
    reportName: "Missing Documents",
    format: "xlsx",
    filters: { academicYearId, classArmId, documentTypeId, includeExpired },
    rowCount: result.data!.total,
  });

  return reportFileResponse({ buffer, format: "xlsx", filename: "missing-documents" });
});
