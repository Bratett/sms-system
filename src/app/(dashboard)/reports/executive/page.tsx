import { auth } from "@/lib/auth";
import { getExecutiveDashboardAction } from "@/modules/reports/actions/executive-dashboard.action";
import { ExecutiveDashboardClient } from "./executive-dashboard-client";

export const dynamic = "force-dynamic";

export default async function ExecutiveDashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getExecutiveDashboardAction();
  if ("error" in result) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {result.error}
      </div>
    );
  }

  return <ExecutiveDashboardClient data={result.data} />;
}
