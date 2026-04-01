import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getStaffDemographicsReportAction } from "@/modules/hr/actions/reports.action";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const demographics = await getStaffDemographicsReportAction();

  return (
    <div>
      <PageHeader title="HR Reports & Analytics" description="Comprehensive reports on staff, attendance, payroll, and leave." />
      <ReportsClient initialDemographics={"data" in demographics ? demographics.data : null} />
    </div>
  );
}
