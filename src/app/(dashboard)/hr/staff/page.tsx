import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getStaffAction } from "@/modules/hr/actions/staff.action";
import { getDepartmentsAction } from "@/modules/school/actions/department.action";
import { StaffClient } from "./staff-client";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [staffResult, departmentsResult] = await Promise.all([
    getStaffAction({ page: 1, pageSize: 25 }),
    getDepartmentsAction(),
  ]);

  const staff = staffResult.staff ?? [];
  const total = staffResult.total ?? 0;
  const page = staffResult.page ?? 1;
  const pageSize = staffResult.pageSize ?? 25;

  const departments = (departmentsResult.data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Directory"
        description="Manage all teaching and non-teaching staff members."
      />
      <StaffClient
        initialStaff={staff}
        initialTotal={total}
        initialPage={page}
        initialPageSize={pageSize}
        departments={departments}
      />
    </div>
  );
}
