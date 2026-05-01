import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentFormRegisterAction } from "@/modules/reports/actions/student-form-register.action";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { StudentFormRegisterPdf } from "@/lib/pdf/templates/student-form-register";
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
  const weeks = sp.get("weeks") ? Number(sp.get("weeks")) : undefined;
  const daysPerWeek = sp.get("daysPerWeek") ? Number(sp.get("daysPerWeek")) : undefined;

  const result = await getStudentFormRegisterAction({ academicYearId, classArmId, weeks, daysPerWeek });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const school = await db.school.findUnique({
    where: { id: session.user.schoolId! }, select: { name: true, motto: true },
  });

  const buffer = await renderPdfToBuffer(
    React.createElement(StudentFormRegisterPdf, {
      schoolName: school?.name ?? session.user.schoolName ?? "School",
      schoolMotto: school?.motto ?? null,
      title: "Form Master's Register",
      filterSummary: `Class arm ${classArmId ?? ""}`,
      generatedAt: new Date(),
      generatedBy: session.user.name ?? "Unknown",
      rows: result.data!.rows,
      weeks: result.data!.weeks,
      daysPerWeek: result.data!.daysPerWeek,
    }),
  );

  await auditReportDownload({
    userId: session.user.id, schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_FORM_REGISTER", reportName: "Form Master's Register",
    format: "pdf", filters: { academicYearId, classArmId, weeks, daysPerWeek },
    rowCount: result.data!.total,
  });

  const filename = `form-register-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
