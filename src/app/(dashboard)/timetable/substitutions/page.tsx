import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getSubstitutionsAction } from "@/modules/timetable/actions/substitution.action";
import { SubstitutionsClient } from "./substitutions-client";

export default async function SubstitutionsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const params = await searchParams;
  const result = await getSubstitutionsAction({
    date: params.date,
    status: params.status,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Substitutions"
        description="Manage teacher substitutions when staff are absent."
      />
      <SubstitutionsClient
        substitutions={result.data ?? []}
        pagination={result.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 }}
        filters={params}
      />
    </div>
  );
}
