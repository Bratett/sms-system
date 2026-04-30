import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentRegisterReportAction } from "@/modules/reports/actions/student-report.action";
import { renderRosterXlsx } from "@/modules/reports/xlsx/student-reports";
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

  const result = await getStudentRegisterReportAction({ academicYearId, classArmId });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const buffer = renderRosterXlsx({
    schoolName: session.user.schoolName ?? "School",
    filterSummary: classArmId ? `Class arm filter applied` : "All class arms",
    generatedAt: new Date(),
    generatedBy: session.user.name ?? "Unknown",
    data: result.data!,
  });

  await auditReportDownload({
    userId: session.user.id,
    schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_ROSTER",
    reportName: "Class Roster",
    format: "xlsx",
    filters: { academicYearId, classArmId },
    rowCount: result.data!.totalStudents,
  });

  const filename = `roster-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": getExportContentType("xlsx"),
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
