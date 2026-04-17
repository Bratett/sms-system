import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getDocumentsAction } from "@/modules/documents/actions/document.action";
import { DocumentsClient } from "./documents-client";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; entityType?: string; search?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const params = await searchParams;

  const result = await getDocumentsAction({
    category: params.category,
    entityType: params.entityType,
    search: params.search,
    page: params.page ? parseInt(params.page) : 1,
    pageSize: 25,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Manage and organize school documents."
      />
      <DocumentsClient
        documents={"data" in result ? result.data : []}
        pagination={"pagination" in result ? result.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 } : { page: 1, pageSize: 25, total: 0, totalPages: 0 }}
        filters={params}
      />
    </div>
  );
}
