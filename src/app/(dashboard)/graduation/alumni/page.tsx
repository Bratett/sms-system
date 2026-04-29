import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAlumniDashboardAction } from "@/modules/alumni/actions/alumni-admin.action";
import { AlumniClient } from "./alumni-client";

export default async function AlumniPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getAlumniDashboardAction({ page: 1, pageSize: 20 });
  if ("error" in result) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Alumni Directory"
          description="Browse and search graduated students."
        />
        <div className="p-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {result.error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alumni Directory"
        description="Browse and search graduated students."
      />
      <AlumniClient
        initialRows={result.data}
        initialPagination={result.pagination}
        aggregates={result.aggregates}
      />
    </div>
  );
}
