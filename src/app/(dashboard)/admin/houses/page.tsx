import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getHousesAction } from "@/modules/school/actions/house.action";
import { HousesClient } from "./houses-client";

export default async function HousesPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getHousesAction();
  const houses = "data" in result ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Houses"
        description="Manage student houses in your school."
      />
      <HousesClient houses={houses} />
    </div>
  );
}
