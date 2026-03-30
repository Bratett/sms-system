import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getRoutesAction } from "@/modules/transport/actions/transport.action";
import { RoutesClient } from "./routes-client";

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; vehicleId?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const params = await searchParams;

  const result = await getRoutesAction({
    search: params.search,
    status: params.status,
    vehicleId: params.vehicleId,
    page: params.page ? parseInt(params.page) : 1,
    pageSize: 25,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Routes"
        description="Manage transport routes and assignments."
      />
      <RoutesClient
        routes={result.data ?? []}
        total={result.total ?? 0}
        page={result.page ?? 1}
        pageSize={result.pageSize ?? 25}
        filters={params}
      />
    </div>
  );
}
