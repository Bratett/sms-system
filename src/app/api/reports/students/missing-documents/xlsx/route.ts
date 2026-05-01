import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentMissingDocsAction } from "@/modules/reports/actions/student-missing-docs.action";
import { renderMissingDocsXlsx } from "@/modules/reports/xlsx/student-reports";
import { auditReportDownload } from "@/modules/reports/audit-helpers";
import { getExportContentType } from "@/lib/export";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = session.user.permissions ?? [];
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.REPORTS_ENROLLMENT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const academicYearId = sp.get("academicYearId") || undefined;
  const classArmId = sp.get("classArmId") || undefined;
  const documentTypeId = sp.get("documentTypeId") || undefined;
  const includeExpired = sp.get("includeExpired") !== "0";

  const result = await getStudentMissingDocsAction({ academicYearId, classArmId, documentTypeId, includeExpired });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const buffer = renderMissingDocsXlsx({
    schoolName: session.user.schoolName ?? "School",
    filterSummary: documentTypeId ? `Single document type` : "All required types",
    generatedAt: new Date(),
    generatedBy: session.user.name ?? "Unknown",
    rows: result.data!.rows,
  });

  await auditReportDownload({
    userId: session.user.id, schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_MISSING_DOCS", reportName: "Missing Documents",
    format: "xlsx", filters: { academicYearId, classArmId, documentTypeId, includeExpired },
    rowCount: result.data!.total,
  });

  const filename = `missing-documents-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": getExportContentType("xlsx"), "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
