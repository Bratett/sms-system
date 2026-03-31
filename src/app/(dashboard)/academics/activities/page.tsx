import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getActivitiesAction } from "@/modules/academics/actions/cocurricular.action";
import { ActivitiesClient } from "./activities-client";

export default async function ActivitiesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getActivitiesAction();
  const activities = result.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Co-Curricular Activities"
        description="Manage clubs, sports, societies, and other co-curricular activities."
      />
      <ActivitiesClient initialActivities={activities} />
    </div>
  );
}
