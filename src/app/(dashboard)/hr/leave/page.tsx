import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getLeaveTypesAction, getLeaveRequestsAction } from "@/modules/hr/actions/leave.action";
import { getStaffAction } from "@/modules/hr/actions/staff.action";
import { LeaveClient } from "./leave-client";

export default async function LeavePage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [leaveTypesResult, leaveRequestsResult, staffResult] = await Promise.all([
    getLeaveTypesAction(),
    getLeaveRequestsAction({ page: 1, pageSize: 25 }),
    getStaffAction({ status: "ACTIVE", pageSize: 500 }),
  ]);

  const leaveTypes = leaveTypesResult.data ?? [];
  const leaveRequests = leaveRequestsResult.data ?? [];
  const total = leaveRequestsResult.total ?? 0;
  const page = leaveRequestsResult.page ?? 1;
  const pageSize = leaveRequestsResult.pageSize ?? 25;

  const staffOptions = (staffResult.staff ?? []).map((s) => ({
    id: s.id,
    staffId: s.staffId,
    name: `${s.firstName} ${s.lastName}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Management"
        description="Configure leave types and manage leave requests."
      />
      <LeaveClient
        leaveTypes={leaveTypes}
        initialRequests={leaveRequests}
        initialTotal={total}
        initialPage={page}
        initialPageSize={pageSize}
        staffOptions={staffOptions}
      />
    </div>
  );
}
