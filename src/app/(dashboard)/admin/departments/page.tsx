import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getDepartmentsAction } from "@/modules/school/actions/department.action";
import { DepartmentsClient } from "./departments-client";

export default async function DepartmentsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getDepartmentsAction();
  const departments = result.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Manage academic departments in your school."
      />
      <DepartmentsClient departments={departments} />
    </div>
  );
}
