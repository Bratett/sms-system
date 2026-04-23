import { getStudentAnalyticsAction } from "@/modules/student/actions/analytics.action";
import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { AnalyticsClient } from "./analytics-client";

export default async function StudentAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ academicYearId?: string; programmeId?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireSchoolContext();
  if ("error" in ctx) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {ctx.error}
        </div>
      </div>
    );
  }

  const [academicYears, programmes, result] = await Promise.all([
    db.academicYear.findMany({
      where: { schoolId: ctx.schoolId },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, isCurrent: true },
    }),
    db.programme.findMany({
      where: { schoolId: ctx.schoolId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getStudentAnalyticsAction({
      academicYearId: params.academicYearId,
      programmeId: params.programmeId,
    }),
  ]);

  const payload = "data" in result ? result.data : null;
  const error = "error" in result ? result.error : null;

  return (
    <AnalyticsClient
      academicYears={academicYears}
      programmes={programmes}
      selectedAcademicYearId={params.academicYearId}
      selectedProgrammeId={params.programmeId}
      payload={payload}
      error={error}
    />
  );
}
