import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getBoardingOverviewAction } from "@/modules/boarding/actions/analytics.action";
import { AnalyticsClient } from "./analytics-client";

export default async function BoardingAnalyticsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const overviewResult = await getBoardingOverviewAction();
  const overview = ("data" in overviewResult ? overviewResult.data : null) ?? {
    totalHostels: 0,
    totalBeds: 0,
    occupiedBeds: 0,
    availableBeds: 0,
    occupancyRate: 0,
    activeExeats: 0,
    overdueExeats: 0,
    currentSickBay: 0,
    activeVisitors: 0,
    pendingTransfers: 0,
    openMaintenance: 0,
    activeIncidents: 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boarding Analytics"
        description="Comprehensive analytics and insights across all boarding operations."
      />
      <AnalyticsClient overview={overview} />
    </div>
  );
}
