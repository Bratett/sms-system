import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentNominalRollAction } from "@/modules/reports/actions/student-nominal-roll.action";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { StudentNominalRollPdf } from "@/lib/pdf/templates/student-nominal-roll";
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

  const result = await getStudentNominalRollAction({ academicYearId, classArmId });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const school = await db.school.findUnique({
    where: { id: session.user.schoolId! }, select: { name: true, motto: true },
  });

  const buffer = await renderPdfToBuffer(
    React.createElement(StudentNominalRollPdf, {
      schoolName: school?.name ?? session.user.schoolName ?? "School",
      schoolMotto: school?.motto ?? null,
      title: "Nominal Roll",
      filterSummary: `Class arm ${classArmId ?? ""}`,
      generatedAt: new Date(),
      generatedBy: session.user.name ?? "Unknown",
      rows: result.data!.rows,
    }),
  );

  await auditReportDownload({
    userId: session.user.id, schoolId: session.user.schoolId!,
    reportSlug: "STUDENT_NOMINAL_ROLL", reportName: "Nominal Roll",
    format: "pdf", filters: { academicYearId, classArmId }, rowCount: result.data!.total,
  });

  const filename = `nominal-roll-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
