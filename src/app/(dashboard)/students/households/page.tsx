import { requireSchoolContext } from "@/lib/auth-context";
import { getHouseholdsAction } from "@/modules/student/actions/household.action";
import { HouseholdsClient } from "./households-client";

export default async function HouseholdsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
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

  const result = await getHouseholdsAction({ search: params.search });
  if ("error" in result) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.error}
        </div>
      </div>
    );
  }

  return <HouseholdsClient households={result.data} initialSearch={params.search ?? ""} />;
}
