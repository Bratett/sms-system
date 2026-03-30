import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { RiskProfilesClient } from "./risk-profiles-client";

export default async function RiskProfilesPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Risk Profiles"
        description="View and filter student risk assessments by level."
      />
      <RiskProfilesClient />
    </div>
  );
}
