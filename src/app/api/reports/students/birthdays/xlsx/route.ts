import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentBirthdayListAction } from "@/modules/reports/actions/student-birthday-list.action";
import { renderBirthdayListXlsx } from "@/modules/reports/xlsx/student-reports";
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
  const month = sp.get("month") ? Number(sp.get("month")) : undefined;
  const upcomingDays = sp.get("upcomingDays") ? Number(sp.get("upcomingDays")) : undefined;
  const includeGuardianPhone = sp.get("includeGuardianPhone") === "1";

  const result = await getStudentBirthdayListAction({ academicYearId, classArmId, month, upcomingDays, includeGuardianPhone });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const data = result.data!;
  const buffer = renderBirthdayListXlsx({
    schoolName: session.user.schoolName ?? "School",
    filterSummary: data.mode === "month" ? `Month ${data.appliedMonth}` : `Next ${data.appliedUpcomingDays} days`,
    generatedAt: new Date(),
    generatedBy: session.user.name ?? "Unknown",
    rows: data.rows,
    includeGuardianPhone,
    mode: data.mode as "month" | "upcomingDays",
  });

  await auditReportDownload({
    userId: session.user.id, schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_BIRTHDAYS", reportName: "Birthday List",
    format: "xlsx", filters: { academicYearId, classArmId, month, upcomingDays, includeGuardianPhone },
    rowCount: data.total,
  });

  const filename = `birthdays-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": getExportContentType("xlsx"), "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
