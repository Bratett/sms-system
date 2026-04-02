import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { getStaffMemberAction } from "@/modules/hr/actions/staff.action";
import { getDepartmentsAction } from "@/modules/school/actions/department.action";
import { getLeaveTypesAction } from "@/modules/hr/actions/leave.action";
import { getLeaveRequestsAction } from "@/modules/hr/actions/leave.action";
import { StaffProfile } from "./staff-profile";

export default async function StaffProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const { id } = await params;

  const [staffResult, departmentsResult, leaveTypesResult, leaveRequestsResult] =
    await Promise.all([
      getStaffMemberAction(id),
      getDepartmentsAction(),
      getLeaveTypesAction(),
      getLeaveRequestsAction({ staffId: id, pageSize: 50 }),
    ]);

  if ("error" in staffResult || !("data" in staffResult)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Staff Not Found" />
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">{"error" in staffResult ? staffResult.error : "Staff member not found."}</p>
          <Link
            href="/hr/staff"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Back to Staff Directory
          </Link>
        </div>
      </div>
    );
  }

  const staff = staffResult.data;
  const departments = ("data" in departmentsResult ? departmentsResult.data : []).map((d: { id: string; name: string }) => ({
    id: d.id,
    name: d.name,
  }));
  const leaveTypes = "data" in leaveTypesResult ? leaveTypesResult.data : [];
  const leaveRequests = "data" in leaveRequestsResult ? leaveRequestsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${staff.firstName} ${staff.lastName}`}
        description={`Staff ID: ${staff.staffId}`}
        actions={
          <Link
            href="/hr/staff"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Directory
          </Link>
        }
      />
      <StaffProfile
        staff={staff}
        departments={departments}
        leaveTypes={leaveTypes}
        leaveRequests={leaveRequests}
      />
    </div>
  );
}
