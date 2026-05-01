import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentNominalRollAction } from "@/modules/reports/actions/student-nominal-roll.action";
import { renderNominalRollXlsx } from "@/modules/reports/xlsx/student-reports";
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

  const result = await getStudentNominalRollAction({ academicYearId, classArmId });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const buffer = renderNominalRollXlsx({
    schoolName: session.user.schoolName ?? "School",
    filterSummary: `Class arm ${classArmId ?? ""}`,
    generatedAt: new Date(),
    generatedBy: session.user.name ?? "Unknown",
    rows: result.data!.rows,
  });

  await auditReportDownload({
    userId: session.user.id, schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_NOMINAL_ROLL", reportName: "Nominal Roll",
    format: "xlsx", filters: { academicYearId, classArmId }, rowCount: result.data!.total,
  });

  const filename = `nominal-roll-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": getExportContentType("xlsx"), "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
