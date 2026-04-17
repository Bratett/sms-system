import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getDepartmentsAction } from "@/modules/school/actions/department.action";
import { StaffForm } from "./staff-form";

export default async function NewStaffPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const departmentsResult = await getDepartmentsAction();
  const departments = ("data" in departmentsResult ? departmentsResult.data : []).map((d: { id: string; name: string }) => ({
    id: d.id,
    name: d.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Register New Staff"
        description="Add a new staff member with personal, professional, and employment details."
      />
      <StaffForm departments={departments} />
    </div>
  );
}
