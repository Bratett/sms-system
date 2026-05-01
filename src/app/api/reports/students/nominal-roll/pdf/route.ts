import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStudentNominalRollAction } from "@/modules/reports/actions/student-nominal-roll.action";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { StudentNominalRollPdf } from "@/lib/pdf/templates/student-nominal-roll";
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

  const result = await getStudentNominalRollAction({ academicYearId, classArmId });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const school = await db.school.findUnique({
    where: { id: session.schoolId },
    select: { name: true, motto: true },
  });

  const buffer = await renderPdfToBuffer(
    React.createElement(StudentNominalRollPdf, {
      schoolName: school?.name ?? session.schoolName,
      schoolMotto: school?.motto ?? null,
      title: "Nominal Roll",
      filterSummary: `Class arm ${classArmId ?? ""}`,
      generatedAt: new Date(),
      generatedBy: session.userName,
      rows: result.data!.rows,
    }),
  );

  fireReportAudit({
    userId: session.userId,
    schoolId: session.schoolId,
    reportSlug: "STUDENT_NOMINAL_ROLL",
    reportName: "Nominal Roll",
    format: "pdf",
    filters: { academicYearId, classArmId },
    rowCount: result.data!.total,
  });

  return reportFileResponse({ buffer, format: "pdf", filename: "nominal-roll", schoolSlug: session.schoolSlug });
});
