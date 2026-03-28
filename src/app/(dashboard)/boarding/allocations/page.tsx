import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAllocationsAction, getOccupancyReportAction } from "@/modules/boarding/actions/allocation.action";
import { getHostelsAction } from "@/modules/boarding/actions/hostel.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { getAcademicYearsAction } from "@/modules/school/actions/academic-year.action";
import { AllocationsClient } from "./allocations-client";

export default async function AllocationsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [allocationsResult, occupancyResult, hostelsResult, termsResult, academicYearsResult] =
    await Promise.all([
      getAllocationsAction({ status: "ACTIVE" }),
      getOccupancyReportAction(),
      getHostelsAction(),
      getTermsAction(),
      getAcademicYearsAction(),
    ]);

  const allocations = allocationsResult.data ?? [];
  const occupancy = occupancyResult.data ?? [];
  const hostels = hostelsResult.data ?? [];
  const terms = termsResult.data ?? [];
  const academicYears = academicYearsResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bed Allocations"
        description="Manage student bed allocations across hostels."
      />
      <AllocationsClient
        allocations={allocations}
        occupancy={occupancy}
        hostels={hostels}
        terms={terms}
        academicYears={academicYears}
      />
    </div>
  );
}
