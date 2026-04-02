import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { AcademicReportsClient } from "./academic-reports-client";

export default async function AcademicReportsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const filtersResult = await getReportFiltersAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Performance Reports"
        description="View class averages, subject performance, and pass/fail rates."
      />
      <AcademicReportsClient
        filters={"data" in filtersResult ? filtersResult.data : { academicYears: [], terms: [], classArms: [] }}
      />
    </div>
  );
}
