import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getDigitalResourcesAction } from "@/modules/library/actions/library.action";
import { ResourcesClient } from "./resources-client";

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; type?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const params = await searchParams;

  const resourcesResult = await getDigitalResourcesAction({
    search: params.search,
    category: params.category,
    type: params.type,
    page: params.page ? parseInt(params.page) : 1,
    pageSize: 25,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Digital Resources"
        description="Manage digital library resources and materials."
      />
      <ResourcesClient
        resources={resourcesResult.data ?? []}
        total={resourcesResult.total ?? 0}
        page={resourcesResult.page ?? 1}
        pageSize={resourcesResult.pageSize ?? 25}
        filters={params}
      />
    </div>
  );
}
