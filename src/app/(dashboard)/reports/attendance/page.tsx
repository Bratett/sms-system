import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { AttendanceOverviewClient } from "./attendance-overview-client";

export default async function AttendanceReportsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const filtersResult = await getReportFiltersAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Reports"
        description="View attendance rates across classes and terms."
      />
      <AttendanceOverviewClient
        filters={filtersResult.data ?? { academicYears: [], terms: [], classArms: [] }}
      />
    </div>
  );
}
