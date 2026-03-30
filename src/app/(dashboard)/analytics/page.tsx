import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { AnalyticsClient } from "./analytics-client";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Analytics"
        description="Student risk profiling, performance insights, and attendance anomaly detection."
      />
      <AnalyticsClient />
    </div>
  );
}
