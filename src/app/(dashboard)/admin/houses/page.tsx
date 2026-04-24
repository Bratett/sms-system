import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import {
  getEligibleHousemastersAction,
  getHousesAction,
} from "@/modules/school/actions/house.action";
import { HousesClient } from "./houses-client";

export default async function HousesPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [housesResult, housemastersResult] = await Promise.all([
    getHousesAction(),
    getEligibleHousemastersAction(),
  ]);

  if ("error" in housesResult) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {housesResult.error}
        </div>
      </div>
    );
  }
  if ("error" in housemastersResult) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {housemastersResult.error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Houses"
        description="Manage student houses in your school."
      />
      <HousesClient
        houses={housesResult.data}
        eligibleHousemasters={housemastersResult.data}
      />
    </div>
  );
}
