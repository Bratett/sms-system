import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentRegisterReportAction } from "@/modules/reports/actions/student-report.action";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { StudentRosterPdf } from "@/lib/pdf/templates/student-roster";
import { auditReportDownload } from "@/modules/reports/audit-helpers";
import React from "react";

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
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const school = await db.school.findUnique({
    where: { id: session.user.schoolId! },
    select: { name: true, motto: true, logoUrl: true },
  });

  const data = result.data!;
  const totals = {
    total: data.totalStudents,
    male: data.genderDistribution.MALE,
    female: data.genderDistribution.FEMALE,
    day: data.boardingBreakdown.DAY,
    boarding: data.boardingBreakdown.BOARDING,
  };

  const buffer = await renderPdfToBuffer(
    React.createElement(StudentRosterPdf, {
      schoolName: school?.name ?? session.user.schoolName ?? "School",
      schoolMotto: school?.motto ?? null,
      schoolLogoUrl: school?.logoUrl ?? null,
      title: "Class Roster",
      filterSummary: classArmId ? "Single class arm" : "All class arms",
      generatedAt: new Date(),
      generatedBy: session.user.name ?? "Unknown",
      students: data.students,
      totals,
    }),
  );

  await auditReportDownload({
    userId: session.user.id,
    schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_ROSTER",
    reportName: "Class Roster",
    format: "pdf",
    filters: { academicYearId, classArmId },
    rowCount: data.totalStudents,
  });

  const filename = `roster-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
