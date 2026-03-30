import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getStaffDisciplinaryRecordsAction } from "@/modules/hr/actions/staff-discipline.action";
import { DisciplineClient } from "./discipline-client";

export default async function DisciplinePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const params = await searchParams;
  const result = await getStaffDisciplinaryRecordsAction({
    page: params.page ? parseInt(params.page) : 1,
    pageSize: 25,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Discipline"
        description="Track and manage staff disciplinary records and incidents."
      />
      <DisciplineClient
        records={result.data ?? []}
        pagination={result.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 }}
      />
    </div>
  );
}
