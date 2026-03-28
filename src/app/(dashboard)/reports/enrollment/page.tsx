import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getEnrollmentReportAction, getReportFiltersAction } from "@/modules/reports/actions/report.action";
import { EnrollmentReportsClient } from "./enrollment-reports-client";

export default async function EnrollmentReportsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [reportResult, filtersResult] = await Promise.all([
    getEnrollmentReportAction(),
    getReportFiltersAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enrollment Reports"
        description="Student demographics, gender and programme distribution."
      />
      <EnrollmentReportsClient
        report={reportResult.data ?? null}
        filters={filtersResult.data ?? { academicYears: [], terms: [], classArms: [] }}
      />
    </div>
  );
}
