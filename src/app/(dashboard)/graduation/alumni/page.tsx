import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAlumniAction } from "@/modules/graduation/actions/graduation.action";
import { AlumniClient } from "./alumni-client";

export default async function AlumniPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getAlumniAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alumni Directory"
        description="Browse and search graduated students."
      />
      <AlumniClient
        alumni={result.data ?? []}
        pagination={result.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 }}
      />
    </div>
  );
}
