import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getAcademicYearsAction } from "@/modules/school/actions/academic-year.action";
import { getStaffAction } from "@/modules/hr/actions/staff.action";
import { BulkLeaveClient } from "./bulk-leave-client";

export default async function BulkLeavePage() {
  const session = await auth();
  if (!session?.user) return null;

  const [yearsResult, staffResult] = await Promise.all([
    getAcademicYearsAction(),
    getStaffAction({ status: "ACTIVE", pageSize: 500 }),
  ]);

  const academicYears = "data" in yearsResult && yearsResult.data ? yearsResult.data : [];
  const staff = "staff" in staffResult && staffResult.staff ? staffResult.staff : [];

  return (
    <div>
      <PageHeader
        title="Bulk Leave Balance Initialization"
        description="Initialize leave balances for all or selected staff members for an academic year."
      />
      <BulkLeaveClient academicYears={academicYears} staff={staff} />
    </div>
  );
}
