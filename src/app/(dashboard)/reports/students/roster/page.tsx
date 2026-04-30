import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { getStudentRegisterReportAction } from "@/modules/reports/actions/student-report.action";
import { RosterClient } from "./roster-client";

export default async function RosterReportPage({
  searchParams,
}: {
  searchParams: Promise<{ academicYearId?: string; classArmId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const sp = await searchParams;
  const [filtersResult, reportResult] = await Promise.all([
    getReportFiltersAction(),
    getStudentRegisterReportAction({
      academicYearId: sp.academicYearId,
      classArmId: sp.classArmId,
    }),
  ]);

  const filters = "data" in filtersResult ? filtersResult.data : { academicYears: [], terms: [], classArms: [] };
  const report = "data" in reportResult ? reportResult.data : null;
  const error = "error" in reportResult ? reportResult.error : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Class Roster"
        description="Per-class arm student listing with totals."
      />
      <RosterClient
        filters={filters}
        report={report}
        error={error}
        appliedFilters={sp}
      />
    </div>
  );
}
