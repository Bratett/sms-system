import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentCensusAction, type CensusGroupBy } from "@/modules/reports/actions/student-census.action";
import { renderCensusXlsx } from "@/modules/reports/xlsx/student-reports";
import { auditReportDownload } from "@/modules/reports/audit-helpers";
import { getExportContentType } from "@/lib/export";

const ALLOWED: CensusGroupBy[] = ["class", "programme", "region", "gender", "boarding", "religion"];

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = session.user.permissions ?? [];
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.REPORTS_ENROLLMENT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const academicYearId = sp.get("academicYearId") || undefined;
  const groupParam = sp.get("groupBy");
  const groupBy = (ALLOWED.includes(groupParam as CensusGroupBy) ? groupParam : "class") as CensusGroupBy;

  const result = await getStudentCensusAction({ academicYearId, groupBy });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const buffer = renderCensusXlsx({
    schoolName: session.user.schoolName ?? "School",
    generatedAt: new Date(),
    generatedBy: session.user.name ?? "Unknown",
    groupBy,
    rows: result.data!.rows,
  });

  await auditReportDownload({
    userId: session.user.id,
    schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_CENSUS",
    reportName: "Student Census",
    format: "xlsx",
    filters: { academicYearId, groupBy },
    rowCount: result.data!.rows.length,
  });

  const filename = `student-census-${groupBy}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": getExportContentType("xlsx"),
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
