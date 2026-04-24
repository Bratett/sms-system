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
  const houses = "data" in housesResult ? housesResult.data : [];
  const eligibleHousemasters =
    "data" in housemastersResult ? housemastersResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Houses"
        description="Manage student houses in your school."
      />
      <HousesClient
        houses={houses}
        eligibleHousemasters={eligibleHousemasters}
      />
    </div>
  );
}
