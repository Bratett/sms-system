import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { EligibilityClient } from "./eligibility-client";

export default async function EligibilityPage() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Graduation Eligibility"
        description="Search for students and check their graduation eligibility status."
      />
      <EligibilityClient />
    </div>
  );
}
