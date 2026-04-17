import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getComprehensiveReportAction } from "@/modules/reports/actions/report.action";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getComprehensiveReportAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports Center"
        description="Comprehensive school reports and analytics."
      />
      <ReportsClient report={"data" in result ? result.data : null} />
    </div>
  );
}
