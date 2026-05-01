import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStudentFormRegisterAction } from "@/modules/reports/actions/student-form-register.action";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { StudentFormRegisterPdf } from "@/lib/pdf/templates/student-form-register";
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
  const weeks = sp.get("weeks") ? Number(sp.get("weeks")) : undefined;
  const daysPerWeek = sp.get("daysPerWeek") ? Number(sp.get("daysPerWeek")) : undefined;

  const result = await getStudentFormRegisterAction({ academicYearId, classArmId, weeks, daysPerWeek });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const school = await db.school.findUnique({
    where: { id: session.schoolId },
    select: { name: true, motto: true },
  });

  const buffer = await renderPdfToBuffer(
    React.createElement(StudentFormRegisterPdf, {
      schoolName: school?.name ?? session.schoolName,
      schoolMotto: school?.motto ?? null,
      title: "Form Master's Register",
      filterSummary: `Class arm ${classArmId ?? ""}`,
      generatedAt: new Date(),
      generatedBy: session.userName,
      rows: result.data!.rows,
      weeks: result.data!.weeks,
      daysPerWeek: result.data!.daysPerWeek,
    }),
  );

  fireReportAudit({
    userId: session.userId,
    schoolId: session.schoolId,
    reportSlug: "STUDENT_FORM_REGISTER",
    reportName: "Form Master's Register",
    format: "pdf",
    filters: { academicYearId, classArmId, weeks, daysPerWeek },
    rowCount: result.data!.total,
  });

  return reportFileResponse({ buffer, format: "pdf", filename: "form-register", schoolSlug: session.schoolSlug });
});
