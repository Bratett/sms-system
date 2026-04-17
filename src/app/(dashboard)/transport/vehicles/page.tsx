import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getVehiclesAction } from "@/modules/transport/actions/transport.action";
import { VehiclesClient } from "./vehicles-client";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; type?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const params = await searchParams;

  const result = await getVehiclesAction({
    search: params.search,
    status: params.status,
    type: params.type,
    page: params.page ? parseInt(params.page) : 1,
    pageSize: 25,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicles"
        description="Manage fleet vehicles and driver assignments."
      />
      <VehiclesClient
        vehicles={"data" in result ? result.data : []}
        total={"total" in result ? result.total : 0}
        page={"page" in result ? result.page : 1}
        pageSize={"pageSize" in result ? result.pageSize : 25}
        filters={params}
      />
    </div>
  );
}
