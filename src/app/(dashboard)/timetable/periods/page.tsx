import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getPeriodsAction } from "@/modules/timetable/actions/timetable.action";
import { PeriodsClient } from "./periods-client";

export default async function PeriodsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  await searchParams;

  const periodsResult = await getPeriodsAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Periods"
        description="Configure daily time periods for the school timetable."
      />
      <PeriodsClient periods={periodsResult.data ?? []} />
    </div>
  );
}
