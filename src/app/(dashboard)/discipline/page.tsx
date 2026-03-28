import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getIncidentsAction } from "@/modules/discipline/actions/discipline.action";
import { DisciplineClient } from "./discipline-client";

export default async function DisciplinePage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getIncidentsAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discipline"
        description="Manage disciplinary incidents and sanctions."
      />
      <DisciplineClient
        incidents={result.data ?? []}
        pagination={result.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 }}
      />
    </div>
  );
}
