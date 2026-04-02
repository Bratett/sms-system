import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getGradingScalesAction } from "@/modules/school/actions/grading-scale.action";
import { GradingScalesClient } from "./grading-scales-client";

export default async function GradingScalesPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getGradingScalesAction();
  const gradingScales = "data" in result ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grading Scales"
        description="Manage grading scales and grade definitions for assessments."
      />
      <GradingScalesClient gradingScales={gradingScales} />
    </div>
  );
}
