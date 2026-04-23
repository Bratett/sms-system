import { requireSchoolContext } from "@/lib/auth-context";
import { getHouseholdAction } from "@/modules/student/actions/household.action";
import { HouseholdDetailClient } from "./household-detail-client";

export default async function HouseholdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSchoolContext();
  if ("error" in ctx) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {ctx.error}
        </div>
      </div>
    );
  }

  const result = await getHouseholdAction(id);
  if ("error" in result) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.error}
        </div>
      </div>
    );
  }

  return <HouseholdDetailClient household={result.data} />;
}
