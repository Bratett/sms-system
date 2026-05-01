import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStudentRegisterReportAction } from "@/modules/reports/actions/student-report.action";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { StudentRosterPdf } from "@/lib/pdf/templates/student-roster";
import {
  authorizeReportRequest,
  fireReportAudit,
  isNextResponse,
  reportFileResponse,
  wrapReportRoute,
} from "@/modules/reports/route-helpers";
import React from "react";

export const GET = wrapReportRoute(async (request: NextRequest) => {
  const session = await authorizeReportRequest();
  if (isNextResponse(session)) return session;

  const sp = request.nextUrl.searchParams;
  const academicYearId = sp.get("academicYearId") || undefined;
  const classArmId = sp.get("classArmId") || undefined;

  const result = await getStudentRegisterReportAction({ academicYearId, classArmId });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const school = await db.school.findUnique({
    where: { id: session.schoolId },
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
      schoolName: school?.name ?? session.schoolName,
      schoolMotto: school?.motto ?? null,
      schoolLogoUrl: school?.logoUrl ?? null,
      title: "Class Roster",
      filterSummary: classArmId ? "Single class arm" : "All class arms",
      generatedAt: new Date(),
      generatedBy: session.userName,
      students: data.students,
      totals,
    }),
  );

  fireReportAudit({
    userId: session.userId,
    schoolId: session.schoolId,
    reportSlug: "STUDENT_ROSTER",
    reportName: "Class Roster",
    format: "pdf",
    filters: { academicYearId, classArmId },
    rowCount: data.totalStudents,
  });

  return reportFileResponse({ buffer, format: "pdf", filename: "roster" });
});
