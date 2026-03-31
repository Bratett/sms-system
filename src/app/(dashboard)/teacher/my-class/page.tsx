import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getClassTeacherDashboardAction } from "@/modules/academics/actions/class-teacher.action";
import { MyClassClient } from "./my-class-client";

export default async function MyClassPage() {
  const session = await auth();
  if (!session?.user) return null;

  const result = await getClassTeacherDashboardAction();
  const dashboardData = result.data ?? [];
  const error = result.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Class"
        description="Overview and quick actions for your assigned class."
      />
      <MyClassClient dashboardData={dashboardData} error={error} />
    </div>
  );
}
