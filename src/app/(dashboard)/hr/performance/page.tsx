import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getPerformanceNotesAction } from "@/modules/hr/actions/performance.action";
import { PerformanceClient } from "./performance-client";

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const params = await searchParams;
  const result = await getPerformanceNotesAction({
    page: params.page ? parseInt(params.page) : 1,
    pageSize: 25,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Reviews"
        description="Manage staff performance notes, ratings, and development goals."
      />
      <PerformanceClient
        notes={"data" in result ? result.data : []}
        pagination={"pagination" in result ? result.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 } : { page: 1, pageSize: 25, total: 0, totalPages: 0 }}
      />
    </div>
  );
}
