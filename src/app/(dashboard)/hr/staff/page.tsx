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

  const staff = "staff" in staffResult ? staffResult.staff ?? [] : [];
  const total = "total" in staffResult ? staffResult.total ?? 0 : 0;
  const page = "page" in staffResult ? staffResult.page ?? 1 : 1;
  const pageSize = "pageSize" in staffResult ? staffResult.pageSize ?? 25 : 25;

  const departments = ("data" in departmentsResult ? departmentsResult.data : []).map((d: { id: string; name: string }) => ({
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
