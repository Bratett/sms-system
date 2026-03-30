import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import {
  getDataExportRequestsAction,
  getDeletionRequestsAction,
} from "@/modules/compliance/actions/data-rights.action";
import { DataRightsClient } from "./data-rights-client";

export default async function DataRightsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const params = await searchParams;

  const [exportResult, deletionResult] = await Promise.all([
    getDataExportRequestsAction(),
    getDeletionRequestsAction({
      status: params.status,
      page: params.page ? parseInt(params.page) : 1,
      pageSize: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Rights"
        description="Manage data export and deletion requests."
      />
      <DataRightsClient
        exportRequests={exportResult.data ?? []}
        deletionRequests={deletionResult.data ?? []}
        deletionTotal={deletionResult.total ?? 0}
        deletionPage={deletionResult.page ?? 1}
        deletionPageSize={deletionResult.pageSize ?? 20}
        currentStatus={params.status}
      />
    </div>
  );
}
